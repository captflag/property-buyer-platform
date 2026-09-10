/**
 * Database types.
 *
 * These mirror supabase/migrations/*.sql by hand. Once a Supabase project is
 * linked, `npm run db:types` regenerates this file from the live schema and
 * overwrites it -- the hand-written version exists so the app type-checks
 * before any database is provisioned.
 */

export type AppRole = "buyer" | "builder" | "admin";
export type OrgRole = "owner" | "manager" | "member";
export type ProjectRole = "buyer" | "builder" | "inspector" | "viewer";

export type ProjectStatus =
  "planning" | "in_progress" | "on_hold" | "completed" | "handed_over" | "cancelled";

export type WorkStatus = "not_started" | "in_progress" | "blocked" | "completed" | "cancelled";

export type DependencyType = "FS" | "SS" | "FF" | "SF";
export type MediaKind = "image" | "video" | "document";

export type DocumentCategory =
  | "permit"
  | "blueprint"
  | "contract"
  | "certificate"
  | "invoice"
  | "report"
  | "warranty"
  | "insurance"
  | "other";

export type PaymentStatus = "scheduled" | "due" | "invoiced" | "paid" | "overdue" | "waived";

export type DrawStatus = "draft" | "submitted" | "under_review" | "approved" | "rejected" | "paid";

export type ChangeOrderStatus = "proposed" | "approved" | "rejected" | "withdrawn";
export type InspectionResult = "pending" | "pass" | "fail" | "conditional";
export type IssueSeverity = "low" | "medium" | "high" | "critical";
export type IssueStatus = "open" | "acknowledged" | "in_progress" | "resolved" | "closed";
export type CostKind = "budget" | "committed" | "actual";
export type WeatherImpact = "none" | "partial" | "full";

export type NotificationType =
  | "update_posted"
  | "milestone_completed"
  | "milestone_delayed"
  | "document_added"
  | "document_ack_required"
  | "payment_due"
  | "payment_received"
  | "draw_decision"
  | "change_order"
  | "inspection_result"
  | "issue_raised"
  | "message";

export type AiRole = "user" | "assistant" | "system";

/** A palette slot, 1-8. Never generated, never cycled past 8. */
export type ColourSlot = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: AppRole;
  locale: string;
  timezone: string;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  status: ProjectStatus;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
  /** IANA zone of the site. Visits are booked in the site's wall-clock time. */
  timezone: string;
  latitude: number | null;
  longitude: number | null;
  start_date: string | null;
  target_completion_date: string | null;
  actual_completion_date: string | null;
  handover_date: string | null;
  contract_value: number;
  currency: string;
  unit_type: string | null;
  floor_area_sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  plot_area_sqft: number | null;
  contractor_name: string | null;
  architect_name: string | null;
  site_manager_name: string | null;
  site_manager_phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  project_id: string;
  user_id: string;
  role: ProjectRole;
  is_primary: boolean;
  /** Set when the member marks the project as caught up -- not on page view. */
  last_seen_at: string | null;
  created_at: string;
}

export interface Phase {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  sequence: number;
  weight: number;
  colour_slot: ColourSlot;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  status: WorkStatus;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: string;
  project_id: string;
  phase_id: string | null;
  name: string;
  description: string | null;
  sequence: number;
  weight: number;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  progress_percent: number;
  status: WorkStatus;
  is_critical: boolean;
  payment_percent: number;
  created_at: string;
  updated_at: string;
}

export interface MilestoneDependency {
  predecessor_id: string;
  successor_id: string;
  type: DependencyType;
  lag_days: number;
}

