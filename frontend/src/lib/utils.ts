import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { LocationStatus, NurseOutcome, UserRole } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—";

export function minutesAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  return `${Math.floor(m / 60)} ч ${m % 60} мин назад`;
}

export const STATUS_META: Record<LocationStatus, { label: string; className: string }> = {
  IN_CLASS: { label: "На уроке", className: "bg-emerald-100 text-emerald-800 ring-emerald-600/20" },
  IN_NURSE: { label: "В медпункте", className: "bg-sky-100 text-sky-800 ring-sky-600/20" },
  IN_BOARDING: { label: "В пансионате", className: "bg-violet-100 text-violet-800 ring-violet-600/20" },
  IN_BUILDING: { label: "В здании", className: "bg-amber-100 text-amber-800 ring-amber-600/20" },
  LEFT_SCHOOL: { label: "Ушёл", className: "bg-slate-200 text-slate-700 ring-slate-500/20" },
  UNKNOWN: { label: "Не пришёл", className: "bg-rose-50 text-rose-700 ring-rose-600/20" },
};

export const OUTCOME_LABEL: Record<NurseOutcome, string> = {
  RESTING: "На осмотре",
  SENT_HOME: "Освобождён / Домой",
  RETURNED_TO_CLASS: "Вернулся на урок",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  SuperAdmin: "Администратор",
  Director: "Директор",
  Zavuch: "Завуч",
  Teacher: "Учитель",
  Nurse: "Медсестра",
  DutyTeacher: "Дежурный учитель",
  ParentRelations: "Завуч по работе с родителями",
  Admissions: "Менеджер по приёму",
  Cashier: "Кассир",
  ZavuchAcademic: "Завуч по учебной части",
  ZavuchUpbringing: "Завуч по воспитательной части",
  Student: "Ученик",
  Parent: "Родитель",
};

export const PULSE_ROLES: UserRole[] = ["SuperAdmin", "Director", "Zavuch", "ZavuchAcademic", "ZavuchUpbringing", "DutyTeacher"];
export const FAMILY_ROLES: UserRole[] = ["Student", "Parent"];
export const STAFF_ROLES: UserRole[] = ["SuperAdmin", "Director", "Zavuch", "ZavuchAcademic", "ZavuchUpbringing", "Teacher", "Nurse",
  "DutyTeacher", "ParentRelations", "Admissions", "Cashier"];
export const TT_MANAGER_ROLES: UserRole[] = ["SuperAdmin", "ZavuchAcademic", "Zavuch"];
export const TT_OVERSIGHT_ROLES: UserRole[] = [...TT_MANAGER_ROLES, "Director", "ZavuchUpbringing"];
export const JOURNAL_ROLES: UserRole[] = ["SuperAdmin", "Director", "Zavuch", "ZavuchAcademic", "ZavuchUpbringing", "Teacher"];
export const DAY_NAMES: Record<number, string> = { 1: "Пн", 2: "Вт", 3: "Ср", 4: "Чт", 5: "Пт", 6: "Сб", 7: "Вс" };
export const ACCESS_ROLES: UserRole[] = ["SuperAdmin", "Director", "Zavuch"];
export const ENROLLMENT_ROLES: UserRole[] = ["SuperAdmin", "Director", "Zavuch", "ZavuchAcademic", "ZavuchUpbringing", "ParentRelations", "Admissions", "Cashier", "Teacher"];
export const REGISTRAR_ROLES: UserRole[] = ["SuperAdmin", "Director", "Zavuch", "ParentRelations", "Admissions"];
export const REPORT_ROLES: UserRole[] = ["SuperAdmin", "Director", "Zavuch", "ZavuchAcademic", "ZavuchUpbringing", "ParentRelations", "Teacher", "DutyTeacher"];
export const NURSE_ROLES: UserRole[] = ["SuperAdmin", "Nurse"];

export const homePathFor = (role: UserRole) =>
  FAMILY_ROLES.includes(role) ? "/diary"
    : role === "Nurse" ? "/nurse"
      : role === "Teacher" ? "/journal"
        : role === "ZavuchAcademic" ? "/schedule"
          : PULSE_ROLES.includes(role) ? "/pulse"
            : ENROLLMENT_ROLES.includes(role) ? "/enrollment" : "/students";

export const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("ru-RU") : "—";

export const formatMoney = (v: number, currency = "UZS") =>
  `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v)} ${currency === "UZS" ? "сум" : currency}`;
