// Экран медсестры: поиск ученика → 1 клик «В медпункт»; управление активными визитами.
import { Clock, Home, Loader2, School, Search, Stethoscope } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { NurseOutcome, NurseVisit, SchoolClass, Student } from "@/lib/types";
import { cn, formatTime, minutesAgo, OUTCOME_LABEL } from "@/lib/utils";

const QUICK_REASONS = ["Головная боль", "Температура", "Травма / ушиб", "Боль в животе", "Тошнота", "Плохое самочувствие"];

export function NursePage() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [reason, setReason] = useState(QUICK_REASONS[0]);
  const [visits, setVisits] = useState<NurseVisit[]>([]);
  const [history, setHistory] = useState<NurseVisit[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const loadVisits = useCallback(async () => {
    const [active, closed] = await Promise.all([api.nurseVisits(true), api.nurseVisits(false)]);
    setVisits(active);
    setHistory(closed.slice(0, 8));
  }, []);

  const loadStudents = useCallback(async () => {
    setStudents(await api.students({ search: search.trim() || undefined, class_id: classId }));
  }, [search, classId]);

  useEffect(() => {
    api.classes().then(setClasses);
    void loadVisits();
    const t = setInterval(() => void loadVisits(), 30_000);
    return () => clearInterval(t);
  }, [loadVisits]);

  // Поиск с debounce
  useEffect(() => {
    const t = setTimeout(() => void loadStudents(), 250);
    return () => clearTimeout(t);
  }, [loadStudents]);

  const flash = (kind: "ok" | "err", text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3500);
  };

  async function admit(s: Student) {
    setBusyId(`s${s.id}`);
    try {
      await api.createVisit(s.id, reason);
      flash("ok", `${s.full_name} — в медпункте («${reason}»)`);
      await Promise.all([loadVisits(), loadStudents()]);
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusyId(null);
    }
  }

  async function finish(v: NurseVisit, outcome: NurseOutcome) {
    setBusyId(`v${v.id}`);
    try {
      await api.updateVisit(v.id, outcome);
      flash("ok", `${v.student_name}: ${OUTCOME_LABEL[outcome]}`);
      await Promise.all([loadVisits(), loadStudents()]);
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Stethoscope className="size-6 text-sky-600" /> Медпункт</h1>
          <p className="text-sm text-slate-500">Найдите ученика и отметьте приход одним кликом — статус в «Пульсе школы» обновится сразу.</p>
        </div>
        {toast && (
          <div className={cn("rounded-md px-4 py-2 text-sm font-medium shadow",
            toast.kind === "ok" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white")}>
            {toast.text}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Поиск ученика */}
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Поиск ученика</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-slate-400" />
                <Input className="pl-8" placeholder="ФИО или RFID-карта…" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
              </div>
              <Select className="w-36" value={classId ?? ""} onChange={(e) => setClassId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Все классы</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">Причина обращения</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_REASONS.map((r) => (
                  <button key={r} onClick={() => setReason(r)}
                    className={cn("cursor-pointer rounded-full border px-3 py-1 text-xs transition",
                      reason === r ? "border-sky-600 bg-sky-600 text-white" : "border-slate-300 bg-white hover:bg-slate-50")}>
                    {r}
                  </button>
                ))}
                <Input className="h-7 w-48 text-xs" placeholder="другая причина…"
                  value={QUICK_REASONS.includes(reason) ? "" : reason}
                  onChange={(e) => setReason(e.target.value || QUICK_REASONS[0])} />
              </div>
            </div>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {students.length === 0 && <li className="p-4 text-center text-sm text-slate-500">Никого не найдено</li>}
              {students.map((s) => {
                const inNurse = s.status === "IN_NURSE";
                return (
                  <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{s.full_name}</div>
                      <div className="text-xs text-slate-500">{s.class_name} · {s.rfid_card_id}</div>
                    </div>
                    <StatusBadge status={s.status} />
                    <Button size="sm" variant="sky" disabled={inNurse || busyId !== null} onClick={() => admit(s)}>
                      {busyId === `s${s.id}` ? <Loader2 className="size-3.5 animate-spin" /> : <Stethoscope className="size-3.5" />}
                      {inNurse ? "Уже здесь" : "В медпункт"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {/* Активные визиты */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Сейчас в медпункте</CardTitle>
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">{visits.length}</span>
            </CardHeader>
            <CardContent className="space-y-3">
              {visits.length === 0 && <p className="text-sm text-slate-500">Пусто — все здоровы 🎉</p>}
              {visits.map((v) => (
                <div key={v.id} className="rounded-lg border border-sky-200 bg-sky-50/50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{v.student_name} <span className="text-xs text-slate-500">{v.class_name}</span></div>
                      <div className="text-sm text-slate-700">{v.reason}</div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500" title={formatTime(v.start_time)}>
                      <Clock className="size-3" /> {minutesAgo(v.start_time)}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="success" className="flex-1" disabled={busyId !== null} onClick={() => finish(v, "RETURNED_TO_CLASS")}>
                      <School className="size-3.5" /> Вернулся на урок
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" disabled={busyId !== null} onClick={() => finish(v, "SENT_HOME")}>
                      <Home className="size-3.5" /> Домой
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Последние закрытые визиты</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {history.length === 0 && <p className="text-sm text-slate-500">Нет записей</p>}
              {history.map((v) => (
                <div key={v.id} className="flex items-center justify-between text-sm">
                  <span>{v.student_name} <span className="text-xs text-slate-500">· {v.reason}</span></span>
                  <span className="text-xs text-slate-500">{OUTCOME_LABEL[v.outcome]} · {formatTime(v.end_time)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
