// Расписание: моё расписание, просмотр по классу/учителю/кабинету; для завуча по учебной части —
// помощник составления, ручная правка (перенос с проверкой конфликтов, закрепление), нагрузка,
// пожелания и предложения учителей; для директора — отчёт.
import { CalendarDays, Check, Copy, Loader2, Lock, Send, Sparkles, Trash2, Unlock, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { ReportView } from "@/components/schedule/ReportView";
import { TimetableGrid } from "@/components/schedule/TimetableGrid";
import type { Bells, TTEntry, TTReport, TTVersion } from "@/components/schedule/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { http } from "@/lib/api";
import { cn, DAY_NAMES, TT_MANAGER_ROLES, TT_OVERSIGHT_ROLES } from "@/lib/utils";

type Tab = "my" | "view" | "build" | "load" | "wishes" | "proposals" | "report";
interface Named { id: number; name?: string; full_name?: string; number?: string }

function useToast() {
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const flash = (ok: boolean, text: string) => { setToast({ ok, text }); setTimeout(() => setToast(null), 5000); };
  const node = toast && (
    <div className={cn("fixed bottom-6 right-6 z-50 max-w-md whitespace-pre-line rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg",
      toast.ok ? "bg-emerald-600" : "bg-rose-600")}>{toast.text}</div>
  );
  return { flash, node };
}

export function SchedulePage() {
  const { user } = useAuth();
  const isManager = !!user && TT_MANAGER_ROLES.includes(user.role);
  const isOversight = !!user && TT_OVERSIGHT_ROLES.includes(user.role);
  const [bells, setBells] = useState<Bells | null>(null);
  const [tab, setTab] = useState<Tab>(isManager ? "build" : user?.role === "Director" ? "report" : "my");
  const { flash, node } = useToast();

  useEffect(() => { http.get<Bells>("/academic/bells").then(setBells); }, []);
  if (!bells) return <div className="flex h-64 items-center justify-center"><Loader2 className="size-6 animate-spin text-indigo-600" /></div>;

  const tabs: [Tab, string, boolean][] = [
    ["build", "Составление", isManager], ["my", "Моё расписание", true], ["view", "Просмотр", true],
    ["load", "Нагрузка", isManager], ["wishes", "Пожелания учителей", isOversight], ["proposals", "Предложения", true],
    ["report", "Отчёт", isOversight],
  ];
  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><CalendarDays className="size-6 text-indigo-600" /> Расписание</h1>
      <div className="flex flex-wrap gap-1">
        {tabs.filter(([, , show]) => show).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn("cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium", tab === id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}>
            {label}
          </button>
        ))}
      </div>
      {tab === "my" && <MyTab bells={bells} flash={flash} canPropose={!!user && !["Student", "Parent"].includes(user.role)} />}
      {tab === "view" && <ViewTab bells={bells} />}
      {tab === "build" && isManager && <BuildTab bells={bells} flash={flash} />}
      {tab === "load" && isManager && <LoadTab flash={flash} />}
      {tab === "wishes" && <WishesTab bells={bells} />}
      {tab === "proposals" && <ProposalsTab isManager={isManager} flash={flash} />}
      {tab === "report" && <PublishedReport />}
      {node}
    </div>
  );
}

// ---------------------------------------------------------------- Моё расписание + предложение переноса

