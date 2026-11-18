// Посещаемость за день: кто когда пришёл и ушёл (по турникетам), кто опоздал, кто не пришёл.
import { CalendarCheck, Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { AttendanceReport, SchoolClass } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";

const todayLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export function AttendancePage() {
  const [date, setDate] = useState(todayLocal());
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [filter, setFilter] = useState<"all" | "absent" | "late">("all");

  useEffect(() => { api.classes().then(setClasses); }, []);
  useEffect(() => { api.attendance({ date, class_id: classId }).then(setReport); }, [date, classId]);

  const rows = useMemo(() => (report?.rows ?? []).filter((r) =>
    filter === "absent" ? !r.came && !r.is_boarder : filter === "late" ? r.late : true), [report, filter]);

  function exportCsv() {
    if (!report) return;
    const lines = [["Ученик", "Класс", "Пансионат", "Пришёл", "Ушёл", "Опоздал", "Отказы"].join(";"),
      ...report.rows.map((r) => [r.full_name, r.class_name, r.is_boarder ? "да" : "", formatTime(r.first_in), formatTime(r.last_out),
        r.late ? "да" : "", r.denied || ""].join(";"))];
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `schoolos-attendance-${report.date}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const s = report?.summary;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><CalendarCheck className="size-6 text-indigo-600" /> Посещаемость</h1>
          <p className="text-sm text-slate-500">По турникетам. Начало занятий: {report?.school_start_time ?? "—"}; кто пришёл позже — опоздал.</p>
        </div>
        <div className="flex gap-2">
          <Input type="date" className="w-40" value={date} onChange={(e) => setDate(e.target.value)} />
          <Select className="w-36" value={classId ?? ""} onChange={(e) => setClassId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Все классы</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Button variant="outline" onClick={exportCsv}><Download className="size-4" /> Excel (CSV)</Button>
        </div>
      </div>

      {s && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {[["Всего", s.total, "text-slate-900"], ["Пришли", s.came, "text-emerald-700"], ["Опоздали", s.late, "text-amber-700"],
            ["Не пришли", s.absent, "text-rose-700"], ["Пансионеры", s.boarders, "text-violet-700"]].map(([label, v, color]) => (
            <Card key={label as string} className="p-4">
              <div className="text-xs font-medium text-slate-500">{label}</div>
              <div className={cn("mt-1 text-3xl font-bold tabular-nums", color as string)}>{v}</div>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <div className="flex gap-1 border-b border-slate-100 p-3">
          {([["all", "Все"], ["absent", "Не пришли"], ["late", "Опоздали"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)}
              className={cn("cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium", filter === id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}>{label}</button>
          ))}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-2">Ученик</th><th className="px-4 py-2">Класс</th><th className="px-4 py-2">Пришёл</th>
              <th className="px-4 py-2">Ушёл</th><th className="px-4 py-2">Отметки</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.student_id} className={cn(!r.came && !r.is_boarder && "bg-rose-50/40")}>
                <td className="px-4 py-2"><Link to={`/students/${r.student_id}`} className="font-medium hover:text-indigo-700 hover:underline">{r.full_name}</Link></td>
                <td className="px-4 py-2">{r.class_name}</td>
                <td className="px-4 py-2 tabular-nums">{formatTime(r.first_in)}</td>
                <td className="px-4 py-2 tabular-nums">{formatTime(r.last_out)}</td>
                <td className="space-x-1 px-4 py-2">
                  {r.late && <Badge className="bg-amber-100 text-amber-800 ring-amber-600/20">опоздал</Badge>}
                  {r.is_boarder && <Badge className="bg-violet-100 text-violet-800 ring-violet-600/20">пансионат</Badge>}
                  {!r.came && !r.is_boarder && <Badge className="bg-rose-100 text-rose-800 ring-rose-600/20">не пришёл</Badge>}
                  {r.denied > 0 && <Badge className="bg-rose-600 text-white ring-rose-700">отказ турникета ×{r.denied}</Badge>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Нет данных</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
