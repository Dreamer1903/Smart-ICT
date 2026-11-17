import { Activity, ChevronDown, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn, homePathFor } from "@/lib/utils";

// Демо-учётки из backend/seed.py — сгруппированы и спрятаны под раскрывающимися заголовками
const DEMO: { group: string; roles: { email: string; label: string }[] }[] = [
  { group: "Администрация", roles: [
    { email: "director@school.uz", label: "Директор" }, { email: "zavuch@school.uz", label: "Завуч" },
    { email: "academic@school.uz", label: "Завуч по учебной части" }, { email: "upbringing@school.uz", label: "Завуч по воспитательной части" },
    { email: "admin@school.uz", label: "Администратор системы" }] },
  { group: "Сотрудники", roles: [
    { email: "teacher@school.uz", label: "Учитель (кл. руководитель)" }, { email: "nurse@school.uz", label: "Медсестра" },
    { email: "parents@school.uz", label: "Завуч по работе с родителями" }, { email: "manager@school.uz", label: "Менеджер приёма" },
    { email: "cashier@school.uz", label: "Кассир" }, { email: "duty@school.uz", label: "Дежурный учитель" }] },
  { group: "Ученики и родители", roles: [
    { email: "student@school.uz", label: "Ученик" }, { email: "parent@school.uz", label: "Родитель" }] },
];

export function LoginPage() {
  const { login, loginGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  async function run(fn: () => Promise<{ role: Parameters<typeof homePathFor>[0] }>) {
    setBusy(true);
    setError(null);
    try {
      const user = await fn();
      navigate(homePathFor(user.role), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setBusy(false);
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void run(() => login(email, password));
  };

  return (
    <div className="flex min-h-dvh items-start justify-center bg-gradient-to-br from-indigo-50 via-white to-sky-50 px-4 py-8 sm:items-center">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-5 p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-600 text-white"><Activity className="size-5" /></div>
            <div>
              <h1 className="text-lg font-bold">School OS</h1>
              <p className="text-xs text-slate-500">Учёт, расписание, журнал и безопасность школы</p>
            </div>
          </div>
          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Email</span>
              <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Пароль</span>
              <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            {error && <p className="whitespace-pre-line rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} Войти
            </Button>
          </form>

          <GoogleSignIn disabled={busy} onCredential={(credential) => void run(() => loginGoogle(credential))} />

          <div className="rounded-lg border border-slate-200">
            <button type="button" onClick={() => setDemoOpen((v) => !v)}
              className="flex w-full cursor-pointer items-center justify-between px-3 py-2.5 text-sm font-medium text-slate-700">
              Демо-доступ <span className="flex items-center gap-1 text-xs font-normal text-slate-400">пароль school123 <ChevronDown className={cn("size-4 transition-transform", demoOpen && "rotate-180")} /></span>
            </button>
            {demoOpen && (
              <div className="divide-y divide-slate-100 border-t border-slate-100">
                {DEMO.map((g) => (
                  <div key={g.group}>
                    <button type="button" onClick={() => setOpenGroup(openGroup === g.group ? null : g.group)}
                      className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50">
                      {g.group} <span className="flex items-center gap-1 text-xs text-slate-400">{g.roles.length} <ChevronDown className={cn("size-3.5 transition-transform", openGroup === g.group && "rotate-180")} /></span>
                    </button>
                    {openGroup === g.group && (
                      <div className="grid gap-1.5 px-3 pb-3">
                        {g.roles.map((d) => (
                          <Button key={d.email} variant="outline" size="sm" className="justify-start" disabled={busy}
                            onClick={() => void run(() => login(d.email, "school123"))}>{d.label}</Button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