function MyTab({ bells, flash, canPropose }: { bells: Bells; flash: (ok: boolean, t: string) => void; canPropose: boolean }) {
  const [data, setData] = useState<{ version: TTVersion | null; views: { title: string; entries: TTEntry[] }[] } | null>(null);
  const [selected, setSelected] = useState<TTEntry | null>(null);
  const [target, setTarget] = useState<{ day: number; slot: number } | null>(null);
  const [check, setCheck] = useState<{ ok: boolean; errors: string[]; warnings: string[] } | null>(null);
  const [comment, setComment] = useState("");

  useEffect(() => { http.get<typeof data>("/timetable/my").then(setData); }, []);
  if (!data) return null;
  if (!data.version) return <Card><CardContent className="py-10 text-center text-slate-500">Расписание ещё не опубликовано</CardContent></Card>;

  async function pick(day: number, slot: number, entry: TTEntry | null, own: boolean) {
    if (!canPropose || !own) return;
    if (entry && (!selected || entry.id !== selected.id)) { setSelected(entry); setTarget(null); setCheck(null); return; }
    if (!entry && selected) {
      setTarget({ day, slot });
      setCheck(await http.get(`/timetable/entries/${selected.id}/check`, { day, slot }));
    }
  }
  async function send() {
    if (!selected || !target) return;
    try {
      await http.post("/timetable/proposals", { entry_id: selected.id, to_day: target.day, to_slot: target.slot, comment });
      flash(true, "Предложение отправлено завучу по учебной части");
      setSelected(null); setTarget(null); setCheck(null); setComment("");
    } catch (e) { flash(false, e instanceof Error ? e.message : "Ошибка"); }
  }

  return (
    <div className="space-y-6">
      {canPropose && <p className="text-sm text-slate-500">Чтобы предложить перенос своего урока: нажмите на урок, затем на свободную клетку.</p>}
      {data.views.map((v, i) => (
        <Card key={v.title}>
          <CardHeader><CardTitle>{v.title}</CardTitle><span className="text-xs text-slate-500">«{data.version!.name}»</span></CardHeader>
          <CardContent>
            <TimetableGrid bells={bells} entries={v.entries} mode={v.title === "Мои уроки" ? "teacher" : "class"} selectedId={selected?.id}
              onCellClick={(d, s, e) => pick(d, s, e, i === 0)}
              highlight={(d, s) => target && target.day === d && target.slot === s ? (check?.ok ? (check.warnings.length ? "warn" : "ok") : "bad") : null} />
          </CardContent>
        </Card>
      ))}
      {selected && (
        <Card className="border-indigo-300">
          <CardContent className="space-y-2 py-4 text-sm">
            <div><b>{selected.subject_name}</b>, {selected.class_name}: {DAY_NAMES[selected.day]} {selected.slot}-й урок
              {target ? <> → <b>{DAY_NAMES[target.day]} {target.slot}-й урок</b></> : " — выберите свободную клетку"}</div>
            {check?.errors.map((e) => <div key={e} className="text-rose-700">✗ {e}</div>)}
            {check?.warnings.map((e) => <div key={e} className="text-amber-700">! {e}</div>)}
            {target && check?.ok && (
              <div className="flex gap-2">
                <Input placeholder="Комментарий для завуча" value={comment} onChange={(e) => setComment(e.target.value)} />
                <Button onClick={send}><Send className="size-4" /> Предложить</Button>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={() => { setSelected(null); setTarget(null); setCheck(null); }}>Отмена</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Просмотр по классу / учителю / кабинету

function ViewTab({ bells }: { bells: Bells }) {
  const [kind, setKind] = useState<"class_id" | "teacher_id" | "room_id">("class_id");
  const [options, setOptions] = useState<Named[]>([]);
  const [id, setId] = useState<number | null>(null);
  const [entries, setEntries] = useState<TTEntry[]>([]);

  useEffect(() => {
    const path = kind === "class_id" ? "/classes" : kind === "teacher_id" ? "/academic/teachers" : "/academic/rooms";
    http.get<Named[]>(path).then((o) => { setOptions(o); setId(o[0]?.id ?? null); });
  }, [kind]);
  useEffect(() => {
    if (id) http.get<{ entries: TTEntry[] }>("/timetable/view", { [kind]: id }).then((r) => setEntries(r.entries));
  }, [kind, id]);

  return (
    <Card>
      <CardHeader className="flex-wrap">
        <div className="flex gap-2">
          <Select className="w-36" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="class_id">Класс</option><option value="teacher_id">Учитель</option><option value="room_id">Кабинет</option>
          </Select>
          <Select className="w-72" value={id ?? ""} onChange={(e) => setId(Number(e.target.value))}>
            {options.map((o) => <option key={o.id} value={o.id}>{o.name ?? o.full_name}{o.number ? ` (${o.number})` : ""}</option>)}
          </Select>
        </div>
      </CardHeader>
      <CardContent><TimetableGrid bells={bells} entries={entries} mode={kind === "class_id" ? "class" : kind === "teacher_id" ? "teacher" : "room"} /></CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------- Составление (помощник + ручная правка)

function BuildTab({ bells, flash }: { bells: Bells; flash: (ok: boolean, t: string) => void }) {
  const [versions, setVersions] = useState<TTVersion[]>([]);
  const [current, setCurrent] = useState<TTVersion | null>(null);
  const [classes, setClasses] = useState<Named[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [selected, setSelected] = useState<TTEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("Вариант");
  const [seconds, setSeconds] = useState(60);
  const [problems, setProblems] = useState<string[]>([]);

  const loadVersions = useCallback(async () => setVersions(await http.get<TTVersion[]>("/timetable/versions")), []);
  const open = useCallback(async (id: number) => { setCurrent(await http.get<TTVersion>(`/timetable/versions/${id}`)); setSelected(null); }, []);
  useEffect(() => {
    void loadVersions();
    http.get<Named[]>("/classes").then((c) => { setClasses(c); setClassId(c[0]?.id ?? null); });
  }, [loadVersions]);
  useEffect(() => { if (!current && versions[0]) void open(versions[0].id); }, [versions, current, open]);

  const entries = useMemo(() => (current?.entries ?? []).filter((e) => e.class_id === classId), [current, classId]);

  async function generate(base?: number) {
    setBusy(true); setProblems([]);
    try {
      const v = await http.post<TTVersion>("/timetable/versions/generate", { name, time_limit: seconds, base_version_id: base });
      flash(true, `Готово: «${v.name}» — ${v.summary.lessons_placed} уроков, конфликтов ${v.summary.conflicts}`);
      await loadVersions(); await open(v.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setProblems(msg.split("\n"));
    } finally { setBusy(false); }
  }

  async function click(day: number, slot: number, entry: TTEntry | null) {
    if (!current || current.status === "ARCHIVED") return;
    if (entry) { setSelected(entry.id === selected?.id ? null : entry); return; }
    if (!selected) return;
    try {
      const r = await http.patch<TTEntry & { warnings: string[] }>(`/timetable/entries/${selected.id}`, { day, slot });
      flash(true, `Перенесено: ${DAY_NAMES[day]}, ${slot}-й урок` + (r.warnings.length ? `\n${r.warnings.join("\n")}` : ""));
      await open(current.id);
    } catch (e) { flash(false, e instanceof Error ? e.message : "Ошибка"); }
  }

  async function action(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); flash(true, ok); await loadVersions(); if (current) await open(current.id); }
    catch (e) { flash(false, e instanceof Error ? e.message : "Ошибка"); }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Помощник составления расписания</CardTitle><Sparkles className="size-4 text-indigo-500" /></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">
            Помощник учитывает нагрузку, кабинеты (биология, информатика, физика — по одному, поэтому не параллельно),
            «не могу» учителей (жёстко), «нежелательно» (по возможности), окна у классов и учителей. Закреплённые (🔒) уроки не двигает.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input className="w-56" value={name} onChange={(e) => setName(e.target.value)} placeholder="Название варианта" />
            <Select className="w-44" value={seconds} onChange={(e) => setSeconds(Number(e.target.value))}>
              <option value={30}>быстро (30 с)</option><option value={60}>обычно (1 мин)</option><option value={180}>тщательно (3 мин)</option>
            </Select>
            <Button disabled={busy} onClick={() => generate()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Составить новый</Button>
            {current && <Button variant="outline" disabled={busy} onClick={() => generate(current.id)} title="Оставить закреплённые уроки на месте">
              <Lock className="size-4" /> С учётом закреплённых</Button>}
            {busy && <span className="text-sm text-slate-500">Помощник думает… до {seconds} с</span>}
          </div>
          {problems.length > 0 && (
            <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{problems.map((p) => <div key={p}>{p}</div>)}</div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {versions.map((v) => (
          <button key={v.id} onClick={() => open(v.id)}
            className={cn("cursor-pointer rounded-lg border px-3 py-2 text-left text-sm", current?.id === v.id ? "border-indigo-500 ring-1 ring-indigo-500" : "border-slate-200 bg-white")}>
            <div className="font-medium">{v.name} {v.status === "PUBLISHED" && <Badge className="ml-1 bg-emerald-100 text-emerald-800 ring-emerald-600/20">действует</Badge>}</div>
            <div className="text-xs text-slate-500">{v.summary.lessons_placed}/{v.summary.lessons_planned} уроков · конфликтов {v.summary.conflicts} · пожеланий нарушено {v.summary.wishes_violated}</div>
          </button>
        ))}
      </div>

      {current && (
        <>
          <Card>
            <CardHeader className="flex-wrap">
              <div className="flex items-center gap-2">
                <Select className="w-36" value={classId ?? ""} onChange={(e) => { setClassId(Number(e.target.value)); setSelected(null); }}>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
                <span className="text-sm text-slate-500">Нажмите на урок, затем на пустую клетку — перенос с проверкой конфликтов</span>
              </div>
              <div className="flex gap-2">
                {selected && <Button size="sm" variant="outline" onClick={() => action(() => http.patch(`/timetable/entries/${selected.id}`, { locked: !selected.locked }), selected.locked ? "Откреплено" : "Закреплено")}>
                  {selected.locked ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />} {selected.locked ? "Открепить" : "Закрепить"}</Button>}
                <Button size="sm" variant="outline" onClick={() => action(() => http.post(`/timetable/versions/${current.id}/copy`), "Копия создана")}><Copy className="size-3.5" /> Копия</Button>
                {current.status === "DRAFT" && <>
                  <Button size="sm" variant="success" onClick={() => action(() => http.post(`/timetable/versions/${current.id}/publish`), "Опубликовано. Директору отправлен отчёт")}><Check className="size-3.5" /> Опубликовать</Button>
                  <Button size="sm" variant="ghost" onClick={() => action(async () => { await http.del(`/timetable/versions/${current.id}`); setCurrent(null); }, "Вариант удалён")}><Trash2 className="size-3.5" /></Button>
                </>}
              </div>
            </CardHeader>
            <CardContent><TimetableGrid bells={bells} entries={entries} mode="class" selectedId={selected?.id} onCellClick={click} /></CardContent>
          </Card>
          {current.report && <ReportView report={current.report as TTReport} />}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Нагрузка

interface AssignmentRow { id: number; class_id: number; class_name: string; subject_id: number; subject_name: string; teacher_id: number; teacher_name: string; hours_per_week: number; room_name: string | null }

function LoadTab({ flash }: { flash: (ok: boolean, t: string) => void }) {
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [classes, setClasses] = useState<Named[]>([]);
  const [subjects, setSubjects] = useState<Named[]>([]);
  const [teachers, setTeachers] = useState<Named[]>([]);
  const [classId, setClassId] = useState<number | "">("");
  const [draft, setDraft] = useState({ subject_id: "", teacher_id: "", hours: "2" });

  const load = useCallback(async () => setRows(await http.get<AssignmentRow[]>("/academic/assignments", { class_id: classId || undefined })), [classId]);
  useEffect(() => {
    http.get<Named[]>("/classes").then(setClasses);
    http.get<Named[]>("/academic/subjects").then(setSubjects);
    http.get<Named[]>("/academic/teachers").then(setTeachers);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save(fn: () => Promise<unknown>) {
    try { await fn(); await load(); } catch (e) { flash(false, e instanceof Error ? e.message : "Ошибка"); }
  }
  const total = rows.reduce((s, r) => s + r.hours_per_week, 0);
  return (
    <Card>
      <CardHeader className="flex-wrap">
        <div className="flex items-center gap-2">
          <Select className="w-40" value={classId} onChange={(e) => setClassId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Все классы</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <span className="text-sm text-slate-500">{rows.length} строк · {total} ч в неделю</span>
        </div>
      </CardHeader>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr><th className="px-4 py-2">Класс</th><th className="px-4 py-2">Предмет</th><th className="px-4 py-2">Учитель</th><th className="px-4 py-2">Часов</th><th className="px-4 py-2">Кабинет</th><th /></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-1.5">{r.class_name}</td>
              <td className="px-4 py-1.5">{r.subject_name}</td>
              <td className="px-4 py-1.5">
                <Select className="h-8" value={r.teacher_id} onChange={(e) => save(() => http.patch(`/academic/assignments/${r.id}`, { teacher_id: Number(e.target.value) }))}>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </Select>
              </td>
              <td className="px-4 py-1.5"><Input className="h-8 w-20" type="number" min={0} max={12} defaultValue={r.hours_per_week}
                onBlur={(e) => Number(e.target.value) !== r.hours_per_week && save(() => http.patch(`/academic/assignments/${r.id}`, { hours_per_week: Number(e.target.value) }))} /></td>
              <td className="px-4 py-1.5 text-xs text-slate-500">{r.room_name ?? "свой класс"}</td>
              <td className="px-4 py-1.5"><button className="cursor-pointer text-slate-400 hover:text-rose-600" onClick={() => save(() => http.del(`/academic/assignments/${r.id}`))}><X className="size-4" /></button></td>
            </tr>
          ))}
          {classId !== "" && (
            <tr className="bg-slate-50/60">
              <td className="px-4 py-2 text-xs text-slate-500">добавить:</td>
              <td className="px-4 py-2"><Select className="h-8" value={draft.subject_id} onChange={(e) => setDraft({ ...draft, subject_id: e.target.value })}>
                <option value="">Предмет…</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></td>
              <td className="px-4 py-2"><Select className="h-8" value={draft.teacher_id} onChange={(e) => setDraft({ ...draft, teacher_id: e.target.value })}>
                <option value="">Учитель…</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}</Select></td>
              <td className="px-4 py-2"><Input className="h-8 w-20" type="number" value={draft.hours} onChange={(e) => setDraft({ ...draft, hours: e.target.value })} /></td>
              <td colSpan={2} className="px-4 py-2"><Button size="sm" disabled={!draft.subject_id || !draft.teacher_id}
                onClick={() => save(async () => { await http.post("/academic/assignments", { class_id: classId, subject_id: Number(draft.subject_id), teacher_id: Number(draft.teacher_id), hours_per_week: Number(draft.hours) }); setDraft({ subject_id: "", teacher_id: "", hours: "2" }); })}>Добавить</Button></td>
            </tr>
          )}
        </tbody>
      </table>
      {classId === "" && <p className="p-3 text-xs text-slate-500">Чтобы добавить строку, выберите класс.</p>}
    </Card>
  );
}

// ---------------------------------------------------------------- Пожелания учителей

interface Pref { teacher_id: number; teacher_name: string; cells: Record<string, "no" | "avoid">; max_lessons_per_day: number | null; comment: string | null }

function WishesTab({ bells }: { bells: Bells }) {
  const [prefs, setPrefs] = useState<Pref[]>([]);
  useEffect(() => { http.get<Pref[]>("/timetable/preferences").then(setPrefs); }, []);
  if (prefs.length === 0) return <Card><CardContent className="py-10 text-center text-slate-500">Учителя ещё не указали пожеланий</CardContent></Card>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {prefs.map((p) => (
        <Card key={p.teacher_id}>
          <CardHeader><CardTitle>{p.teacher_name}</CardTitle>{p.max_lessons_per_day && <span className="text-xs text-slate-500">не больше {p.max_lessons_per_day} уроков в день</span>}</CardHeader>
          <CardContent className="space-y-2">
            {p.comment && <p className="text-sm italic text-slate-600">«{p.comment}»</p>}
            <PrefGrid bells={bells} cells={p.cells} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function PrefGrid({ bells, cells, onToggle }: { bells: Bells; cells: Record<string, string>; onToggle?: (key: string) => void }) {
  return (
    <table className="border-separate border-spacing-1 text-xs">
      <thead><tr><th />{bells.days.map((d) => <th key={d} className="w-12 text-slate-600">{DAY_NAMES[d]}</th>)}</tr></thead>
      <tbody>
        {bells.slots.map((b) => (
          <tr key={b.number}>
            <td className="pr-1 text-right text-slate-500">{b.number}</td>
            {bells.days.map((d) => {
              const v = cells[`${d}-${b.number}`];
              return (
                <td key={d} onClick={() => onToggle?.(`${d}-${b.number}`)}
                  className={cn("h-7 w-12 rounded text-center font-semibold", onToggle && "cursor-pointer",
                    v === "no" ? "bg-rose-500 text-white" : v === "avoid" ? "bg-amber-300 text-amber-900" : "bg-emerald-50 text-emerald-700")}>
                  {v === "no" ? "нет" : v === "avoid" ? "лучше нет" : "✓"}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------- Предложения

interface Proposal { id: number; status: string; entry: TTEntry; to_day: number; to_slot: number; comment: string | null; errors: string[]; warnings: string[]; resolution_comment: string | null }

function ProposalsTab({ isManager, flash }: { isManager: boolean; flash: (ok: boolean, t: string) => void }) {
  const [items, setItems] = useState<Proposal[]>([]);
  const load = useCallback(async () => setItems(await http.get<Proposal[]>("/timetable/proposals", { state: "ALL" })), []);
  useEffect(() => { void load(); }, [load]);
  async function resolve(p: Proposal, accept: boolean) {
    try { await http.post(`/timetable/proposals/${p.id}/resolve`, { accept }); flash(true, accept ? "Принято, урок перенесён" : "Отклонено"); await load(); }
    catch (e) { flash(false, e instanceof Error ? e.message : "Ошибка"); }
  }
  if (items.length === 0) return <Card><CardContent className="py-10 text-center text-slate-500">Предложений нет. Учитель может предложить перенос во вкладке «Моё расписание».</CardContent></Card>;
  return (
    <Card>
      <CardContent className="divide-y divide-slate-100 p-0">
        {items.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <div><b>{p.entry.teacher_name}</b>: {p.entry.subject_name}, {p.entry.class_name} — {DAY_NAMES[p.entry.day]} {p.entry.slot}-й → <b>{DAY_NAMES[p.to_day]} {p.to_slot}-й</b></div>
              {p.comment && <div className="text-xs italic text-slate-500">«{p.comment}»</div>}
              {p.errors.map((e) => <div key={e} className="text-xs text-rose-700">✗ {e}</div>)}
              {p.warnings.map((e) => <div key={e} className="text-xs text-amber-700">! {e}</div>)}
            </div>
            {p.status === "PENDING" && isManager ? (
              <div className="flex gap-2">
                <Button size="sm" variant="success" disabled={p.errors.length > 0} onClick={() => resolve(p, true)}><Check className="size-3.5" /> Принять</Button>
                <Button size="sm" variant="outline" onClick={() => resolve(p, false)}><X className="size-3.5" /> Отклонить</Button>
              </div>
            ) : <Badge className={p.status === "ACCEPTED" ? "bg-emerald-100 text-emerald-800 ring-emerald-600/20" : p.status === "REJECTED" ? "bg-slate-100 text-slate-600 ring-slate-500/20" : "bg-amber-100 text-amber-800 ring-amber-600/20"}>
              {p.status === "ACCEPTED" ? "принято" : p.status === "REJECTED" ? "отклонено" : "на рассмотрении"}</Badge>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------- Отчёт (действующее расписание)

function PublishedReport() {
  const [v, setV] = useState<TTVersion | null | undefined>(undefined);
  useEffect(() => {
    http.get<TTVersion[]>("/timetable/versions").then(async (vs) => {
      const pub = vs.find((x) => x.status === "PUBLISHED");
      setV(pub ? await http.get<TTVersion>(`/timetable/versions/${pub.id}`) : null);
    });
  }, []);
  if (v === undefined) return null;
  if (v === null || !v.report) return <Card><CardContent className="py-10 text-center text-slate-500">Расписание ещё не опубликовано</CardContent></Card>;
  return <ReportView report={v.report} title={`Отчёт: «${v.name}» (действует)`} />;
}
