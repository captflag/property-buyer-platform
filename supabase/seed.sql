-- ============================================================================
-- Seed data for local development.
--
-- Replayed by `supabase db reset` after the migrations. It builds the same
-- example project the zero-config demo mode serves, so the two modes show the
-- same thing and a bug in one is reproducible in the other.
--
-- Dates are computed relative to CURRENT_DATE rather than hard-coded, so the
-- project stays "in progress, slightly behind" however long after writing this
-- you run it. Hard-coded dates would leave the seed looking like a finished
-- build within a year.
--
-- Local only. It writes directly into auth.users, which a hosted project will
-- not allow -- and the passwords below are deliberately throwaway.
-- ============================================================================

do $$
declare
  org_id          uuid := '11111111-1111-4111-8111-111111111111';
  project_id      uuid := '22222222-2222-4222-8222-222222222222';
  buyer_id        uuid := '33333333-3333-4333-8333-333333333331';
  builder_id      uuid := '33333333-3333-4333-8333-333333333332';

  -- 410-day programme with today sitting 232 days in: just past
  -- weather-tight, services first fix underway. Matches the demo dataset in
  -- src/lib/demo/dataset.ts so both modes tell the same story.
  start_date      date := current_date - 232;
  target_date     date := current_date - 232 + 410;
  planned_today   numeric;
  actual_today    numeric;
  deficit         numeric;
  contract_value  numeric := 685000;

  phase_ids       uuid[] := array[
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
  ];
  milestone_id    uuid;
  phase_index     int;
  row_rec         record;
