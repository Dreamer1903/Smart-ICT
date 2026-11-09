// «Контроль доступа»: журнал решений турникетов, должники (1С), временные пропуска,
// проверка прохода и состояние интеграций (1С / Robi / Telegram / SMS). Live через SSE.
import {
  Ban, CircleDollarSign, Clock, CreditCard, DoorClosed, DoorOpen, Gauge, Loader2, LogIn, LogOut, Radio,
  RefreshCw, ShieldCheck, ShieldX, Ticket, Wallet,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { useLiveEvents } from "@/hooks/useLiveEvents";
import { api } from "@/lib/api";
import type {
  AccessDecisionResult, AccessEventRow, AccessSummary, CredentialKind, Debtor, GateDirection, IntegrationHealth, Student,
} from "@/lib/types";
import { cn, formatMoney, formatTime, minutesAgo } from "@/lib/utils";

const INTEGRATION_LABEL: Record<string, string> = { "1c": "1С (оплата)", robi: "Robi (посещаемость)", telegram: "Telegram", sms: "SMS-шлюз" };
const ADAPTER_LABEL: Record<string, string> = { RESPONSE: "REST (ответ)", HTTP: "HTTP-команда", WEBSOCKET: "WebSocket", TCP: "TCP" };

function Kpi({ icon: Icon, label, value, hint, tone }: {
  icon: ComponentType<{ className?: string }>; label: string; value: string | number; hint?: string; tone: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className={cn("rounded-md p-1.5", tone)}><Icon className="size-4" /></span>
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums">{value}</div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}

function HealthDot({ h }: { h: IntegrationHealth }) {
  const color = h.healthy === null ? "bg-slate-300" : h.healthy ? "bg-emerald-500" : "bg-rose-500";
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", color)} />
      <div className="min-w-0">
        <div className="font-medium">{INTEGRATION_LABEL[h.name] ?? h.name}</div>
        <div className="truncate text-xs text-slate-500" title={h.last_error ?? ""}>
          {h.healthy === null ? "обращений ещё не было"
            : h.healthy ? `OK · ${minutesAgo(h.last_ok_at)}` : `Ошибка: ${h.last_error}`}
        </div>
      </div>
    </div>
  );
}

export function AccessPage() {
  const [summary, setSummary] = useState<AccessSummary | null>(null);
  const [events, setEvents] = useState<AccessEventRow[]>([]);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [onlyDenied, setOnlyDenied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const load = useCallback(async () => {
    const [s, e, d] = await Promise.all([
      api.accessSummary(), api.accessEvents({ decision: onlyDenied ? "DENIED" : undefined, limit: 60 }), api.debtors(),
    ]);
    setSummary(s); setEvents(e); setDebtors(d);
  }, [onlyDenied]);

  useEffect(() => { void load(); const t = setInterval(() => void load(), 30_000); return () => clearInterval(t); }, [load]);

  const connected = useLiveEvents(useCallback((e) => {
    if (e.type === "access.decision" || e.type === "payment.changed") {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void load(), 250);
    }
  }, [load]));

  const flash = (ok: boolean, text: string) => { setToast({ ok, text }); setTimeout(() => setToast(null), 4000); };

  async function run(key: string, fn: () => Promise<unknown>, okText: string) {
    setBusy(key);
    try { await fn(); flash(true, okText); await load(); }
    catch (err) { flash(false, err instanceof Error ? err.message : "Ошибка"); }
    finally { setBusy(null); }
  }

  if (!summary) return <div className="flex h-64 items-center justify-center text-slate-500">Загрузка…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><ShieldCheck className="size-6 text-indigo-600" /> Контроль доступа</h1>
          <p className="text-sm text-slate-500">Турникет → контроллер → SchoolOS → 1С → решение OPEN / DENY</p>
        </div>
        <div className="flex items-center gap-2">
          {toast && (
            <span className={cn("rounded-md px-3 py-1.5 text-sm font-medium text-white shadow", toast.ok ? "bg-emerald-600" : "bg-rose-600")}>
              {toast.text}
            </span>
          )}
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
            connected ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600")}>
            <Radio className={cn("size-3.5", connected && "animate-pulse")} /> {connected ? "LIVE" : "Нет соединения"}
          </span>
          <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="size-3.5" /> Обновить</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={LogIn} label="Входы сегодня" value={summary.entries} tone="bg-emerald-100 text-emerald-700" />
        <Kpi icon={LogOut} label="Выходы сегодня" value={summary.exits} tone="bg-slate-100 text-slate-600" />
        <Kpi icon={ShieldX} label="Отказы в проходе" value={summary.denied} tone={summary.denied ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-500"}
          hint={`долг ${summary.denied_debt} · неизв. карта ${summary.unknown_credentials}`} />
        <Kpi icon={Wallet} label="Должники (1С)" value={summary.debtors} tone="bg-amber-100 text-amber-700"
          hint={summary.active_overrides ? `временных пропусков: ${summary.active_overrides}` : undefined} />
        <Kpi icon={Gauge} label="Время решения" value={summary.avg_latency_ms !== null ? `${Math.round(summary.avg_latency_ms)} мс` : "—"}
          tone="bg-indigo-100 text-indigo-700" hint="среднее за сегодня" />
        <Kpi icon={Clock} label="Очередь доставки" value={summary.outbox_pending} tone="bg-sky-100 text-sky-700"
          hint={summary.outbox_failed ? `не доставлено: ${summary.outbox_failed}` : "Robi и уведомления"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Журнал */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Журнал проходов</CardTitle>
            <div className="flex gap-1">
              {[false, true].map((v) => (
                <button key={String(v)} onClick={() => setOnlyDenied(v)}
                  className={cn("cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium",
                    onlyDenied === v ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}>
                  {v ? "Только отказы" : "Все события"}
                </button>
              ))}
            </div>
          </CardHeader>
          <div className="max-h-[560px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Время</th><th className="px-4 py-2">Ученик</th><th className="px-4 py-2">Турникет</th>
                  <th className="px-4 py-2">Решение</th><th className="px-4 py-2">Причина</th><th className="px-4 py-2 text-right">мс</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((e) => (
                  <tr key={e.id} className={cn(e.decision === "DENIED" && "bg-rose-50/50")}>
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums text-slate-600">
                      {formatTime(e.occurred_at)}
                      {e.direction === "IN" ? <LogIn className="ml-1.5 inline size-3.5 text-emerald-600" /> : <LogOut className="ml-1.5 inline size-3.5 text-slate-500" />}
                    </td>
                    <td className="px-4 py-2">
                      {e.student_name ? <><span className="font-medium">{e.student_name}</span> <span className="text-xs text-slate-500">{e.class_name}</span></>
                        : <span className="text-slate-500">{e.credential_kind}: {e.credential_value}</span>}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600">{e.device_name}</td>
                    <td className="px-4 py-2">
                      {e.decision === "GRANTED"
                        ? <Badge className="bg-emerald-100 text-emerald-800 ring-emerald-600/20"><DoorOpen className="size-3" /> OPEN</Badge>
                        : <Badge className="bg-rose-600 text-white ring-rose-700"><Ban className="size-3" /> DENY</Badge>}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {e.reason_label}
                      {e.debt_amount ? <span className="text-rose-700"> · {formatMoney(e.debt_amount)}</span> : null}
                    </td>
                    <td className="px-4 py-2 text-right text-xs tabular-nums text-slate-500">{e.latency_ms ?? "—"}</td>
                  </tr>
                ))}
                {events.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Событий нет</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <GateCheck onDone={load} />
          <Card>
            <CardHeader><CardTitle>Интеграции</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {summary.integrations.map((h) => <HealthDot key={h.name} h={h} />)}
              <div className="border-t border-slate-100 pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Контроллеры</p>
                {summary.devices.map((d) => (
                  <div key={d.code} className="flex items-center justify-between py-1 text-sm">
                    <span className="truncate">{d.name}</span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {ADAPTER_LABEL[d.adapter]}
                      {(d.adapter === "WEBSOCKET" || d.adapter === "TCP") && (d.connected ? " · онлайн" : " · нет связи")}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Должники */}
      <Card>
        <CardHeader><CardTitle>Задолженность по оплате (данные 1С)</CardTitle><span className="text-xs text-slate-500">вход блокируется, выход — никогда</span></CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Ученик</th><th className="px-4 py-2">Лицевой счёт</th><th className="px-4 py-2 text-right">Долг</th>
                <th className="px-4 py-2">Отказов сегодня</th><th className="px-4 py-2">Проверено в 1С</th><th className="px-4 py-2 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {debtors.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Должников нет</td></tr>}
              {debtors.map((d) => (
                <tr key={d.student_id}>
                  <td className="px-4 py-2.5"><span className="font-medium">{d.full_name}</span> <span className="text-xs text-slate-500">{d.class_name}</span>
                    {d.override_until && <Badge className="ml-2 bg-indigo-100 text-indigo-800 ring-indigo-600/20"><Ticket className="size-3" /> пропуск до {formatTime(d.override_until)}</Badge>}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{d.external_1c_id}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-rose-700">{formatMoney(d.debt_amount, d.currency)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{d.denied_today || "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500" title={d.last_error ?? ""}>
                    {minutesAgo(d.checked_at)}{d.last_error && <span className="text-rose-600"> · 1С недоступна</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      {d.override_id
                        ? <Button size="sm" variant="outline" disabled={busy !== null}
                            onClick={() => run(`o${d.student_id}`, () => api.revokeOverride(d.override_id!), "Пропуск отозван")}>Отозвать пропуск</Button>
                        : <Button size="sm" variant="outline" disabled={busy !== null}
                            onClick={() => run(`o${d.student_id}`, () => api.createOverride(d.student_id, "Решение администрации", 24), `${d.full_name}: пропуск на 24 ч`)}>
                            <Ticket className="size-3.5" /> Пропуск 24 ч</Button>}
                      <Button size="sm" variant="ghost" disabled={busy !== null}
                        onClick={() => run(`c${d.student_id}`, () => api.paymentCheck(d.student_id), "Статус обновлён из 1С")}>
                        {busy === `c${d.student_id}` ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} 1С
                      </Button>
                      {d.external_1c_id && (
                        <Button size="sm" variant="success" disabled={busy !== null} title="Демо: оплата в симуляторе 1С → вебхук в SchoolOS"
                          onClick={() => run(`p${d.student_id}`, () => api.simPay(d.external_1c_id!), `Оплата ${d.full_name} проведена в 1С`)}>
                          <CircleDollarSign className="size-3.5" /> Оплатить (демо)
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/** Проверка прохода: имитирует контроллер (POST /access/events) и показывает решение. */
function GateCheck({ onDone }: { onDone: () => void }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState<number | "">("");
  const [kind, setKind] = useState<CredentialKind | "UNKNOWN">("RFID");
  const [result, setResult] = useState<AccessDecisionResult | null>(null);
  const [busy, setBusy] = useState<GateDirection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.students({}).then(setStudents); }, []);

  async function send(direction: GateDirection) {
    const s = students.find((x) => x.id === studentId);
    if (kind !== "UNKNOWN" && !s) return;
    setBusy(direction); setError(null);
    try {
      const value = kind === "UNKNOWN" ? `RFID-${Math.floor(Math.random() * 9000 + 1000)}X`
        : kind === "RFID" ? s!.rfid_card_id! : `QR-${String(s!.id).padStart(4, "0")}`;
      setResult(await api.accessEvent({
        device_code: "ui-simulator", direction, credential_kind: kind === "UNKNOWN" ? "RFID" : kind, credential_value: value,
      }));
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  }

  const open = result?.command === "OPEN";
  return (
    <Card>
      <CardHeader><CardTitle>Проверка прохода</CardTitle><CreditCard className="size-4 text-slate-400" /></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Select value={studentId} onChange={(e) => setStudentId(e.target.value ? Number(e.target.value) : "")} disabled={kind === "UNKNOWN"}>
            <option value="">Ученик…</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.class_name})</option>)}
          </Select>
          <Select className="w-32" value={kind} onChange={(e) => setKind(e.target.value as CredentialKind | "UNKNOWN")}>
            <option value="RFID">RFID</option><option value="QR">QR-код</option><option value="UNKNOWN">Чужая карта</option>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="success" className="flex-1" disabled={busy !== null || (kind !== "UNKNOWN" && !studentId)} onClick={() => send("IN")}>
            {busy === "IN" ? <Loader2 className="size-4 animate-spin" /> : <DoorOpen className="size-4" />} Вход
          </Button>
          <Button variant="outline" className="flex-1" disabled={busy !== null || (kind !== "UNKNOWN" && !studentId)} onClick={() => send("OUT")}>
            {busy === "OUT" ? <Loader2 className="size-4 animate-spin" /> : <DoorClosed className="size-4" />} Выход
          </Button>
        </div>
        {error && <p className="text-xs text-rose-700">{error}</p>}
        {result && (
          <div className={cn("rounded-lg p-4 text-center text-white", open ? "bg-emerald-600" : "bg-rose-600")}>
            <div className="text-2xl font-bold tracking-wide">{result.command}</div>
            <div className="text-sm opacity-95">{result.display_text}</div>
            <div className="mt-1 text-xs opacity-80">
              {result.student_name ?? "ученик не найден"} · {result.reason} · {result.latency_ms} мс
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