export interface Update {
  id: string;
  project_id: string;
  milestone_id: string | null;
  author_id: string;
  title: string;
  body: string;
  status: WorkStatus;
  progress_delta: number | null;
  crew_size: number | null;
  hours_worked: number | null;
  weather: string | null;
  temperature_c: number | null;
  is_published: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export interface UpdateMedia {
  id: string;
  update_id: string;
  project_id: string;
  storage_path: string;
  kind: MediaKind;
  caption: string | null;
  width: number | null;
  height: number | null;
  sort: number;
  created_at: string;
}

export interface ProjectDocument {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  category: DocumentCategory;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  version: number;
  supersedes_id: string | null;
  uploaded_by: string | null;
  issued_at: string | null;
  expires_at: string | null;
  requires_ack: boolean;
  is_confidential: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentAcknowledgement {
  document_id: string;
  user_id: string;
  acknowledged_at: string;
  signature_name: string | null;
}

export interface BudgetCategory {
  id: string;
  project_id: string;
  name: string;
  code: string | null;
  budgeted_amount: number;
  sequence: number;
  colour_slot: ColourSlot;
  created_at: string;
}

export interface CostEntry {
  id: string;
  project_id: string;
  category_id: string | null;
  milestone_id: string | null;
  description: string;
  amount: number;
  kind: CostKind;
  incurred_on: string;
  vendor: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  project_id: string;
  milestone_id: string | null;
  name: string;
  sequence: number;
  amount: number;
  percent_of_contract: number | null;
  due_date: string | null;
  status: PaymentStatus;
  paid_at: string | null;
  invoice_number: string | null;
  method: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DrawRequest {
  id: string;
  project_id: string;
  milestone_id: string | null;
  payment_id: string | null;
  reference: string;
  amount: number;
  status: DrawStatus;
  justification: string | null;
  requested_by: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  decided_by: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChangeOrder {
  id: string;
  project_id: string;
  number: string;
  title: string;
  description: string | null;
  cost_delta: number;
  schedule_delta_days: number;
  status: ChangeOrderStatus;
  requested_by: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Inspection {
  id: string;
  project_id: string;
  milestone_id: string | null;
  name: string;
  authority: string | null;
  inspector_name: string | null;
  scheduled_for: string | null;
  completed_at: string | null;
  result: InspectionResult;
  notes: string | null;
  certificate_document_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Issue {
  id: string;
  project_id: string;
  milestone_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  severity: IssueSeverity;
  status: IssueStatus;
  reported_by: string | null;
  assigned_to: string | null;
  due_date: string | null;
  resolved_at: string | null;
  room: string | null;
  photo_paths: string[];
  /** True for snags raised by the buyer rather than logged by the build team. */
  raised_by_buyer: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProgressSnapshot {
  id: string;
  project_id: string;
  captured_on: string;
  planned_percent: number;
  actual_percent: number;
  note: string | null;
  created_at: string;
}

export interface WeatherLogEntry {
  id: string;
  project_id: string;
  observed_on: string;
  condition: string;
  temp_c: number | null;
  precipitation_mm: number | null;
  wind_kph: number | null;
  work_impact: WeatherImpact;
  hours_lost: number;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  project_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface ActivityLogEntry {
  id: string;
  project_id: string | null;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface AiConversation {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AiCitation {
  kind: "milestone" | "update" | "document" | "payment" | "issue" | "project" | "selection";
  id: string;
  label: string;
}

export interface AiMessage {
  id: string;
  conversation_id: string;
  role: AiRole;
  content: string;
  citations: AiCitation[];
  token_count: number | null;
  created_at: string;
}

/** Return shape of the project_health() SQL function. */
export interface ProjectHealth {
  progress_percent: number;
  planned_percent: number;
  schedule_variance: number;
  budget_total: number;
  spent_total: number;
  committed_total: number;
  cost_variance: number;
  open_issues: number;
  critical_issues: number;
  overdue_payments: number;
  days_remaining: number | null;
}

/* -------------------------------------------------------------------------- */
/* Buyer experience (migration 20260101000400)                                */
/* -------------------------------------------------------------------------- */

export type SelectionStatus = "open" | "chosen" | "confirmed" | "locked";

export interface SelectionCategory {
  id: string;
  project_id: string;
  milestone_id: string | null;
  name: string;
  room: string | null;
  description: string | null;
  sequence: number;
  /** Explicit override. When null, derived from the milestone and lead times. */
  decision_deadline: string | null;
  buffer_days: number;
  status: SelectionStatus;
  chosen_option_id: string | null;
  chosen_by: string | null;
  chosen_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SelectionOption {
  id: string;
  category_id: string;
  project_id: string;
  name: string;
  description: string | null;
  supplier: string | null;
  finish: string | null;
  /** Relative to the standard option, which is 0 by definition. */
  price_delta: number;
  lead_time_days: number;
  is_standard: boolean;
  image_path: string | null;
  swatch: string | null;
  sequence: number;
  created_at: string;
}

export type DiscussionSubject =
  "milestone" | "update" | "document" | "selection" | "issue" | "payment" | "photo" | "general";

export type DiscussionStatus = "open" | "answered" | "closed";

export interface Discussion {
  id: string;
  project_id: string;
  subject_kind: DiscussionSubject;
  subject_id: string | null;
  subject_label: string | null;
  title: string;
  status: DiscussionStatus;
  created_by: string | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

export interface DiscussionMessage {
  id: string;
  discussion_id: string;
  project_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

export type SiteVisitStatus = "requested" | "confirmed" | "declined" | "cancelled" | "completed";

export interface SiteVisit {
  id: string;
  project_id: string;
  requested_by: string | null;
  starts_at: string;
  duration_minutes: number;
  purpose: string;
  attendees: number;
  notes: string | null;
  status: SiteVisitStatus;
  builder_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface MoveTask {
  id: string;
  project_id: string;
  user_id: string;
  /** Set for tasks from the built-in plan; null for tasks the buyer added. */
  template_key: string | null;
  title: string | null;
  category: string | null;
  days_before: number | null;
  done_at: string | null;
  created_at: string;
}
