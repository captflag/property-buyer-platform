-- ============================================================================
-- Operations: rate limits, digest delivery, and the builder's portfolio.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Rate limits
--
-- A fixed-window counter per person and bucket, kept in Postgres so that
-- every server instance shares it. A counter in memory is per process: a
-- deployment running four instances would allow four times the limit.
-- ---------------------------------------------------------------------------
create table rate_limits (
  key           text not null,
  window_start  timestamptz not null,
  hits          integer not null default 0,
  primary key (key, window_start)
);

create index rate_limits_window_idx on rate_limits (window_start);

-- No policies on purpose: nothing reads or writes this table except the
-- function below.
alter table rate_limits enable row level security;

create or replace function hit_rate_limit(p_bucket text, p_max integer, p_window_seconds integer)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_window  timestamptz;
  v_hits    integer;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  -- A fixed list, so a caller cannot mint unbounded rows by inventing names.
  -- The key is always the caller's own id, so nobody can spend someone
  -- else's allowance.
  if p_bucket not in ('assistant', 'snag', 'question', 'visit') then
    raise exception 'unknown rate-limit bucket' using errcode = '22023';
  end if;
  if p_max < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit' using errcode = '22023';
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into rate_limits as r (key, window_start, hits)
  values (v_uid::text || ':' || p_bucket, v_window, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;

  -- Expired windows are swept now and then by whoever happens to be counted,
  -- rather than by a scheduled job that could be forgotten.
  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;

  allowed := v_hits <= p_max;
  retry_after_seconds := case
    when allowed then 0
    else greatest(
      1,
      ceil(extract(epoch from (v_window + make_interval(secs => p_window_seconds) - now())))::integer
    )
  end;
  return next;
end;
$$;

revoke execute on function hit_rate_limit(text, integer, integer) from public, anon;
grant  execute on function hit_rate_limit(text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Digest delivery
--
-- One row per person, project and digest period. The scheduler claims a row
-- before sending and only then calls the email provider, so two overlapping
-- runs -- a retry, a manual trigger during a scheduled one -- can never send
-- the same person the same digest twice.
-- ---------------------------------------------------------------------------
create table digest_deliveries (
  project_id   uuid not null references projects on delete cascade,
  user_id      uuid not null references profiles on delete cascade,
  period_end   date not null,
  status       text not null default 'sending' check (status in ('sending', 'sent')),
  provider_id  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (project_id, user_id, period_end)
);

create index digest_deliveries_period_idx on digest_deliveries (period_end, project_id);

alter table digest_deliveries enable row level security;

-- People may see their own delivery history. Only the scheduler, running as
-- the service role, writes.
create policy digest_deliveries_select_own on digest_deliveries
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Portfolio health
--
-- `project_health` for every project the caller can see, in one call. It
-- runs as the caller (not SECURITY DEFINER), so row-level security decides
-- which projects appear -- a builder sees their sites, a buyer their house.
-- ---------------------------------------------------------------------------
create or replace function portfolio_health()
returns table (
  project_id              uuid,
  name                    text,
  slug                    text,
  city                    text,
  currency                text,
  status                  project_status,
  role                    project_role,
  target_completion_date  date,
  progress_percent        numeric,
  planned_percent         numeric,
  schedule_variance       numeric,
  budget_total            numeric,
  spent_total             numeric,
  committed_total         numeric,
  cost_variance           numeric,
  open_issues             integer,
  critical_issues         integer,
  overdue_payments        integer,
  days_remaining          integer
)
language sql
stable
set search_path = public, pg_temp
as $$
  select
    p.id, p.name, p.slug, p.city, p.currency, p.status, pm.role, p.target_completion_date,
    h.progress_percent, h.planned_percent, h.schedule_variance,
    h.budget_total, h.spent_total, h.committed_total, h.cost_variance,
    h.open_issues, h.critical_issues, h.overdue_payments, h.days_remaining
  from projects p
  left join project_members pm
    on pm.project_id = p.id and pm.user_id = (select auth.uid())
  cross join lateral project_health(p.id) h
  order by p.created_at desc
  limit 500;
$$;

revoke execute on function portfolio_health() from public, anon;
grant  execute on function portfolio_health() to authenticated;
