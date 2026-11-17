// Типы, зеркалирующие Pydantic-схемы backend/app/schemas

export type UserRole =
  | "SuperAdmin" | "Director" | "Zavuch" | "Teacher" | "Nurse" | "DutyTeacher"
  | "ParentRelations" | "Admissions" | "Cashier";
export type LocationStatus = "IN_BUILDING" | "IN_CLASS" | "IN_NURSE" | "IN_BOARDING" | "LEFT_SCHOOL" | "UNKNOWN";
export type StudentStatus = "ENROLLING" | "ACTIVE" | "WITHDRAWN";
export type NurseOutcome = "RESTING" | "SENT_HOME" | "RETURNED_TO_CLASS";
export type GateDirection = "IN" | "OUT";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  phone: string | null;
}

export interface Token {
  access_token: string;
  token_type: string;
  user: User;
}

export interface SchoolClass {
  id: number;
  name: string;
  grade_level: number;
  student_count: number;
}

export interface Student {
  id: number;
  full_name: string;
  class_id: number;
  class_name: string;
  rfid_card_id: string | null;
  parent_phone: string | null;
  status: LocationStatus;
  student_status: StudentStatus;
  is_boarder: boolean | null;
}

export interface NurseVisit {
  id: number;
  student_id: number;
  student_name: string;
  class_name: string;
  nurse_id: number | null;
  start_time: string;
  end_time: string | null;
  reason: string;
  outcome: NurseOutcome;
  notes: string | null;
  is_active: boolean;
  student_status: LocationStatus;
}

export interface PulseCounters {
  total_students: number;
  in_building: number;
  in_class: number;
  in_nurse: number;
  in_boarding: number;
  not_reached_class: number;
  discrepancies: number;
  left_school: number;
  not_arrived: number;
}

export interface ClassPulse {
  class_id: number;
  class_name: string;
  total: number;
  in_class: number;
  in_nurse: number;
  not_reached_class: number;
  in_boarding: number;
  absent: number;
}

export interface StudentLiveRow {
  student_id: number;
  full_name: string;
  class_id: number;
  class_name: string;
  status: LocationStatus;
  is_discrepancy: boolean;
  reason: string;
  since: string | null;
  last_gate_direction: GateDirection | null;
  last_gate_at: string | null;
  active_nurse_visit_id: number | null;
  is_boarder: boolean;
}

export interface LivePulse {
  generated_at: string;
  counters: PulseCounters;
  classes: ClassPulse[];
  students: StudentLiveRow[];
}

export interface GatePassResult {
  log_id: number;
  student_id: number;
  direction: GateDirection;
  timestamp: string;
  applied: boolean;
  status: LocationStatus;
  is_discrepancy: boolean;
}

export interface DomainEvent {
  type: string;
  payload: Record<string, unknown>;
  occurred_at: string;
}

// ---------------- Контроль доступа
export type AccessDecision = "GRANTED" | "DENIED";
export type CredentialKind = "RFID" | "QR" | "BIOMETRIC";

export interface AccessDecisionResult {
  event_id: number;
  decision: AccessDecision;
  reason: string;
  command: "OPEN" | "DENY";
  display_text: string | null;
  student_id: number | null;
  student_name: string | null;
  class_name: string | null;
  latency_ms: number | null;
  command_status: string | null;
}

export interface AccessEventRow {
  id: number;
  occurred_at: string;
  device_code: string | null;
  device_name: string | null;
  student_id: number | null;
  student_name: string | null;
  class_name: string | null;
  credential_kind: CredentialKind | null;
  credential_value: string | null;
  direction: GateDirection;
  decision: AccessDecision;
  reason: string;
  reason_label: string;
  debt_amount: number | null;
  payment_source: string | null;
  latency_ms: number | null;
  command_status: string | null;
}

export interface Debtor {
  student_id: number;
  full_name: string;
  class_name: string;
  external_1c_id: string | null;
  debt_amount: number;
  currency: string;
  paid_until: string | null;
  checked_at: string;
  last_error: string | null;
  override_id: number | null;
  override_until: string | null;
  denied_today: number;
  hik_person_id: string | null;
  hik_full_access: boolean | null;
  hik_pending: boolean | null;
  hik_error: string | null;
}

