import { Activity, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { homePathFor } from "@/lib/utils";

// Демо-учётки из backend/seed.py
const DEMO = [
  { email: "nurse@school.uz", label: "Медсестра" },
  { email: "director@school.uz", label: "Директор" },
  { email: "zavuch@school.uz", label: "Завуч" },
  { email: "admin@school.uz", label: "SuperAdmin" },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("director@school.uz");
  const [password, setPassword] = useState("school123");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function doLogin(e: string, p: string) {
    setBusy(true);
    setError(null);
    try {
      const user = await login(e, p);
      navigate(homePathFor(user.role), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setBusy(false);
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void doLogin(email, password);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-6 p-7">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Activity className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold">School OS</h1>
              <p className="text-xs text-slate-500">Операционный мониторинг школы</p>
            </div>
          </div>
          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Email</span>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Пароль</span>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} Войти
            </Button>
          </form>
          <div className="space-y-2">
            <p className="text-xs text-slate-500">Демо-доступ (пароль school123):</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO.map((d) => (
                <Button key={d.email} variant="outline" size="sm" disabled={busy} onClick={() => doLogin(d.email, "school123")}>
                  {d.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
