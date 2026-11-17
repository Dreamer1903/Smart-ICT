import { Activity, BookOpen, BookOpenCheck, CalendarCheck, CalendarDays, ClipboardList, HeartPulse, Library, LogOut, ShieldCheck, SlidersHorizontal, Stethoscope, Users } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { ACCESS_ROLES, cn, ENROLLMENT_ROLES, FAMILY_ROLES, JOURNAL_ROLES, NURSE_ROLES, PULSE_ROLES, REPORT_ROLES, ROLE_LABEL, STAFF_ROLES } from "@/lib/utils";
import type { UserRole } from "@/lib/types";

const EVERYONE: UserRole[] = [...STAFF_ROLES, ...FAMILY_ROLES];
const TEACHING: UserRole[] = ["Teacher", "ZavuchAcademic", "ZavuchUpbringing"];

export function Layout() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const links = [
    { to: "/diary", label: "Дневник", icon: BookOpen, roles: FAMILY_ROLES },
    { to: "/pulse", label: "Пульс", icon: HeartPulse, roles: PULSE_ROLES },
    { to: "/journal", label: "Журнал", icon: BookOpenCheck, roles: JOURNAL_ROLES },
    { to: "/schedule", label: "Расписание", icon: CalendarDays, roles: EVERYONE },
    { to: "/preferences", label: "Пожелания", icon: SlidersHorizontal, roles: TEACHING },
    { to: "/library", label: "Библиотека", icon: Library, roles: EVERYONE },
    { to: "/enrollment", label: "Приём", icon: ClipboardList, roles: ENROLLMENT_ROLES.filter((r) => r !== "Teacher") },
    { to: "/students", label: "Ученики", icon: Users, roles: STAFF_ROLES },
    { to: "/attendance", label: "Посещаемость", icon: CalendarCheck, roles: REPORT_ROLES },
    { to: "/access", label: "Доступ", icon: ShieldCheck, roles: ACCESS_ROLES },
    { to: "/nurse", label: "Медпункт", icon: Stethoscope, roles: NURSE_ROLES },
  ].filter((l) => l.roles.includes(user.role));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4">
          <div className="flex items-center gap-2 font-bold">
            <Activity className="size-5 text-indigo-600" /> School OS
          </div>
          <nav className="flex min-w-0 gap-0.5 overflow-x-auto">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium",
                    isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100",
                  )
                }
              >
                <Icon className="size-4" /> {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <NotificationBell />
            <div className="text-right leading-tight">
              <div className="font-medium">{user.full_name}</div>
              <div className="text-xs text-slate-500">{ROLE_LABEL[user.role]}</div>
            </div>
            <Button variant="ghost" size="sm" onClick={logout} title="Выйти">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
