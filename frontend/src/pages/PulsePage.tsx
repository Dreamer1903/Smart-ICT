// «Пульс школы»: live-индикаторы, разбивка по классам и таблица «кто где находится».
// Данные: GET /dashboard/live-pulse; обновление — по SSE-событиям (+ страховочный поллинг).
import {
  AlertTriangle, Building2, DoorOpen, HeartPulse, Radio, RefreshCw, School, Search, Stethoscope, UserX,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { GateSimulator } from "@/components/GateSimulator";
import { StudentsTable } from "@/components/StudentsTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLiveEvents } from "@/hooks/useLiveEvents";
import { api } from "@/lib/api";
import type { DomainEvent, LivePulse, StudentLiveRow } from "@/lib/types";
import { cn, formatTime, STATUS_META } from "@/lib/utils";

type Filter = "absent" | "all" | "discrepancy" | "nurse";
const FILTERS: { id: Filter; label: string; test: (r: StudentLiveRow) => boolean }[] = [
  { id: "absent", label: "Не на уроке", test: (r) => r.status !== "IN_CLASS" },
  { id: "discrepancy", label: "DISCREPANCY", test: (r) => r.is_discrepancy },
  { id: "nurse", label: "Медпункт", test: (r) => r.status === "IN_NURSE" },
  { id: "all", label: "Все", test: () => true },
];

interface FeedItem { id: number; at: string; text: string; tone: "info" | "warn" | "ok" }

function Kpi({ icon: Icon, label, value, total, tone, hint }: {
  icon: ComponentType<{ className?: string }>; label: string; value: number; total?: number; tone: string; hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className={cn("rounded-md p-1.5", tone)}><Icon className="size-4" /></span>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tabular-nums">{value}</span>
        {total !== undefined && <span className="text-sm text-slate-400">/ {total}</span>}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}

export function PulsePage() {
  const [pulse, setPulse] = useState<LivePulse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("absent");
  const [query, setQuery] = useState("");
  const [classId, setClassId] = useState<number | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [flashIds, setFlashIds] = useState<Set<number>>(new Set());
  const reloadTimer = useRef<number | undefined>(undefined);
  const names = useRef<Map<number, string>>(new Map());

  const load = useCallback(async () => {
    try {
      const data = await api.livePulse();
      data.students.forEach((s) => names.current.set(s.student_id, `${s.full_name} (${s.class_name})`));
      setPulse(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000); // страховка, если SSE недоступен
    return () => clearInterval(t);
  }, [load]);

  // Событие → запись в ленту + отложенная (debounce) перезагрузка сводки
  const onEvent = useCallback((e: DomainEvent) => {
    const sid = e.payload.student_id as number | undefined;
    const who = sid ? names.current.get(sid) ?? `#${sid}` : "";
    let item: Omit<FeedItem, "id"> | null = null;
    if (e.type === "presence.changed") {
      const st = STATUS_META[e.payload.status as keyof typeof STATUS_META]?.label ?? e.payload.status;
      item = { at: e.occurred_at, text: `${who} → ${st}`, tone: e.payload.status === "IN_CLASS" ? "ok" : "info" };
    } else if (e.type === "presence.discrepancy") {
      item = { at: e.occurred_at, text: `⚠ ${who}: в здании, но не в классе`, tone: "warn" };
    } else if (e.type === "presence.reset") {
      item = { at: e.occurred_at, text: "Новый учебный день: статусы сброшены", tone: "info" };
    }
    if (item) setFeed((f) => [{ id: Date.now() + Math.random(), ...item }, ...f].slice(0, 30));
    if (sid) setFlashIds((s) => new Set(s).add(sid));
    window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(() => void load(), 300);
  }, [load]);

  const connected = useLiveEvents(onEvent);

  // Сброс подсветки строк
  useEffect(() => {
    if (flashIds.size === 0) return;
    const t = setTimeout(() => setFlashIds(new Set()), 2600);
    return () => clearTimeout(t);
  }, [flashIds]);

  const rows = useMemo(() => {
    if (!pulse) return [];
    const test = FILTERS.find((f) => f.id === filter)!.test;
    return pulse.students.filter((r) => test(r) && (classId === null || r.class_id === classId));
  }, [pulse, filter, classId]);

  if (!pulse) {
    return <div className="flex h-64 items-center justify-center text-slate-500">{error ?? "Загрузка пульса школы…"}</div>;
  }
  const c = pulse.counters;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><HeartPulse className="size-6 text-rose-500" /> Пульс школы</h1>
          <p className="text-sm text-slate-500">Обновлено в {formatTime(pulse.generated_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
            connected ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600")}>
            <Radio className={cn("size-3.5", connected && "animate-pulse")} /> {connected ? "LIVE" : "Нет соединения"}
          </span>
          <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="size-3.5" /> Обновить</Button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={Building2} label="В здании" value={c.in_building} total={c.total_students} tone="bg-indigo-100 text-indigo-700"
          hint={c.in_boarding ? `из них в пансионате ${c.in_boarding}` : undefined} />
        <Kpi icon={School} label="На уроках" value={c.in_class} total={c.total_students} tone="bg-emerald-100 text-emerald-700" />
        <Kpi icon={Stethoscope} label="В медпункте" value={c.in_nurse} tone="bg-sky-100 text-sky-700" />
        <Kpi icon={DoorOpen} label="Не дошли до класса" value={c.not_reached_class} tone="bg-amber-100 text-amber-700"
          hint={c.discrepancies ? `из них ${c.discrepancies} DISCREPANCY` : undefined} />
        <Kpi icon={AlertTriangle} label="DISCREPANCY" value={c.discrepancies}
          tone={c.discrepancies ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-500"} hint="возможный прогул в здании" />
        <Kpi icon={UserX} label="Ушли / не пришли" value={c.left_school + c.not_arrived} tone="bg-slate-100 text-slate-600"
          hint={`ушли ${c.left_school} · не пришли ${c.not_arrived}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-4">
        {/* Таблица мониторинга */}
        <Card className="xl:col-span-3">
          <CardHeader className="flex-wrap">
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((f) => {
                const count = pulse.students.filter(f.test).length;
                return (
                  <button key={f.id} onClick={() => setFilter(f.id)}
                    className={cn("cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium",
                      filter === f.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}>
                    {f.label} <span className="opacity-60">{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="relative w-56">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-slate-400" />
              <Input className="pl-8" placeholder="Поиск…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </CardHeader>
          <StudentsTable rows={rows} globalFilter={query} flashIds={flashIds} />
        </Card>

        <div className="space-y-6">
          {/* По классам */}
          <Card>
            <CardHeader>
              <CardTitle>По классам</CardTitle>
              {classId !== null && <button className="cursor-pointer text-xs text-indigo-600" onClick={() => setClassId(null)}>сбросить</button>}
            </CardHeader>
            <CardContent className="space-y-3">
              {pulse.classes.map((cl) => {
                const pct = (n: number) => `${(n / Math.max(cl.total, 1)) * 100}%`;
                return (
                  <button key={cl.class_id} onClick={() => setClassId(cl.class_id === classId ? null : cl.class_id)}
                    className={cn("block w-full cursor-pointer rounded-lg border p-3 text-left transition",
                      classId === cl.class_id ? "border-indigo-500 ring-1 ring-indigo-500" : "border-slate-200 hover:border-slate-300")}>
                    <div className="mb-2 flex justify-between text-sm">
                      <span className="font-semibold">{cl.class_name}</span>
                      <span className="tabular-nums text-slate-500">{cl.in_class}/{cl.total} на уроке</span>
                    </div>
                    <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="bg-emerald-500" style={{ width: pct(cl.in_class) }} />
                      <div className="bg-sky-500" style={{ width: pct(cl.in_nurse) }} />
                      <div className="bg-amber-400" style={{ width: pct(cl.not_reached_class) }} />
                      <div className="bg-violet-400" style={{ width: pct(cl.in_boarding) }} />
                      <div className="bg-slate-300" style={{ width: pct(cl.absent) }} />
                    </div>
                    <div className="mt-1.5 flex gap-3 text-[11px] text-slate-500">
                      <span>мед {cl.in_nurse}</span>{cl.in_boarding > 0 && <span>пансион {cl.in_boarding}</span>}<span>в здании {cl.not_reached_class}</span><span>нет {cl.absent}</span>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Лента событий */}
          <Card>
            <CardHeader><CardTitle>Лента событий</CardTitle></CardHeader>
            <CardContent className="max-h-72 space-y-2 overflow-y-auto">
              {feed.length === 0 && <p className="text-sm text-slate-500">Ожидание событий…</p>}
              {feed.map((f) => (
                <div key={f.id} className="flex gap-2 text-xs">
                  <span className="shrink-0 tabular-nums text-slate-400">{formatTime(f.at)}</span>
                  <span className={cn(f.tone === "warn" && "font-medium text-rose-700", f.tone === "ok" && "text-emerald-700")}>{f.text}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <GateSimulator students={pulse.students} />
        </div>
      </div>
    </div>
  );
}
