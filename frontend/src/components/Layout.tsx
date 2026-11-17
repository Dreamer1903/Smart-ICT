// Шапка: пункты меню сгруппированы в раскрывающиеся списки (компьютер) и «бургер»-меню (телефон/планшет).
import {
  Activity, BookOpen, CalendarClock, BookOpenCheck, CalendarCheck, CalendarDays, ChevronDown, ClipboardList, GraduationCap, HeartPulse,
  Library, LogOut, Menu, ShieldCheck, SlidersHorizontal, Stethoscope, Users, X, type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { NotificationBell } from "@/components/NotificationBell";
import type { UserRole } from "@/lib/types";
import {
  ACCESS_ROLES, cn, ENROLLMENT_ROLES, FAMILY_ROLES, JOURNAL_ROLES, NURSE_ROLES, PULSE_ROLES, REPORT_ROLES, ROLE_LABEL, STAFF_ROLES,
} from "@/lib/utils";

interface Item { to: string; label: string; icon: LucideIcon; roles: UserRole[] }
interface Group { label: string; icon: LucideIcon; items: Item[] }

const EVERYONE: UserRole[] = [...STAFF_ROLES, ...FAMILY_ROLES];
const TEACHING: UserRole[] = ["Teacher", "ZavuchAcademic", "ZavuchUpbringing"];
const DUTY_ROLES: UserRole[] = ["SuperAdmin", "Director", "Zavuch", "ZavuchAcademic", "ZavuchUpbringing", "Teacher", "DutyTeacher"];

const GROUPS: Group[] = [
  { label: "Учёба", icon: GraduationCap, items: [
    { to: "/diary", label: "Дневник", icon: BookOpen, roles: FAMILY_ROLES },
    { to: "/journal", label: "Журнал", icon: BookOpenCheck, roles: JOURNAL_ROLES },
    { to: "/schedule", label: "Расписание", icon: CalendarDays, roles: EVERYONE },
    { to: "/preferences", label: "Мои пожелания к расписанию", icon: SlidersHorizontal, roles: TEACHING },
    { to: "/library", label: "Библиотека", icon: Library, roles: EVERYONE },
  ] },
  { label: "Ученики", icon: Users, items: [
    { to: "/students", label: "Все ученики", icon: Users, roles: STAFF_ROLES },
    { to: "/enrollment", label: "Приём учеников", icon: ClipboardList, roles: ENROLLMENT_ROLES.filter((r) => r !== "Teacher") },
    { to: "/attendance", label: "Посещаемость (турникеты)", icon: CalendarCheck, roles: REPORT_ROLES },
  ] },
  { label: "Школа сейчас", icon: HeartPulse, items: [
    { to: "/pulse", label: "Пульс школы", icon: HeartPulse, roles: PULSE_ROLES },
    { to: "/access", label: "Контроль доступа", icon: ShieldCheck, roles: ACCESS_ROLES },
    { to: "/nurse", label: "Медпункт", icon: Stethoscope, roles: NURSE_ROLES },
    { to: "/duty", label: "Дежурства", icon: CalendarClock, roles: DUTY_ROLES },
  ] },
];

function visibleGroups(role: UserRole): Group[] {
  return GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) })).filter((g) => g.items.length > 0);
}

function DesktopGroup({ group }: { group: Group }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const active = group.items.some((i) => pathname.startsWith(i.to));
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (group.items.length === 1) {  // один пункт — без раскрывающегося списка
    const i = group.items[0];
    return (
      <NavLink to={i.to} className={({ isActive }) => cn("flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium",
        isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100")}>
        <i.icon className="size-4" /> {i.label}
      </NavLink>
    );
  }
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className={cn("flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium",
          active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100")}>
        <group.icon className="size-4" /> {group.label} <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          {group.items.map((i) => (
            <NavLink key={i.to} to={i.to} className={({ isActive }) => cn("flex items-center gap-2.5 px-4 py-2 text-sm",
              isActive ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-700 hover:bg-slate-50")}>
              <i.icon className="size-4 text-slate-500" /> {i.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setMobileOpen(false), [pathname]);
  if (!user) return null;
  const groups = visibleGroups(user.role);
  const initials = user.full_name.split(" ").slice(0, 2).map((w) => w[0]).join("");

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 px-3 sm:px-4">
          <button className="cursor-pointer rounded-md p-2 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen((v) => !v)} aria-label="Меню">
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <div className="flex items-center gap-2 font-bold"><Activity className="size-5 text-indigo-600" /> <span className="hidden sm:inline">School OS</span></div>
          <nav className="ml-2 hidden items-center gap-1 lg:flex">
            {groups.map((g) => <DesktopGroup key={g.label} group={g} />)}
          </nav>
          <div className="ml-auto flex items-center gap-1 text-sm sm:gap-2">
            <NotificationBell />
            <div className="hidden text-right leading-tight md:block">
              <div className="max-w-56 truncate font-medium">{user.full_name}</div>
              <div className="text-xs text-slate-500">{ROLE_LABEL[user.role]}</div>
            </div>
            <div className="flex size-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 md:hidden" title={user.full_name}>{initials}</div>
            <button onClick={logout} title="Выйти" className="cursor-pointer rounded-md p-2 text-slate-600 hover:bg-slate-100"><LogOut className="size-4" /></button>
          </div>
        </div>
        {mobileOpen && (
          <div className="max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-t border-slate-200 bg-white px-3 pb-4 lg:hidden">
            <div className="py-3 text-sm md:hidden"><div className="font-medium">{user.full_name}</div><div className="text-xs text-slate-500">{ROLE_LABEL[user.role]}</div></div>
            {groups.map((g) => (
              <div key={g.label} className="py-1">
                <div className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{g.label}</div>
                {g.items.map((i) => (
                  <NavLink key={i.to} to={i.to} className={({ isActive }) => cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px]",
                    isActive ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-700 active:bg-slate-100")}>
                    <i.icon className="size-5 text-slate-500" /> {i.label}
                  </NavLink>
                ))}
              </div>
            ))}
          </div>
        )}
      </header>
      <main className="mx-auto max-w-[1400px] px-3 py-4 sm:px-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
