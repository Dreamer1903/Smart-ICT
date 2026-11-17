// Тонкая типизированная обёртка над fetch. JWT хранится в localStorage.
import type {
  AttendanceReport, Enrollment, ImportReport, GuardianIn, StaffNotification, StepKind, StudentCard,
  AccessDecision, AccessDecisionResult, AccessEventRow, AccessSummary, CredentialKind, Debtor, HikStatus, PaymentCheckResult,
  GateDirection, GatePassResult, LivePulse, NurseOutcome, NurseVisit, SchoolClass, Student, Token, User,
} from "./types";

const BASE = "/api/v1";
const TOKEN_KEY = "school-os.token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch { /* тело не JSON */ }
    if (res.status === 401) tokenStore.clear();
    throw new ApiError(res.status, detail);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== null && v !== "" && s.set(k, String(v)));
  const str = s.toString();
  return str ? `?${str}` : "";
};

export const api = {
  login: (email: string, password: string) =>
    request<Token>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => request<User>("/auth/me"),

  classes: () => request<SchoolClass[]>("/classes"),
  students: (p: { search?: string; class_id?: number | null; limit?: number } = {}) => request<Student[]>(`/students${qs(p)}`),

  nurseVisits: (active?: boolean) => request<NurseVisit[]>(`/nurse/visits${qs({ active })}`),
  createVisit: (student_id: number, reason: string, notes?: string) =>
    request<NurseVisit>("/nurse/visits", { method: "POST", body: JSON.stringify({ student_id, reason, notes }) }),
  updateVisit: (id: number, outcome: NurseOutcome) =>
    request<NurseVisit>(`/nurse/visits/${id}`, { method: "PATCH", body: JSON.stringify({ outcome }) }),

  livePulse: () => request<LivePulse>("/dashboard/live-pulse"),
  gatePass: (student_id: number, direction: GateDirection) =>
    request<GatePassResult>("/gate/pass", {
      method: "POST",
      body: JSON.stringify({ student_id, direction, gate_id: "ui-simulator" }),
    }),
  classCheck: (class_id: number, present_student_ids: number[]) =>
    request("/attendance/class-check", { method: "POST", body: JSON.stringify({ class_id, present_student_ids }) }),

  // Контроль доступа
  accessEvent: (body: {
    device_code: string; direction: GateDirection; credential_kind?: CredentialKind; credential_value?: string; student_id?: number;
  }) => request<AccessDecisionResult>("/access/events", { method: "POST", body: JSON.stringify(body) }),
  accessEvents: (p: { decision?: AccessDecision; limit?: number } = {}) => request<AccessEventRow[]>(`/access/events${qs(p)}`),
  accessSummary: () => request<AccessSummary>("/access/summary"),
  debtors: () => request<Debtor[]>("/access/debtors"),
  createOverride: (student_id: number, reason: string, hours = 24) =>
    request("/access/overrides", { method: "POST", body: JSON.stringify({ student_id, reason, hours }) }),
  revokeOverride: (id: number) => request(`/access/overrides/${id}`, { method: "DELETE" }),
  paymentCheck: (student_id: number) =>
    request<PaymentCheckResult>(`/access/students/${student_id}/payment-check`, { method: "POST" }),

  hikStatus: () => request<HikStatus>("/integrations/hikcentral/status"),

  // Приём учеников
  enrollments: (p: { state?: "active" | "completed" | "cancelled" | "all"; mine?: boolean } = {}) =>
    request<Enrollment[]>(`/enrollments${qs(p)}`),
  createEnrollment: (body: { full_name: string; class_id: number; birth_date?: string | null; notes?: string | null; guardians: GuardianIn[] }) =>
    request<Enrollment>("/enrollments", { method: "POST", body: JSON.stringify(body) }),
  completeStep: (id: number, kind: StepKind, data: Record<string, unknown>, comment?: string) =>
    request<Enrollment>(`/enrollments/${id}/steps/${kind}/complete`, { method: "POST", body: JSON.stringify({ data, comment }) }),

  // Карточка ученика и отчёты
  studentCard: (id: number) => request<StudentCard>(`/students/${id}/card`),
  updateStudent: (id: number, body: Record<string, unknown>) =>
    request<StudentCard>(`/students/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  attendance: (p: { date?: string; class_id?: number | null } = {}) => request<AttendanceReport>(`/reports/attendance${qs(p)}`),

  importStudents: (file: File, dryRun: boolean) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<ImportReport>(`/students/import?dry_run=${dryRun}`, { method: "POST", body: fd });
  },

  // Уведомления сотрудникам
  notifications: () => request<{ unread: number; items: StaffNotification[] }>("/notifications"),
  readNotification: (id: number) => request<void>(`/notifications/${id}/read`, { method: "POST" }),
  readAllNotifications: () => request<void>("/notifications/read-all", { method: "POST" }),

  // Симулятор 1С (только dev: vite проксирует /sim → :8010)
  simPay: async (account: string) => {
    const r = await fetch("/sim/1c/admin/pay", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account }),
    });
    if (!r.ok) throw new ApiError(r.status, "Симулятор 1С недоступен (uvicorn simulators.app:app --port 8010)");
    return r.json();
  },

  streamUrl: () => `${BASE}/dashboard/stream?token=${encodeURIComponent(tokenStore.get() ?? "")}`,
};
