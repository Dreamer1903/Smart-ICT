// Таблица мониторинга учеников (TanStack Table): сортировка, глобальный поиск, подсветка изменений.
import {
  createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel,
  useReactTable, type SortingState,
} from "@tanstack/react-table";
import { ArrowDownUp, LogIn, LogOut } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "@/components/StatusBadge";
import type { LocationStatus, StudentLiveRow } from "@/lib/types";
import { cn, formatTime, minutesAgo } from "@/lib/utils";

// Порядок «тревожности» для сортировки по статусу
const STATUS_RANK: Record<LocationStatus, number> = { IN_BUILDING: 0, UNKNOWN: 1, IN_NURSE: 2, IN_BOARDING: 3, LEFT_SCHOOL: 4, IN_CLASS: 5 };
const rank = (r: StudentLiveRow) => (r.is_discrepancy ? -1 : STATUS_RANK[r.status]);

const col = createColumnHelper<StudentLiveRow>();

interface Props {
  rows: StudentLiveRow[];
  globalFilter: string;
  flashIds: Set<number>;
}

export function StudentsTable({ rows, globalFilter, flashIds }: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "status", desc: false }]);

  const columns = useMemo(
    () => [
      col.accessor("full_name", {
        header: "Ученик",
        cell: (c) => (
          <Link to={`/students/${c.row.original.student_id}`} className="font-medium hover:text-indigo-700 hover:underline">
            {c.getValue()}
            {c.row.original.is_boarder && <span className="ml-1.5 rounded bg-violet-100 px-1 text-[10px] font-semibold text-violet-700">П</span>}
          </Link>
        ),
      }),
      col.accessor("class_name", { header: "Класс" }),
      col.accessor((r) => rank(r), {
        id: "status",
        header: "Статус",
        cell: (c) => <StatusBadge status={c.row.original.status} discrepancy={c.row.original.is_discrepancy} />,
      }),
      col.accessor("reason", {
        header: "Где находится / причина",
        cell: (c) => <span className={cn(c.row.original.is_discrepancy && "font-medium text-rose-700")}>{c.getValue()}</span>,
      }),
      col.accessor("since", {
        header: "С какого времени",
        cell: (c) =>
          c.row.original.status === "UNKNOWN" ? <span className="text-slate-400">—</span> : (
          <span title={c.getValue() ?? ""} className="whitespace-nowrap text-slate-600">
            {formatTime(c.getValue())} <span className="text-xs text-slate-400">{minutesAgo(c.getValue())}</span>
          </span>
          ),
      }),
      col.accessor("last_gate_at", {
        header: "СКУД",
        cell: (c) => {
          const dir = c.row.original.last_gate_direction;
          if (!dir) return <span className="text-slate-400">—</span>;
          const Icon = dir === "IN" ? LogIn : LogOut;
          return (
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-slate-600">
              <Icon className={cn("size-3.5", dir === "IN" ? "text-emerald-600" : "text-slate-500")} />
              {dir} {formatTime(c.getValue())}
            </span>
          );
        },
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    getRowId: (r) => String(r.student_id),
    globalFilterFn: (row, _id, value: string) => {
      const q = value.toLowerCase();
      const r = row.original;
      return [r.full_name, r.class_name, r.reason].some((s) => s.toLowerCase().includes(q));
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id} className="px-4 py-2.5 font-semibold">
                  <button className="inline-flex cursor-pointer items-center gap-1 hover:text-slate-800" onClick={h.column.getToggleSortingHandler()}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    <ArrowDownUp className={cn("size-3", h.column.getIsSorted() ? "text-indigo-600" : "opacity-30")} />
                  </button>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-slate-100">
          {table.getRowModel().rows.length === 0 && (
            <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">Нет учеников по фильтру</td></tr>
          )}
          {table.getRowModel().rows.map((row) => (
            <tr
              key={`${row.id}-${flashIds.has(row.original.student_id) ? row.original.since : ""}`}
              className={cn(
                "hover:bg-slate-50",
                row.original.is_discrepancy && "bg-rose-50/60",
                flashIds.has(row.original.student_id) && "row-flash",
              )}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-2.5">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