export interface HikStatus {
  enabled: boolean;
  enforce: boolean;
  event_mode: string;
  full_access_group_id: string;
  exit_only_group_id: string;
  linked_students: number;
  total_students: number;
  would_revoke: number;
  would_grant: number;
  queued: number;
  last_event_cursor: string | null;
  seen_event_types: Record<string, number>;
}

export interface IntegrationHealth {
  name: string;
  healthy: boolean | null;
  last_ok_at: string | null;
  last_error_at: string | null;
  last_error: string | null;
  calls: number;
  errors: number;
}

export interface Device {
  id: number;
  code: string;
  name: string;
  location: string | null;
  adapter: "RESPONSE" | "HTTP" | "WEBSOCKET" | "TCP" | "HIKCENTRAL";
  command_url: string | null;
  is_active: boolean;
  last_seen_at: string | null;
  connected: boolean;
}

export interface AccessSummary {
  entries: number;
  exits: number;
  denied: number;
  denied_debt: number;
  unknown_credentials: number;
  debtors: number;
  active_overrides: number;
  outbox_pending: number;
  outbox_failed: number;
  avg_latency_ms: number | null;
  integrations: IntegrationHealth[];
  devices: Device[];
}

export interface PaymentCheckResult {
  student_id: number;
  has_debt: boolean | null;
  debt_amount: number | null;
  source: string;
  error: string | null;
  reopened_event_id: number | null;
}

// ---------------- Приём учеников и карточка
export type StepKind = "REGISTRATION" | "PAYMENT_SETUP" | "CLASS_ACCEPTANCE" | "ACCESS_SETUP";

export interface EnrollmentStep {
  kind: StepKind;
  label: string;
  status: "PENDING" | "DONE";
  assignee_role: UserRole;
  assignee_name: string | null;
  completed_by_name: string | null;
  completed_at: string | null;
  comment: string | null;
  data: Record<string, unknown> | null;
  can_complete: boolean;
}

export interface Enrollment {
  id: number;
  status: "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  created_at: string;
  completed_at: string | null;
  created_by_name: string | null;
  student: { id: number; full_name: string; class_id: number; class_name: string; birth_date: string | null; status: StudentStatus };
  steps: EnrollmentStep[];
  done_steps: number;
  total_steps: number;
  my_pending: boolean;
}

export interface GuardianIn {
  full_name: string;
  relation?: string | null;
  phone?: string | null;
  telegram_chat_id?: string | null;
  is_primary?: boolean;
}

export interface Guardian extends GuardianIn { id: number }

export interface StudentCard {
  id: number;
  full_name: string;
  status: StudentStatus;
  class_id: number;
  class_name: string;
  homeroom_teacher: string | null;
  birth_date: string | null;
  admission_date: string | null;
  is_boarder: boolean | null;
  boarding_room: string | null;
  notes: string | null;
  external_1c_id: string | null;
  hik_person_id: string | null;
  rfid_card_id: string | null;
  guardians: Guardian[];
  presence_status: LocationStatus;
  presence_note: string | null;
  presence_since: string | null;
  is_discrepancy: boolean;
  payment: { has_debt: boolean; debt_amount: number; currency: string; paid_until: string | null; checked_at: string } | null;
  enrollment: Enrollment | null;
  history: { date: string; first_in: string | null; last_out: string | null; passes: number; late: boolean }[];
  recent_events: { occurred_at: string; direction: GateDirection; decision: string; reason_label: string; device_name: string | null }[];
  nurse_visits: { start_time: string; end_time: string | null; reason: string; outcome: NurseOutcome }[];
  timeline: { at: string; kind: string; text: string; actor_name: string | null }[];
}

export interface StaffNotification {
  id: number;
  created_at: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
}

export interface AttendanceRow {
  student_id: number;
  full_name: string;
  class_id: number;
  class_name: string;
  is_boarder: boolean;
  first_in: string | null;
  last_out: string | null;
  passes: number;
  denied: number;
  late: boolean;
  came: boolean;
}

export interface AttendanceReport {
  date: string;
  school_start_time: string;
  summary: { total: number; came: number; late: number; absent: number; boarders: number };
  rows: AttendanceRow[];
}
