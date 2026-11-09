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
};

export const PULSE_ROLES: UserRole[] = ["SuperAdmin", "Director", "Zavuch", "DutyTeacher"];
export const ACCESS_ROLES: UserRole[] = ["SuperAdmin", "Director", "Zavuch"];
export const NURSE_ROLES: UserRole[] = ["SuperAdmin", "Nurse"];

export const homePathFor = (role: UserRole) => (role === "Nurse" ? "/nurse" : PULSE_ROLES.includes(role) ? "/pulse" : "/forbidden");

export const formatMoney = (v: number, currency = "UZS") =>
  `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v)} ${currency === "UZS" ? "сум" : currency}`;
