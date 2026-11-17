// Карточка ученика: вся информация в одном месте — анкета, родители, пансионат, где сейчас,
// оплата, этапы приёма, посещаемость за 14 дней, проходы, медпункт и история «кто что сделал».
import { ArrowLeft, BedDouble, History, Loader2, LogIn, LogOut, Phone, Stethoscope, Wallet } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLiveEvents } from "@/hooks/useLiveEvents";
import { api } from "@/lib/api";
import type { StudentCard } from "@/lib/types";
import { cn, formatDate, formatMoney, formatTime, minutesAgo, OUTCOME_LABEL } from "@/lib/utils";

const WEEKDAY = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <span className="text-slate-500">{label}</span><span className="text-right font-medium">{children}</span>
    </div>
  );
}

export function StudentCardPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [card, setCard] = useState<StudentCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editRoom, setEditRoom] = useState<string | null>(null);

  const load = useCallback(() => {
    api.studentCard(Number(id)).then(setCard).catch((e) => setError(e instanceof Error ? e.message : "Ошибка"));
  }, [id]);
  useEffect(load, [load]);
  useLiveEvents(useCallback((e) => {
    if (e.payload.student_id === Number(id) || e.type === "enrollment.changed") load();
  }, [id, load]));

  if (error) return <div className="py-20 text-center text-slate-500">{error}</div>;
  if (!card) return <div className="flex h-64 items-center justify-center"><Loader2 className="size-6 animate-spin text-indigo-600" /></div>;

  const canEditBoarding = user && ["SuperAdmin", "Director", "Zavuch", "ParentRelations", "Admissions", "Teacher"].includes(user.role);

  async function saveBoarding(is_boarder: boolean, room?: string) {
    try {
      setCard(await api.updateStudent(card!.id, { is_boarder, boarding_room: room ?? card!.boarding_room }));
      setEditRoom(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/students" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="size-4" /> Ученики</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{card.full_name}</h1>
        <span className="text-lg text-slate-500">{card.class_name}</span>
        {card.status === "ENROLLING" && <Badge className="bg-amber-100 text-amber-800 ring-amber-600/20">На приёме</Badge>}
        {card.status === "ACTIVE" && <Badge className="bg-emerald-100 text-emerald-800 ring-emerald-600/20">Учится</Badge>}
        {card.is_boarder && <Badge className="bg-violet-100 text-violet-800 ring-violet-600/20"><BedDouble className="size-3" /> Пансионат {card.boarding_room ?? ""}</Badge>}
        {card.status === "ACTIVE" && <StatusBadge status={card.presence_status} discrepancy={card.is_discrepancy} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Анкета</CardTitle></CardHeader>
            <CardContent className="divide-y divide-slate-50 py-3">
              <Field label="Класс">{card.class_name}</Field>
              <Field label="Классный руководитель">{card.homeroom_teacher ?? "—"}</Field>
              <Field label="Дата рождения">{formatDate(card.birth_date)}</Field>
              <Field label="Дата поступления">{formatDate(card.admission_date)}</Field>
              <Field label="Пансионат">
                {editRoom !== null ? (
                  <span className="flex items-center gap-1">
                    <Input className="h-7 w-24" value={editRoom} onChange={(e) => setEditRoom(e.target.value)} placeholder="Комната" />
                    <Button size="sm" onClick={() => saveBoarding(true, editRoom)}>ОК</Button>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {card.is_boarder === null ? "не отмечено" : card.is_boarder ? `да, комната ${card.boarding_room ?? "—"}` : "нет"}
                    {canEditBoarding && (card.is_boarder
                      ? <button className="cursor-pointer text-xs text-indigo-600" onClick={() => saveBoarding(false)}>выписать</button>
                      : <button className="cursor-pointer text-xs text-indigo-600" onClick={() => setEditRoom("")}>заселить</button>)}
                  </span>
                )}
              </Field>
              {card.external_1c_id && <Field label="Лицевой счёт 1С">{card.external_1c_id}</Field>}
              <Field label="HikCentral">{card.hik_person_id ? `personId ${card.hik_person_id}` : "не связан"}</Field>
              {card.notes && <Field label="Примечание">{card.notes}</Field>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Родители</CardTitle><Phone className="size-4 text-slate-400" /></CardHeader>
            <CardContent className="space-y-2 py-3">
              {card.guardians.map((g) => (
                <div key={g.id} className="text-sm">
                  <div className="font-medium">{g.full_name} <span className="text-xs font-normal text-slate-500">{g.relation}{g.is_primary && " · основной контакт"}</span></div>
                  <div className="tabular-nums text-slate-600">{g.phone ?? "—"}{g.telegram_chat_id && " · Telegram подключён"}</div>
                </div>
              ))}
              {card.guardians.length === 0 && <p className="text-sm text-slate-500">Нет данных</p>}
            </CardContent>
          </Card>

          {card.payment && (
            <Card>
              <CardHeader><CardTitle>Оплата (1С)</CardTitle><Wallet className="size-4 text-slate-400" /></CardHeader>
              <CardContent className="py-3">
                <Field label="Долг"><span className={card.payment.has_debt ? "text-rose-700" : "text-emerald-700"}>
                  {card.payment.has_debt ? formatMoney(card.payment.debt_amount, card.payment.currency) : "нет"}</span></Field>
                <Field label="Оплачено до">{formatDate(card.payment.paid_until)}</Field>
                <Field label="Проверено">{minutesAgo(card.payment.checked_at)}</Field>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6 lg:col-span-2">
          {card.enrollment && (
            <Card>
              <CardHeader><CardTitle>Приём в школу</CardTitle>
                <span className="text-xs text-slate-500">{card.enrollment.done_steps}/{card.enrollment.total_steps} этапов</span></CardHeader>
              <CardContent className="grid gap-2 py-3 sm:grid-cols-2">
                {card.enrollment.steps.map((s) => (
                  <div key={s.kind} className={cn("rounded-lg border p-2.5 text-sm", s.status === "DONE" ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50")}>
                    <div className="font-medium">{s.label}</div>
                    <div className="text-xs text-slate-600">{s.status === "DONE"
                      ? `${s.completed_by_name ?? "автоматически"} · ${formatDate(s.completed_at)} ${formatTime(s.completed_at)}`
                      : `ждёт: ${s.assignee_name ?? s.assignee_role}`}</div>
                  </div>
                ))}
                {card.enrollment.my_pending && <Link to="/enrollment" className="text-sm text-indigo-600 hover:underline">Перейти к моей задаче →</Link>}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Посещаемость за 14 дней (по турникетам)</CardTitle></CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="px-4 py-2">День</th><th className="px-4 py-2">Пришёл</th><th className="px-4 py-2">Ушёл</th><th className="px-4 py-2">Проходов</th><th className="px-4 py-2"></th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {card.history.map((d) => {
                    const dt = new Date(`${d.date}T00:00:00`);
                    const weekend = dt.getDay() === 0;
                    return (
                      <tr key={d.date} className={cn(weekend && "text-slate-400")}>
                        <td className="px-4 py-1.5 tabular-nums">{formatDate(d.date)} <span className="text-xs text-slate-400">{WEEKDAY[dt.getDay()]}</span></td>
                        <td className="px-4 py-1.5 tabular-nums">{formatTime(d.first_in)}</td>
                        <td className="px-4 py-1.5 tabular-nums">{formatTime(d.last_out)}</td>
                        <td className="px-4 py-1.5 tabular-nums">{d.passes || "—"}</td>
                        <td className="px-4 py-1.5">{d.late && <Badge className="bg-amber-100 text-amber-800 ring-amber-600/20">опоздал</Badge>}
                          {!d.first_in && !weekend && !card.is_boarder && <span className="text-xs text-rose-600">нет прохода</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Последние проходы</CardTitle></CardHeader>
              <CardContent className="max-h-72 space-y-1.5 overflow-y-auto py-3">
                {card.recent_events.length === 0 && <p className="text-sm text-slate-500">Проходов нет</p>}
                {card.recent_events.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {e.direction === "IN" ? <LogIn className="size-3.5 text-emerald-600" /> : <LogOut className="size-3.5 text-slate-500" />}
                    <span className="tabular-nums text-slate-500">{formatDate(e.occurred_at)} {formatTime(e.occurred_at)}</span>
                    <span className={cn("font-medium", e.decision === "DENIED" ? "text-rose-700" : "text-slate-800")}>{e.decision === "DENIED" ? "Отказ" : "Проход"}</span>
                    <span className="truncate text-slate-500">{e.reason_label}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Медпункт</CardTitle><Stethoscope className="size-4 text-slate-400" /></CardHeader>
              <CardContent className="space-y-1.5 py-3">
                {card.nurse_visits.length === 0 && <p className="text-sm text-slate-500">Обращений нет</p>}
                {card.nurse_visits.map((v, i) => (
                  <div key={i} className="text-xs"><span className="tabular-nums text-slate-500">{formatDate(v.start_time)} {formatTime(v.start_time)}</span> · {v.reason} · <span className="text-slate-600">{OUTCOME_LABEL[v.outcome]}</span></div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>История</CardTitle><History className="size-4 text-slate-400" /></CardHeader>
            <CardContent className="space-y-2 py-3">
              {card.timeline.length === 0 && <p className="text-sm text-slate-500">Записей нет</p>}
              {card.timeline.map((t, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="w-28 shrink-0 tabular-nums text-xs text-slate-500">{formatDate(t.at)} {formatTime(t.at)}</span>
                  <span>{t.text}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
