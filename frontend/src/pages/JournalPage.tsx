// Электронный журнал учителя: уроки по расписанию (тема, ДЗ, посещаемость, оценки с комментариями)
// и ведомость (оценки за период, средний балл, итоговые: четверть, полугодие, год, аттестация).
import { BookOpenCheck, ChevronLeft, ChevronRight, Loader2, Plus, Save, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { http } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";

interface MyClass { class_id: number; class_name: string; subject_id: number; subject_name: string; can_write: boolean }
interface LessonRow { date: string; slot: number; weekday: string; lesson_id: number | null; topic: string | null; homework: string | null; attendance_marked: boolean; is_today: boolean }
interface GradeChip { id: number; value: number; kind: string; comment: string | null; date?: string }
interface StudentRow { id: number; full_name: string; mark: Mark | null; late_minutes: number | null; comment: string | null; grades: GradeChip[] }
type Mark = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
interface LessonData { lesson: { id: number; date: string; slot: number; topic: string | null; homework: string | null; homework_due: string | null }; grade_max: number; students: StudentRow[] }

const KIND: Record<string, string> = { CLASSWORK: "работа на уроке", HOMEWORK: "домашняя", ORAL: "устно", TEST: "самостоятельная", CONTROL: "контрольная" };
const PERIODS: [string, string][] = [["Q1", "1 четверть"], ["Q2", "2 четверть"], ["Q3", "3 четверть"], ["Q4", "4 четверть"], ["H1", "1 полугодие"], ["H2", "2 полугодие"], ["YEAR", "Год"], ["FINAL", "Итоговая аттестация"]];
const MARKS: [Mark, string, string][] = [["PRESENT", "✓", "bg-emerald-600"], ["LATE", "оп", "bg-amber-500"], ["ABSENT", "н", "bg-rose-600"], ["EXCUSED", "ув", "bg-slate-500"]];

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const monday = (d: Date) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
export const gradeColor = (v: number) => v >= 5 ? "bg-emerald-600" : v === 4 ? "bg-sky-600" : v === 3 ? "bg-amber-500" : "bg-rose-600";

export function JournalPage() {
  const [params] = useSearchParams();
  const [mine, setMine] = useState<MyClass[]>([]);
  const [key, setKey] = useState<string>("");
  const [tab, setTab] = useState<"lessons" | "book">("lessons");

  useEffect(() => {
    http.get<MyClass[]>("/journal/my-classes").then((m) => {
      setMine(m);
      const want = `${params.get("class_id")}-${params.get("subject_id")}`;
      setKey(m.some((x) => `${x.class_id}-${x.subject_id}` === want) ? want : m[0] ? `${m[0].class_id}-${m[0].subject_id}` : "");
    });
  }, [params]);
  const current = mine.find((m) => `${m.class_id}-${m.subject_id}` === key);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><BookOpenCheck className="size-6 text-indigo-600" /> Журнал</h1>
        <Select className="w-80" value={key} onChange={(e) => setKey(e.target.value)}>
          {mine.map((m) => <option key={`${m.class_id}-${m.subject_id}`} value={`${m.class_id}-${m.subject_id}`}>
            {m.class_name} · {m.subject_name}{m.can_write ? "" : " (просмотр)"}</option>)}
        </Select>
      </div>
      {!current ? <Card><CardContent className="py-10 text-center text-slate-500">Нет классов в журнале. Попросите завуча назначить нагрузку.</CardContent></Card> : (
        <>
          <div className="flex gap-1">
            {([["lessons", "Уроки"], ["book", "Ведомость и итоговые"]] as const).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} className={cn("cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium", tab === id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}>{label}</button>
            ))}
          </div>
          {tab === "lessons" ? <LessonsTab c={current} /> : <GradebookTab c={current} />}
        </>
      )}
    </div>
  );
}

