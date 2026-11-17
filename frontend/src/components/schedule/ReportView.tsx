// Отчёт по расписанию (для директора и завуча).
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TTReport } from "./types";

function List({ title, items, empty, tone }: { title: string; items: string[]; empty: string; tone: string }) {
  return (
    <div>
      <div className="mb-1 text-sm font-semibold">{title} <span className="text-slate-400">({items.length})</span></div>
      {items.length === 0 ? <p className="text-sm text-emerald-700">{empty}</p>
        : <ul className={`max-h-40 space-y-0.5 overflow-y-auto text-xs ${tone}`}>{items.map((x) => <li key={x}>• {x}</li>)}</ul>}
    </div>
  );
}

export function ReportView({ report, title = "Отчёт по расписанию" }: { report: TTReport; title?: string }) {
  const windows = Object.entries(report.teacher_windows ?? {});
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {report.ok
          ? <span className="flex items-center gap-1 text-sm font-medium text-emerald-700"><CheckCircle2 className="size-4" /> без конфликтов</span>
          : <span className="flex items-center gap-1 text-sm font-medium text-rose-700"><AlertTriangle className="size-4" /> есть проблемы</span>}
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-slate-50 p-2"><div className="text-2xl font-bold">{report.lessons_placed}/{report.lessons_planned}</div><div className="text-xs text-slate-500">уроков расставлено</div></div>
            <div className="rounded-lg bg-slate-50 p-2"><div className={`text-2xl font-bold ${report.conflicts.length ? "text-rose-700" : "text-emerald-700"}`}>{report.conflicts.length}</div><div className="text-xs text-slate-500">конфликтов</div></div>
            <div className="rounded-lg bg-slate-50 p-2"><div className="text-2xl font-bold">{report.wishes_violated.length}</div><div className="text-xs text-slate-500">пожеланий нарушено</div></div>
          </div>
          <List title="Конфликты (накладки)" items={report.conflicts} empty="Нет: ни у учителя, ни у класса, ни в кабинете нет двух уроков одновременно" tone="text-rose-700" />
          <List title="Нарушенные пожелания учителей" items={report.wishes_violated} empty="Все пожелания соблюдены" tone="text-amber-700" />
          <List title="Окна у классов" items={report.class_gaps} empty="Нет: уроки идут подряд с первого" tone="text-amber-700" />
          {report.solver && <p className="text-xs text-slate-500">Помощник: {report.solver.status === "OPTIMAL" ? "лучший вариант найден" : "хороший вариант найден"} за {report.solver.seconds} с</p>}
        </div>
        <div className="space-y-4">
          <div>
            <div className="mb-1 text-sm font-semibold">Уроков в день по классам</div>
            <table className="w-full text-xs">
              <tbody>
                {Object.entries(report.class_days ?? {}).map(([cls, days]) => (
                  <tr key={cls} className="border-b border-slate-50">
                    <td className="py-0.5 font-medium">{cls}</td>
                    {Object.entries(days).map(([d, n]) => <td key={d} className="text-center tabular-nums">{d} {n}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div className="mb-1 text-sm font-semibold">Нагрузка и окна учителей</div>
            <table className="w-full text-xs">
              <tbody>
                {Object.entries(report.teacher_load ?? {}).map(([t, h]) => (
                  <tr key={t} className="border-b border-slate-50">
                    <td className="py-0.5">{t}</td><td className="text-right tabular-nums">{h} ч</td>
                    <td className="w-24 text-right tabular-nums text-slate-500">{(report.teacher_windows ?? {})[t] ? `окон: ${report.teacher_windows[t]}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {windows.length === 0 && <p className="text-xs text-emerald-700">Окон у учителей нет</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
