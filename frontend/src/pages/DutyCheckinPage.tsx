// Открывается при сканировании QR-кода на посту: отмечает, что учитель приступил к дежурству.
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { http } from "@/lib/api";
import { formatTime } from "@/lib/utils";
import type { Duty } from "@/pages/DutyPage";

export function DutyCheckinPage() {
  const { token } = useParams();
  const [state, setState] = useState<{ ok: boolean; duty?: Duty; error?: string } | null>(null);
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || !token) return;  // StrictMode вызывает эффект дважды
    sent.current = true;
    http.post<Duty>("/duty/checkin", { token }).then((duty) => setState({ ok: true, duty }))
      .catch((e) => setState({ ok: false, error: e instanceof Error ? e.message : "Ошибка" }));
  }, [token]);

  return (
    <div className="flex min-h-[70dvh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 py-10 text-center">
          {!state && <><Loader2 className="mx-auto size-12 animate-spin text-indigo-600" /><p>Отмечаю начало дежурства…</p></>}
          {state?.ok && state.duty && (
            <>
              <CheckCircle2 className="mx-auto size-16 text-emerald-600" />
              <div className="text-2xl font-bold">Дежурство начато</div>
              <div className="text-lg">{state.duty.post_name} · {state.duty.shift_name}</div>
              <div className="text-slate-600">Смена {state.duty.start_time}–{state.duty.end_time} · отметка в {formatTime(state.duty.checked_in_at)}</div>
              {state.duty.late_minutes ? <div className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">Опоздание {state.duty.late_minutes} мин</div> : null}
            </>
          )}
          {state && !state.ok && (
            <>
              <XCircle className="mx-auto size-16 text-rose-600" />
              <div className="text-xl font-bold">Не удалось отметиться</div>
              <div className="text-slate-700">{state.error}</div>
            </>
          )}
          <Link to="/duty"><Button variant="outline" className="mt-2">Мои дежурства</Button></Link>
        </CardContent>
      </Card>
    </div>
  );
}