function LessonsTab({ c }: { c: MyClass }) {
  const [week, setWeek] = useState(() => monday(new Date()));
  const [rows, setRows] = useState<LessonRow[]>([]);
  const [open, setOpen] = useState<{ date: string; slot: number } | null>(null);
  const load = useCallback(async () => {
    const end = new Date(week); end.setDate(end.getDate() + 6);
    setRows(await http.get<LessonRow[]>("/journal/lessons", { class_id: c.class_id, subject_id: c.subject_id, date_from: iso(week), date_to: iso(end) }));
  }, [c, week]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setOpen(null); }, [c, week]);
  const shift = (days: number) => { const x = new Date(week); x.setDate(x.getDate() + days); setWeek(x); };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card>
        <CardHeader>
          <button className="cursor-pointer rounded p-1 hover:bg-slate-100" onClick={() => shift(-7)}><ChevronLeft className="size-4" /></button>
          <CardTitle>Неделя с {formatDate(iso(week))}</CardTitle>
          <button className="cursor-pointer rounded p-1 hover:bg-slate-100" onClick={() => shift(7)}><ChevronRight className="size-4" /></button>
        </CardHeader>
        <CardContent className="space-y-1.5 p-3">
          {rows.length === 0 && <p className="p-3 text-sm text-slate-500">На этой неделе уроков нет (или расписание не опубликовано)</p>}
          {rows.map((r) => (
            <button key={`${r.date}-${r.slot}`} onClick={() => setOpen({ date: r.date, slot: r.slot })}
              className={cn("block w-full cursor-pointer rounded-lg border p-2.5 text-left text-sm", open?.date === r.date && open.slot === r.slot ? "border-indigo-500 ring-1 ring-indigo-500" : "border-slate-200 hover:border-slate-300",
                r.is_today && "bg-indigo-50/50")}>
              <div className="flex justify-between"><span className="font-medium">{r.weekday}, {formatDate(r.date)} · {r.slot}-й урок</span>
                {r.attendance_marked && <span className="text-xs text-emerald-600">отмечено</span>}</div>
              <div className="truncate text-xs text-slate-500">{r.topic ?? "тема не указана"}{r.homework ? " · есть ДЗ" : ""}</div>
            </button>
          ))}
        </CardContent>
      </Card>
      {open ? <LessonPanel c={c} date={open.date} slot={open.slot} onSaved={load} /> :
        <Card><CardContent className="py-16 text-center text-slate-500">Выберите урок слева</CardContent></Card>}
    </div>
  );
}

