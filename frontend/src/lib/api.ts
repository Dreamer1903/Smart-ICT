// Тонкая типизированная обёртка над fetch. JWT хранится в localStorage.
import type {
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
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

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
  students: (p: { search?: string; class_id?: number | null } = {}) => request<Student[]>(`/students${qs(p)}`),

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

  streamUrl: () => `${BASE}/dashboard/stream?token=${encodeURIComponent(tokenStore.get() ?? "")}`,
};
