import { Activity, HeartPulse, LogOut, Stethoscope } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { cn, NURSE_ROLES, PULSE_ROLES, ROLE_LABEL } from "@/lib/utils";

export function Layout() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const links = [
    { to: "/pulse", label: "Пульс школы", icon: HeartPulse, roles: PULSE_ROLES },
    { to: "/nurse", label: "Медпункт", icon: Stethoscope, roles: NURSE_ROLES },
  ].filter((l) => l.roles.includes(user.role));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <div className="flex items-center gap-2 font-bold">
            <Activity className="size-5 text-indigo-600" /> School OS
          </div>
          <nav className="flex gap-1">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
                    isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100",
                  )
                }
              >
                <Icon className="size-4" /> {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
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
      <main className="mx-auto max-w-7xl p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