begin
  -- ---- Auth users --------------------------------------------------------
  -- The handle_new_user() trigger creates the matching profiles rows.
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  values
    (
      buyer_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'amara@example.com', crypt('demo-password-1', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Amara Okafor","role":"buyer"}'::jsonb, now(), now()
    ),
    (
      builder_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'marcus@calderfinch.example', crypt('demo-password-2', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Marcus Adeyemi","role":"builder"}'::jsonb, now(), now()
    )
  on conflict (id) do nothing;

  -- ---- Organisation and project ------------------------------------------
  insert into organizations (id, name, slug, website, phone, email)
  values (org_id, 'Calder & Finch Construction', 'calder-finch',
          'https://calderfinch.example', '+1 512 555 0142', 'site@calderfinch.example')
  on conflict (id) do nothing;

  insert into organization_members (organization_id, user_id, role)
  values (org_id, builder_id, 'owner')
  on conflict do nothing;

  insert into projects (
    id, organization_id, name, slug, description, status,
    address_line1, address_line2, city, state, postal_code, country,
    latitude, longitude, start_date, target_completion_date,
    contract_value, currency, unit_type, floor_area_sqft, bedrooms, bathrooms,
    plot_area_sqft, contractor_name, architect_name, site_manager_name, site_manager_phone
  )
  values (
    project_id, org_id, 'Kestrel House', 'kestrel-house',
    'A four-bedroom detached family home on a quarter-acre plot, built to a fabric-first specification with an air source heat pump and mechanical ventilation with heat recovery.',
    'in_progress',
    '17 Kestrel Rise', 'Aster Grove', 'Austin', 'TX', '78704', 'US',
    30.2489, -97.7681, start_date, target_date,
    contract_value, 'USD', 'Detached house', 2840, 4, 3.5,
    10890, 'Calder & Finch Construction', 'Wren Lassiter Architects',
    'Marcus Adeyemi', '+1 512 555 0177'
  )
  on conflict (id) do nothing;

  insert into project_members (project_id, user_id, role, is_primary)
  values (project_id, buyer_id, 'buyer', true),
         (project_id, builder_id, 'builder', true)
  on conflict do nothing;

  -- ---- Phases -------------------------------------------------------------
  insert into phases (id, project_id, name, description, sequence, weight, colour_slot,
                      planned_start, planned_end, status)
  values
    (phase_ids[1], project_id, 'Site & Foundations', 'Clearing, excavation, footings and the slab pour.', 1, 15, 1,
     start_date, start_date + 76, 'completed'),
    (phase_ids[2], project_id, 'Structure & Framing', 'Load-bearing structure, floor decks and roof trusses.', 2, 20, 2,
     start_date + 76, start_date + 156, 'completed'),
    (phase_ids[3], project_id, 'Envelope & Roofing', 'Making the building weather-tight.', 3, 15, 3,
     start_date + 156, start_date + 228, 'in_progress'),
    (phase_ids[4], project_id, 'MEP Rough-In', 'Mechanical, electrical and plumbing first fix.', 4, 15, 4,
     start_date + 206, start_date + 252, 'in_progress'),
    (phase_ids[5], project_id, 'Interior Fit-Out', 'Insulation and plaster through to second fix and decoration.', 5, 25, 5,
     start_date + 252, start_date + 358, 'not_started'),
    (phase_ids[6], project_id, 'Handover & Landscaping', 'Commissioning, snagging, external works and keys.', 6, 10, 7,
     start_date + 352, start_date + 410, 'not_started')
  on conflict (id) do nothing;

  -- ---- Milestones ---------------------------------------------------------
  for row_rec in
    select * from (values
      (1, 'Site mobilisation',              0,   12, 2::numeric, 100::numeric, 0::numeric),
      (1, 'Excavation & earthworks',        12,  18, 3, 100, 0),
      (1, 'Footings & reinforcement',       30,  20, 4, 100, 10),
      (1, 'Slab pour & cure',               50,  26, 6, 100, 10),
      (2, 'Ground floor framing',           76,  24, 6, 100, 0),
      (2, 'First floor deck',               100, 16, 4, 100, 0),
      (2, 'First floor framing',            116, 22, 5, 100, 15),
      (2, 'Roof trusses & bracing',         138, 18, 5, 100, 0),
      (3, 'Roof covering',                  156, 20, 5, 100, 0),
      (3, 'External sheathing & wrap',      170, 14, 3, 100, 0),
      (3, 'Windows & external doors',       184, 22, 4, 72,  15),
      (3, 'Cladding & render',              200, 28, 3, 45,  0),
      (4, 'Electrical first fix',           206, 20, 4, 88,  0),
      (4, 'Plumbing first fix',             212, 22, 4, 76,  0),
      (4, 'HVAC installation',              222, 24, 4, 40,  0),
      (4, 'MEP inspection',                 246, 6,  3, 0,   15),
      (5, 'Insulation & airtightness',      252, 16, 4, 0,   0),
      (5, 'Plasterboard & skim',            268, 24, 5, 0,   0),
      (5, 'Joinery & staircase',            292, 22, 4, 0,   0),
      (5, 'Kitchen & bathrooms',            306, 26, 6, 0,   20),
      (5, 'Flooring',                       326, 18, 3, 0,   0),
      (5, 'Decoration',                     338, 20, 3, 0,   0),
      (6, 'MEP second fix & commissioning', 352, 16, 3, 0,   0),
      (6, 'External works & landscaping',   358, 24, 3, 0,   0),
      (6, 'Snagging & rectification',       382, 18, 2, 0,   0),
      (6, 'Final inspection & handover',    400, 10, 2, 0,   15)
    ) as t(phase_no, name, offset_days, duration, weight, progress, payment_pct)
    order by offset_days
  loop
    milestone_id := gen_random_uuid();
    phase_index := row_rec.phase_no;

    insert into milestones (
      id, project_id, phase_id, name, sequence, weight,
      planned_start, planned_end, actual_start, actual_end,
      progress_percent, status, payment_percent
    )
    values (
      milestone_id, project_id, phase_ids[phase_index], row_rec.name,
      row_number() over (), row_rec.weight,
      start_date + row_rec.offset_days,
      start_date + row_rec.offset_days + row_rec.duration,
      case when row_rec.progress > 0 then start_date + row_rec.offset_days end,
      case when row_rec.progress = 100
           then start_date + row_rec.offset_days + row_rec.duration end,
      row_rec.progress,
      case when row_rec.progress = 100 then 'completed'::work_status
           when row_rec.progress > 0 then 'in_progress'::work_status
           else 'not_started'::work_status end,
      row_rec.payment_pct
    );

  end loop;

  -- ---- Dependencies -------------------------------------------------------
  -- Derived from the planned dates rather than chained blindly. A straight
  -- finish-to-start chain would put every milestone on the critical path and
  -- the Gantt chart would have nothing to say. The rule is the standard one:
  -- a milestone's immediate predecessors are the latest-finishing milestones
  -- that end on or before it starts, so parallel work acquires real float.
  insert into milestone_dependencies (predecessor_id, successor_id, type, lag_days)
  select pred.id, succ.id, 'FS', 0
  from milestones succ
  join lateral (
    select m.id, m.planned_end
    from milestones m
    where m.project_id = succ.project_id
      and m.id <> succ.id
      and m.planned_end <= succ.planned_start
      and m.planned_end = (
        select max(m2.planned_end)
        from milestones m2
        where m2.project_id = succ.project_id
          and m2.id <> succ.id
          and m2.planned_end <= succ.planned_start
      )
  ) pred on true
  where succ.project_id = project_id
  on conflict do nothing;

  -- Two genuine overlaps the date rule cannot see: concurrent work rather
  -- than one task following another.
  insert into milestone_dependencies (predecessor_id, successor_id, type, lag_days)
  select p.id, s2.id, 'SS', pairs.lag
  from (values
    ('Windows & external doors', 'Cladding & render', 16),
    ('Kitchen & bathrooms', 'Flooring', 20)
  ) as pairs(from_name, to_name, lag)
  join milestones p on p.project_id = project_id and p.name = pairs.from_name
  join milestones s2 on s2.project_id = project_id and s2.name = pairs.to_name
  on conflict do nothing;

  -- ---- Budget -------------------------------------------------------------
  insert into budget_categories (project_id, name, code, budgeted_amount, sequence, colour_slot)
  values
    (project_id, 'Substructure', 'SUB', 84000, 0, 1),
    (project_id, 'Superstructure', 'SUP', 156000, 1, 2),
    (project_id, 'Envelope & roofing', 'ENV', 112000, 2, 3),
    (project_id, 'Mechanical & electrical', 'MEP', 98000, 3, 4),
    (project_id, 'Internal finishes', 'FIN', 124000, 4, 5),
    (project_id, 'External works', 'EXT', 46000, 5, 6),
    (project_id, 'Professional fees', 'FEE', 38000, 6, 7),
    (project_id, 'Contingency', 'CON', 27000, 7, 8)
  on conflict do nothing;

  -- Spend profile: envelope is deliberately over once commitments land, which
  -- is the story the dashboard has to surface.
  insert into cost_entries (project_id, category_id, description, amount, kind, incurred_on, created_by)
  select
    project_id,
    bc.id,
    bc.name || ' -- valuation',
    round(bc.budgeted_amount * profile.actual_share),
    'actual'::cost_kind,
    start_date + profile.day_offset,
    builder_id
  from budget_categories bc
  join (values
    ('Substructure', 1.00, 55), ('Superstructure', 0.98, 120),
    ('Envelope & roofing', 0.82, 190), ('Mechanical & electrical', 0.44, 215),
    ('Internal finishes', 0.05, 225), ('External works', 0.00, 228),
    ('Professional fees', 0.71, 40), ('Contingency', 0.34, 205)
  ) as profile(name, actual_share, day_offset) on profile.name = bc.name
  where bc.project_id = project_id and profile.actual_share > 0;

  insert into cost_entries (project_id, category_id, description, amount, kind, incurred_on, created_by)
  select
    project_id, bc.id, bc.name || ' -- placed orders',
    round(bc.budgeted_amount * profile.committed_share),
    'committed'::cost_kind, current_date - 20, builder_id
  from budget_categories bc
  join (values
    ('Envelope & roofing', 0.24), ('Mechanical & electrical', 0.31),
    ('Internal finishes', 0.18), ('External works', 0.06),
    ('Professional fees', 0.10)
  ) as profile(name, committed_share) on profile.name = bc.name
  where bc.project_id = project_id;

  -- ---- Payment schedule ---------------------------------------------------
  insert into payments (project_id, name, sequence, amount, percent_of_contract,
                        due_date, status, paid_at, invoice_number, method)
  values
    (project_id, 'Deposit on signing', 0, contract_value * 0.10, 10, current_date - 320, 'paid', now() - interval '317 days', 'INV-0012', 'Bank transfer'),
    (project_id, 'Foundations complete', 1, contract_value * 0.10, 10, current_date - 240, 'paid', now() - interval '237 days', 'INV-0021', 'Bank transfer'),
    (project_id, 'Framing complete', 2, contract_value * 0.15, 15, current_date - 66, 'paid', now() - interval '63 days', 'INV-0041', 'Bank transfer'),
    (project_id, 'Weather-tight', 3, contract_value * 0.15, 15, current_date + 8, 'invoiced', null, 'INV-0058', null),
    (project_id, 'Services first fix signed off', 4, contract_value * 0.15, 15, current_date + 34, 'scheduled', null, null, null),
    (project_id, 'Second fix complete', 5, contract_value * 0.20, 20, current_date + 128, 'scheduled', null, null, null),
    (project_id, 'Practical completion & handover', 6, contract_value * 0.15, 15, current_date + 196, 'scheduled', null, null, null)
  on conflict do nothing;

  -- ---- Change orders ------------------------------------------------------
  insert into change_orders (project_id, number, title, description, cost_delta,
                             schedule_delta_days, status, requested_by, decided_by, decided_at)
  values
    (project_id, 'CO-001', 'Upgrade to triple glazing on north elevation',
     'Buyer-requested upgrade from double to triple glazed units on the three north-facing windows.',
     6800, 0, 'approved', buyer_id, builder_id, now() - interval '142 days'),
    (project_id, 'CO-002', 'Kitchen specification upgrade',
     'Change to in-frame shaker units with quartz worktops, including associated appliance changes.',
     14500, 6, 'approved', buyer_id, builder_id, now() - interval '44 days'),
    (project_id, 'CO-003', 'EV charger and consumer unit upgrade',
     'Addition of a 7kW EV charge point, with the consumer unit uprated for the extra circuit.',
     2950, 0, 'proposed', buyer_id, null, null)
  on conflict do nothing;

  -- ---- Issues -------------------------------------------------------------
  insert into issues (project_id, title, description, location, severity, status,
                      reported_by, assigned_to, due_date)
  values
    (project_id, 'Rear dormer window units short-delivered',
     'Two rear dormer units arrived with a manufacturing fault and were rejected on delivery. Supplier is remaking; revised delivery confirmed for 14 days from rejection.',
     'Rear elevation, first floor', 'high', 'in_progress', builder_id, builder_id, current_date + 8),
    (project_id, 'Standing water at the north-east corner',
     'Water pools against the north-east corner of the slab after heavy rain rather than draining to the temporary soakaway. Needs regrading before external works start.',
     'North-east external', 'medium', 'open', buyer_id, builder_id, current_date + 21),
    (project_id, 'Scratched glazing unit, ground floor rear',
     'One ground floor rear pane has a 60mm surface scratch. Supplier will replace under the installation warranty.',
     'Ground floor, rear', 'low', 'acknowledged', builder_id, builder_id, current_date + 30)
  on conflict do nothing;

  -- ---- Inspections --------------------------------------------------------
  insert into inspections (project_id, name, authority, inspector_name, scheduled_for,
                           completed_at, result, notes)
  values
    (project_id, 'Foundation & reinforcement', 'City Building Control', 'Deirdre Halloran', current_date - 236, now() - interval '236 days', 'pass', 'Passed without conditions.'),
    (project_id, 'Slab pre-pour', 'City Building Control', 'Deirdre Halloran', current_date - 172, now() - interval '172 days', 'pass', 'Passed without conditions.'),
    (project_id, 'Structural frame', 'City Building Control', 'Deirdre Halloran', current_date - 64, now() - interval '64 days', 'pass', 'Passed without conditions.'),
    (project_id, 'Roof covering', 'City Building Control', 'Deirdre Halloran', current_date - 24, now() - interval '24 days', 'pass', 'Passed without conditions.'),
    (project_id, 'MEP first fix', 'City Building Control', null, current_date + 22, null, 'pending', null),
    (project_id, 'Final building control', 'City Building Control', null, current_date + 172, null, 'pending', null)
  on conflict do nothing;

  -- ---- Progress snapshots (the S-curve) -----------------------------------
  -- The planned line is derived from the milestones just as the demo dataset
  -- derives it: the weight-weighted sum of where each milestone should be if
  -- it tracked its own window linearly. Deriving it rather than inventing a
  -- curve is what keeps the chart and the Gantt telling the same story.
  select
    sum(m.weight * least(1, greatest(0,
      ((current_date - m.planned_start + 1)::numeric /
       ((m.planned_end - m.planned_start) + 1)))))/ sum(m.weight) * 100,
    sum(m.weight * m.progress_percent) / sum(m.weight)
  into planned_today, actual_today
  from milestones m
  where m.project_id = project_id;

  deficit := greatest(0, planned_today - actual_today);

  insert into progress_snapshots (project_id, captured_on, planned_percent, actual_percent)
  select
    project_id,
    start_date + d,
    round(p.pct, 2),
    round(greatest(0, least(100,
      p.pct - case when d <= 130 then 0
                   else deficit * power(least(1, (d - 130)::numeric / 102), 0.7) end
    )), 2)
  from generate_series(0, 232, 7) as d
  cross join lateral (
    select sum(m.weight * least(1, greatest(0,
             (((start_date + d) - m.planned_start + 1)::numeric /
              ((m.planned_end - m.planned_start) + 1)))))/ sum(m.weight) * 100 as pct
    from milestones m
    where m.project_id = project_id
  ) p
  on conflict (project_id, captured_on) do nothing;

  -- ---- Weather log --------------------------------------------------------
  insert into weather_log (project_id, observed_on, condition, temp_c,
                           precipitation_mm, wind_kph, work_impact, hours_lost)
  select
    project_id,
    current_date - d,
    case when (d between 84 and 102) and random() < 0.55 then 'Heavy rain'
         when (d between 84 and 102) then 'Light rain'
         when random() < 0.45 then 'Clear'
         when random() < 0.70 then 'Partly cloudy'
         when random() < 0.85 then 'Overcast'
         when random() < 0.95 then 'Light rain'
         else 'Heavy rain' end,
    round((14 + random() * 18)::numeric, 1),
    round((random() * 20)::numeric, 1),
    round((6 + random() * 30)::numeric, 1),
    'none',
    0
  from generate_series(0, 120) as d
  on conflict (project_id, observed_on) do nothing;

  -- Derive the impact from the condition, so the two can never disagree.
  update weather_log
  set work_impact = case condition
        when 'Heavy rain' then 'full'::weather_impact
        when 'Storm' then 'full'::weather_impact
        when 'Light rain' then 'partial'::weather_impact
        else 'none'::weather_impact end,
      hours_lost = case condition
        when 'Heavy rain' then 8
        when 'Storm' then 8
        when 'Light rain' then 3
        else 0 end
  where weather_log.project_id = project_id;

  -- ---- Documents ----------------------------------------------------------
  insert into documents (project_id, name, category, storage_path, mime_type,
                         size_bytes, uploaded_by, issued_at, requires_ack, is_confidential)
  values
    (project_id, 'Building permit -- BP-2025-4471', 'permit', project_id || '/documents/permit.pdf', 'application/pdf', 2411000, builder_id, start_date, false, false),
    (project_id, 'Architectural drawings -- Rev C', 'blueprint', project_id || '/documents/drawings-rev-c.pdf', 'application/pdf', 18204000, builder_id, current_date - 14, false, false),
    (project_id, 'Construction contract (executed)', 'contract', project_id || '/documents/contract.pdf', 'application/pdf', 1842000, builder_id, start_date - 20, true, false),
    (project_id, 'Slab cube test certificate', 'certificate', project_id || '/documents/cube-test.pdf', 'application/pdf', 428000, builder_id, current_date - 128, false, false),
    (project_id, 'Roof inspection certificate', 'certificate', project_id || '/documents/roof-cert.pdf', 'application/pdf', 512000, builder_id, current_date - 24, false, false),
    (project_id, 'Change order CO-002 -- kitchen upgrade', 'contract', project_id || '/documents/co-002.pdf', 'application/pdf', 704000, builder_id, current_date - 46, true, false),
    (project_id, 'Site insurance certificate', 'insurance', project_id || '/documents/insurance.pdf', 'application/pdf', 622000, builder_id, current_date - 1, false, false),
    (project_id, 'Subcontractor rates schedule', 'contract', project_id || '/documents/rates.pdf', 'application/pdf', 340000, builder_id, current_date - 90, false, true)
  on conflict do nothing;

  -- ---- Site updates -------------------------------------------------------
  insert into updates (project_id, author_id, title, body, status, crew_size,
                       hours_worked, weather, temperature_c, progress_delta, published_at)
  values
    (project_id, builder_id, 'Heat pump slab poured, MVHR ducting set out',
     'The condenser slab to the north elevation went in first thing and has been protected overnight. Ductwork for the heat recovery system is set out through the first floor joists and will be fixed tomorrow once the electrician has finished his runs in the same voids.',
     'in_progress', 6, 48, 'Clear', 24, 4, now() - interval '1 day'),
    (project_id, builder_id, 'Window delivery short by two units',
     'The glazing delivery arrived with the two rear dormer units missing -- the supplier has confirmed a manufacturing fault and is remaking them. Revised delivery is fourteen days out. We have sheeted both openings; this does not stop cladding on the front and side elevations.',
     'blocked', 3, 21, 'Overcast', 19, null, now() - interval '6 days'),
    (project_id, builder_id, 'Electrical first fix past the halfway mark',
     'Cable runs are complete to the whole of the ground floor and to three of the four bedrooms. Consumer unit position has moved 400mm along the utility wall to clear the MVHR unit -- architect approved on site.',
     'in_progress', 3, 24, 'Clear', 26, 12, now() - interval '9 days'),
    (project_id, builder_id, 'Roof covering complete',
     'All tiling, ridge and hip work is finished and the building is now weather-tight. This is the milestone the rest of the internal programme has been waiting on.',
     'completed', 6, 48, 'Clear', 29, 30, now() - interval '39 days')
  on conflict do nothing;

  raise notice 'Seed complete: project % with % milestones.',
    project_id, (select count(*) from milestones where milestones.project_id = project_id);
end;
$$;
