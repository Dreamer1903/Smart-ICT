// Дневник ученика / родителя: неделя (расписание, темы, ДЗ, оценки, посещаемость), оценки по предметам, ДЗ.
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { http } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import { gradeColor } from "@/pages/JournalPage";

interface Child { id: number; full_name: string; class_name: string }
interface DayLesson { slot: number; time: string | null; subject: string; teacher: string; room: string | null; topic: string | null; homework: string | null; mark: string | null; late_minutes: number | null; grades: { value: number; kind: string; comment: string | null }[] }
interface Week { student: Child; monday: string; days: { date: string; weekday: string; lessons: DayLesson[] }[] }
interface SubjectGrades { subject: string; average: number | null; grades: { date: string; value: number; kind: string; comment: string | null }[]; periods: Record<string, { value: number; comment: string | null }> }

const PERIOD_LABEL: [string, string][] = [["Q1", "1 ч"], ["Q2", "2 ч"], ["Q3", "3 ч"], ["Q4", "4 ч"], ["H1", "1 пол"], ["H2", "2 пол"], ["YEAR", "Год"], ["FINAL", "Аттест."]];
const MARK: Record<string, [string, string]> = { ABSENT: ["не был", "text-rose-700"], LATE: ["опоздал", "text-amber-700"], EXCUSED: ["уважит.", "text-slate-500"], PRESENT: ["был", "text-emerald-700"] };
const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export function DiaryPage() {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState<number | null>(null);
  const [tab, setTab] = useState<"week" | "grades" | "homework">("week");
  const [date, setDate] = useState(() => new Date());
  const [week, setWeek] = useState<Week | null>(null);
  const [grades, setGrades] = useState<SubjectGrades[]>([]);
  const [homework, setHomework] = useState<{ date: string; subject: string; homework: string; topic: string | null }[]>([]);

  useEffect(() => { http.get<Child[]>("/diary/children").then((c) => { setChildren(c); setChildId(c[0]?.id ?? null); }); }, []);
  useEffect(() => {
    if (!childId) return;
    if (tab === "week") http.get<Week>("/diary/week", { student_id: childId, date: iso(date) }).then(setWeek);
    if (tab === "grades") http.get<{ subjects: SubjectGrades[] }>("/diary/grades", { student_id: childId }).then((r) => setGrades(r.subjects));
    if (tab === "homework") http.get<typeof homework>("/diary/homework", { student_id: childId, days: 30 }).then(setHomework);
  }, [childId, tab, date]);
  const shift = (d: number) => { const x = new Date(date); x.setDate(x.getDate() + d); setDate(x); };
  const child = children.find((c) => c.id === childId);

  if (children.length === 0) return <Card><CardContent className="py-10 text-center text-slate-500">
    {user?.role === "Parent" ? "К вашей учётной записи пока не привязан ни один ученик. Обратитесь в школу." : "Нет данных дневника"}</CardContent></Card>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><BookOpen className="size-6 text-indigo-600" /> Дневник
          {child && <span className="text-lg font-normal text-slate-500">· {child.full_name}, {child.class_name}</span>}</h1>
        {children.length > 1 && <Select className="w-64" value={childId ?? ""} onChange={(e) => setChildId(Number(e.target.value))}>
          {children.map((c) => <option key={c.id} value={c.id}>{c.full_name} ({c.class_name})</option>)}</Select>}
      </div>
      <div className="flex gap-1">
        {([["week", "Неделя"], ["grades", "Оценки"], ["homework", "Домашние задания"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={cn("cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium", tab === id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}>{label}</button>
        ))}
      </div>

      {tab === "week" && week && (
        <>
          <div className="flex items-center gap-2">
            <button className="cursor-pointer rounded p-1.5 hover:bg-slate-100" onClick={() => shift(-7)}><ChevronLeft className="size-4" /></button>
            <span className="font-medium">Неделя с {formatDate(week.monday)}</span>
            <button className="cursor-pointer rounded p-1.5 hover:bg-slate-100" onClick={() => shift(7)}><ChevronRight className="size-4" /></button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {week.days.map((d) => (
              <Card key={d.date} className={cn(d.date === iso(new Date()) && "border-indigo-400 ring-1 ring-indigo-300")}>
                <CardHeader><CardTitle>{d.weekday}, {formatDate(d.date)}</CardTitle></CardHeader>
                <CardContent className="space-y-2 p-3">
                  {d.lessons.length === 0 && <p className="text-sm text-slate-400">Уроков нет</p>}
                  {d.lessons.map((l) => (
                    <div key={l.slot} className="rounded-lg border border-slate-100 p-2 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div><span className="text-xs text-slate-400">{l.slot}. {l.time}</span> <b>{l.subject}</b></div>
                        <div className="flex gap-1">{l.grades.map((g, i) => (
                          <span key={i} title={g.comment ?? ""} className={cn("rounded px-1.5 text-xs font-bold text-white", gradeColor(g.value))}>{g.value}</span>))}</div>
                      </div>
                      {l.topic && <div className="text-xs text-slate-600">Тема: {l.topic}</div>}
                      {l.homework && <div className="text-xs"><b className="text-indigo-700">ДЗ:</b> {l.homework}</div>}
                      {l.grades.filter((g) => g.comment).map((g, i) => <div key={i} className="text-xs italic text-slate-500">«{g.comment}»</div>)}
                      {l.mark && l.mark !== "PRESENT" && <div className={cn("text-xs font-medium", MARK[l.mark][1])}>{MARK[l.mark][0]}{l.late_minutes ? ` на ${l.late_minutes} мин` : ""}</div>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {tab === "grades" && (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2">Предмет</th><th className="px-4 py-2">Оценки</th><th className="px-4 py-2 text-center">Средний</th>
                {PERIOD_LABEL.map(([k, l]) => <th key={k} className="px-2 py-2 text-center">{l}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grades.map((s) => (
                <tr key={s.subject}>
                  <td className="px-4 py-2 font-medium">{s.subject}</td>
                  <td className="px-4 py-2"><div className="flex flex-wrap gap-1">{s.grades.map((g, i) => (
                    <span key={i} title={`${formatDate(g.date)}${g.comment ? `: ${g.comment}` : ""}`} className={cn("rounded px-1.5 text-xs font-bold text-white", gradeColor(g.value))}>{g.value}</span>))}</div></td>
                  <td className="px-4 py-2 text-center tabular-nums">{s.average ?? "—"}</td>
                  {PERIOD_LABEL.map(([k]) => <td key={k} className="px-2 py-2 text-center font-semibold" title={s.periods[k]?.comment ?? ""}>{s.periods[k]?.value ?? ""}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="p-3 text-xs text-slate-500">Наведите на оценку, чтобы увидеть дату и комментарий учителя.</p>
        </Card>
      )}

      {tab === "homework" && (
        <Card><CardContent className="divide-y divide-slate-100 p-0">
          {homework.length === 0 && <p className="p-6 text-center text-slate-500">Домашних заданий нет</p>}
          {homework.map((h, i) => (
            <div key={i} className="px-5 py-3 text-sm"><div className="text-xs text-slate-500">{formatDate(h.date)} · {h.subject}{h.topic ? ` · ${h.topic}` : ""}</div><div>{h.homework}</div></div>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}