function LessonPanel({ c, date, slot, onSaved }: { c: MyClass; date: string; slot: number; onSaved: () => void }) {
  const [data, setData] = useState<LessonData | null>(null);
  const [marks, setMarks] = useState<Record<number, { mark: Mark | null; late: string }>>({});
  const [topic, setTopic] = useState(""); const [homework, setHomework] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [draft, setDraft] = useState({ value: "5", kind: "CLASSWORK", comment: "" });
  const [error, setError] = useState<string | null>(null);

  /** keepEdits — обновить только оценки, не трогая несохранённые тему, ДЗ и отметки учителя. */
  const load = useCallback(async (keepEdits = false) => {
    try {
      const d = await http.get<LessonData>("/journal/lesson", { class_id: c.class_id, subject_id: c.subject_id, date, slot });
      setData(d); setError(null);
      if (!keepEdits) {
        setTopic(d.lesson.topic ?? ""); setHomework(d.lesson.homework ?? "");
        setMarks(Object.fromEntries(d.students.map((s) => [s.id, { mark: s.mark, late: s.late_minutes?.toString() ?? "" }])));
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка"); }
  }, [c, date, slot]);
  useEffect(() => { void load(); }, [load]);

  if (error) return <Card><CardContent className="py-10 text-center text-slate-500">{error}</CardContent></Card>;
  if (!data) return <Card><CardContent className="py-10 text-center"><Loader2 className="mx-auto size-5 animate-spin" /></CardContent></Card>;
  const flash = (ok: boolean, text: string) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 4000); };

  async function saveAll() {
    try {
      await http.patch(`/journal/lessons/${data!.lesson.id}`, { topic: topic || null, homework: homework || null });
      const items = Object.entries(marks).filter(([, m]) => m.mark).map(([sid, m]) => ({ student_id: Number(sid), mark: m.mark, late_minutes: m.mark === "LATE" && m.late ? Number(m.late) : null }));
      const r = items.length ? await http.put<{ saved: number; notified: number }>(`/journal/lessons/${data!.lesson.id}/attendance`, items) : { saved: 0, notified: 0 };
      flash(true, `Сохранено. Отметок: ${r.saved}` + (r.notified ? `, уведомлено о пропусках/опозданиях: ${r.notified}` : ""));
      onSaved(); await load();
    } catch (e) { flash(false, e instanceof Error ? e.message : "Ошибка"); }
  }
  async function addGrade(studentId: number) {
    try {
      await http.post("/journal/grades", { student_id: studentId, subject_id: c.subject_id, class_id: c.class_id, date, lesson_id: data!.lesson.id,
        value: Number(draft.value), kind: draft.kind, comment: draft.comment || null });
      setAdding(null); setDraft({ value: "5", kind: "CLASSWORK", comment: "" }); await load(true);
    } catch (e) { flash(false, e instanceof Error ? e.message : "Ошибка"); }
  }
  async function delGrade(id: number) { await http.del(`/journal/grades/${id}`); await load(true); }
  const allPresent = () => setMarks(Object.fromEntries(data.students.map((s) => [s.id, { mark: marks[s.id]?.mark ?? "PRESENT", late: marks[s.id]?.late ?? "" }])));

  return (
    <Card>
      <CardHeader><CardTitle>{c.class_name} · {c.subject_name} · {formatDate(date)}, {slot}-й урок</CardTitle>
        {msg && <span className={cn("rounded px-2 py-1 text-xs font-medium text-white", msg.ok ? "bg-emerald-600" : "bg-rose-600")}>{msg.text}</span>}</CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <Input placeholder="Тема урока" value={topic} onChange={(e) => setTopic(e.target.value)} disabled={!c.can_write} />
          <Input placeholder="Домашнее задание (увидят ученики и родители)" value={homework} onChange={(e) => setHomework(e.target.value)} disabled={!c.can_write} />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>✓ присутствует · <b className="text-amber-600">оп</b> опоздал · <b className="text-rose-600">н</b> нет · ув — уважительная. О «н» и «оп» сразу узнают классный руководитель, куратор, завуч по воспитательной части и родители.</span>
          {c.can_write && <Button size="sm" variant="ghost" onClick={allPresent}>Все присутствуют</Button>}
        </div>
        {data.students.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500">В классе пока нет учеников. Загрузите их в разделе «Ученики».</p>}
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {data.students.map((s, i) => (
              <tr key={s.id}>
                <td className="w-6 py-1.5 text-xs text-slate-400">{i + 1}</td>
                <td className="py-1.5 font-medium">{s.full_name}</td>
                <td className="py-1.5">
                  <div className="flex items-center gap-1">
                    {MARKS.map(([m, label, color]) => (
                      <button key={m} disabled={!c.can_write} onClick={() => setMarks({ ...marks, [s.id]: { ...marks[s.id], mark: marks[s.id]?.mark === m ? null : m } })}
                        className={cn("h-7 w-8 cursor-pointer rounded text-xs font-bold", marks[s.id]?.mark === m ? `${color} text-white` : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>{label}</button>
                    ))}
                    {marks[s.id]?.mark === "LATE" && <Input className="h-7 w-16 text-xs" placeholder="мин" value={marks[s.id].late}
                      onChange={(e) => setMarks({ ...marks, [s.id]: { ...marks[s.id], late: e.target.value } })} />}
                  </div>
                </td>
                <td className="py-1.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {s.grades.map((g) => (
                      <span key={g.id} title={`${KIND[g.kind]}${g.comment ? `: ${g.comment}` : ""}`}
                        className={cn("group inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-bold text-white", gradeColor(g.value))}>
                        {g.value}{g.comment && <span className="font-normal">*</span>}
                        {c.can_write && <button className="hidden cursor-pointer group-hover:inline" onClick={() => delGrade(g.id)}><X className="size-3" /></button>}
                      </span>
                    ))}
                    {c.can_write && adding !== s.id && <button className="cursor-pointer rounded p-0.5 text-slate-400 hover:bg-slate-100" onClick={() => setAdding(s.id)}><Plus className="size-4" /></button>}
                    {adding === s.id && (
                      <span className="flex items-center gap-1">
                        <Select className="h-7 w-14 text-xs" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })}>
                          {Array.from({ length: data.grade_max }, (_, k) => data.grade_max - k).map((v) => <option key={v}>{v}</option>)}
                        </Select>
                        <Select className="h-7 w-36 text-xs" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
                          {Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </Select>
                        <Input className="h-7 w-44 text-xs" placeholder="комментарий" value={draft.comment} onChange={(e) => setDraft({ ...draft, comment: e.target.value })} />
                        <Button size="sm" className="h-7" onClick={() => addGrade(s.id)}>OK</Button>
                        <button className="cursor-pointer text-slate-400" onClick={() => setAdding(null)}><X className="size-4" /></button>
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {c.can_write && <Button onClick={saveAll}><Save className="size-4" /> Сохранить урок и посещаемость</Button>}
      </CardContent>
    </Card>
  );
}

interface BookRow { student_id: number; full_name: string; grades: GradeChip[]; average: number | null; suggested: number | null; period_grade: number | null; all_periods: Record<string, number> }
interface Book { school_year: string; period: string; bounds: [string, string] | null; rows: BookRow[]; can_write: boolean; grade_max: number }

function GradebookTab({ c }: { c: MyClass }) {
  const [period, setPeriod] = useState("Q2");
  const [book, setBook] = useState<Book | null>(null);
  const [finals, setFinals] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    const b = await http.get<Book>("/journal/gradebook", { class_id: c.class_id, subject_id: c.subject_id, period });
    setBook(b); setFinals(Object.fromEntries(b.rows.map((r) => [r.student_id, r.period_grade?.toString() ?? ""])));
  }, [c, period]);
  useEffect(() => { void load(); }, [load]);
  const changed = useMemo(() => book?.rows.filter((r) => finals[r.student_id] && Number(finals[r.student_id]) !== r.period_grade) ?? [], [book, finals]);
  if (!book) return null;

  async function save() {
    try {
      await http.put("/journal/period-grades", { class_id: c.class_id, subject_id: c.subject_id, period,
        grades: changed.map((r) => ({ student_id: r.student_id, value: Number(finals[r.student_id]) })) });
      setMsg(`Сохранено итоговых оценок: ${changed.length}`); await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Ошибка"); }
  }
  return (
    <Card>
      <CardHeader className="flex-wrap">
        <div className="flex items-center gap-2">
          <Select className="w-52" value={period} onChange={(e) => setPeriod(e.target.value)}>{PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
          <span className="text-xs text-slate-500">{book.school_year}{book.bounds && ` · ${formatDate(book.bounds[0])} – ${formatDate(book.bounds[1])}`}</span>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="text-xs text-slate-600">{msg}</span>}
          {book.can_write && <Button size="sm" disabled={changed.length === 0} onClick={save}><Save className="size-3.5" /> Выставить итоговые ({changed.length})</Button>}
          {book.can_write && <Button size="sm" variant="outline" onClick={() => setFinals(Object.fromEntries(book.rows.map((r) => [r.student_id, finals[r.student_id] || (r.suggested?.toString() ?? "")])))}>Подставить по среднему</Button>}
        </div>
      </CardHeader>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr><th className="px-4 py-2">Ученик</th><th className="px-4 py-2">Оценки за период</th><th className="px-4 py-2 text-center">Средний</th><th className="px-4 py-2 text-center">Итог</th><th className="px-4 py-2">Другие периоды</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {book.rows.map((r) => (
            <tr key={r.student_id}>
              <td className="px-4 py-1.5 font-medium">{r.full_name}</td>
              <td className="px-4 py-1.5"><div className="flex flex-wrap gap-1">{r.grades.map((g) => (
                <span key={g.id} title={`${formatDate(g.date)} · ${KIND[g.kind]}${g.comment ? `: ${g.comment}` : ""}`} className={cn("rounded px-1.5 py-0.5 text-xs font-bold text-white", gradeColor(g.value))}>{g.value}</span>
              ))}{r.grades.length === 0 && <span className="text-xs text-slate-400">нет оценок</span>}</div></td>
              <td className="px-4 py-1.5 text-center tabular-nums">{r.average ?? "—"}</td>
              <td className="px-4 py-1.5 text-center">
                <Select className={cn("h-8 w-16", r.suggested && !finals[r.student_id] && "border-dashed")} disabled={!book.can_write} value={finals[r.student_id] ?? ""}
                  onChange={(e) => setFinals({ ...finals, [r.student_id]: e.target.value })}>
                  <option value="">{r.suggested ? `(${r.suggested})` : "—"}</option>
                  {Array.from({ length: book.grade_max }, (_, k) => book.grade_max - k).map((v) => <option key={v}>{v}</option>)}
                </Select>
              </td>
              <td className="px-4 py-1.5 text-xs text-slate-500">{Object.entries(r.all_periods).filter(([k]) => k !== period).map(([k, v]) => `${PERIODS.find((p) => p[0] === k)?.[1]}: ${v}`).join(" · ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
