// Список учеников: поиск, класс, статус (учится / на приёме), пансионат, где сейчас.
import { FileSpreadsheet, Search, Users } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { ImportStudents } from "@/components/ImportStudents";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { SchoolClass, Student } from "@/lib/types";

export function StudentsPage() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "ACTIVE" | "ENROLLING" | "boarders">("all");
  const [showImport, setShowImport] = useState(false);
  const [reload, setReload] = useState(0);
  const { user } = useAuth();
  const canImport = !!user && ["SuperAdmin", "Director", "Zavuch", "ParentRelations"].includes(user.role);

  useEffect(() => { api.classes().then(setClasses); }, [reload]);
  useEffect(() => {
    const t = setTimeout(() => api.students({ search: search.trim() || undefined, class_id: classId, limit: 500 }).then(setStudents), 200);
    return () => clearTimeout(t);
  }, [search, classId, reload]);

  const rows = useMemo(() => students.filter((s) =>
    filter === "all" ? s.student_status !== "WITHDRAWN" : filter === "boarders" ? s.is_boarder : s.student_status === filter,
  ), [students, filter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Users className="size-6 text-indigo-600" /> Ученики</h1>
        {canImport && <Button variant="outline" onClick={() => setShowImport(true)}><FileSpreadsheet className="size-4" /> Загрузить из Excel</Button>}
      </div>
      {showImport && <ImportStudents onClose={() => setShowImport(false)} onDone={() => setReload((x) => x + 1)} />}
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-slate-400" />
            <Input className="pl-8" placeholder="ФИО или RFID…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select className="w-[48%] sm:w-36" value={classId ?? ""} onChange={(e) => setClassId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Все классы</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select className="w-[48%] sm:w-44" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="all">Все</option><option value="ACTIVE">Учатся</option>
            <option value="ENROLLING">На приёме</option><option value="boarders">Пансионеры</option>
          </Select>
          <span className="ml-auto text-sm text-slate-500">{rows.length} учеников</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-2">Ученик</th><th className="px-4 py-2">Класс</th><th className="hidden px-4 py-2 sm:table-cell">Пансионат</th>
              <th className="px-4 py-2">Статус</th><th className="hidden px-4 py-2 md:table-cell">Сейчас</th><th className="hidden px-4 py-2 lg:table-cell">Телефон родителя</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5"><Link to={`/students/${s.id}`} className="font-medium hover:text-indigo-700 hover:underline">{s.full_name}</Link></td>
                <td className="px-4 py-2.5">{s.class_name}</td>
                <td className="hidden px-4 py-2.5 sm:table-cell">{s.is_boarder === null ? <span className="text-slate-400">не отмечено</span> : s.is_boarder ? "да" : "нет"}</td>
                <td className="px-4 py-2.5">
                  {s.student_status === "ENROLLING" ? <Badge className="bg-amber-100 text-amber-800 ring-amber-600/20">На приёме</Badge>
                    : s.student_status === "WITHDRAWN" ? <Badge className="bg-slate-100 text-slate-600 ring-slate-500/20">Выбыл</Badge>
                      : <Badge className="bg-emerald-100 text-emerald-800 ring-emerald-600/20">Учится</Badge>}
                </td>
                <td className="hidden px-4 py-2.5 md:table-cell">{s.student_status === "ACTIVE" ? <StatusBadge status={s.status} /> : <span className="text-slate-400">—</span>}</td>
                <td className="hidden px-4 py-2.5 tabular-nums text-slate-600 lg:table-cell">{s.parent_phone ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
