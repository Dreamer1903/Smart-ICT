// Сетка расписания: дни × уроки. mode определяет, что писать в клетке.
import { Lock } from "lucide-react";
import { useState } from "react";
import { cn, DAY_NAMES } from "@/lib/utils";
import type { Bells, TTEntry } from "./types";

const COLORS = ["bg-sky-50 border-sky-200", "bg-emerald-50 border-emerald-200", "bg-amber-50 border-amber-200",
  "bg-violet-50 border-violet-200", "bg-rose-50 border-rose-200", "bg-lime-50 border-lime-200", "bg-cyan-50 border-cyan-200",
  "bg-orange-50 border-orange-200", "bg-indigo-50 border-indigo-200", "bg-teal-50 border-teal-200"];

interface Props {
  bells: Bells;
  entries: TTEntry[];
  mode: "class" | "teacher" | "room";
  selectedId?: number | null;
  onCellClick?: (day: number, slot: number, entry: TTEntry | null) => void;
  highlight?: (day: number, slot: number) => "ok" | "bad" | "warn" | null;
}

export function TimetableGrid({ bells, entries, mode, selectedId, onCellClick, highlight }: Props) {
  const at = (d: number, s: number) => entries.filter((e) => e.day === d && e.slot === s);
  const today = new Date().getDay() || 7;
  const [day, setDay] = useState(bells.days.includes(today) ? today : bells.days[0]);
  const second = (e: TTEntry) => mode === "class" ? e.teacher_name : mode === "teacher" ? e.subject_name : `${e.class_name} · ${e.teacher_name}`;
  return (
    <>
      {/* Телефон: выбор дня + список уроков */}
      <div className="md:hidden">
        <div className="mb-3 flex gap-1 overflow-x-auto">
          {bells.days.map((d) => (
            <button key={d} onClick={() => setDay(d)} className={cn("min-w-11 cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold",
              d === day ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600")}>{DAY_NAMES[d]}</button>
          ))}
        </div>
        <div className="space-y-1.5">
          {bells.slots.map((b) => {
            const cell = at(day, b.number);
            const hl = highlight?.(day, b.number);
            return (
              <div key={b.number} onClick={() => onCellClick?.(day, b.number, cell[0] ?? null)}
                className={cn("flex items-stretch gap-3 rounded-lg border p-2", onCellClick && "cursor-pointer",
                  cell.length ? COLORS[cell[0].subject_id % COLORS.length] : "border-dashed border-slate-200 bg-white",
                  cell[0] && selectedId === cell[0].id && "ring-2 ring-indigo-600",
                  hl === "ok" && "ring-2 ring-emerald-400", hl === "warn" && "ring-2 ring-amber-400", hl === "bad" && "opacity-40")}>
                <div className="w-12 shrink-0 text-xs text-slate-500"><div className="font-semibold text-slate-700">{b.number} урок</div>{b.start_time}</div>
                {cell.length ? cell.map((e) => (
                  <div key={e.id} className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 font-semibold">{mode === "teacher" ? `${e.class_name} · ${e.subject_name}` : e.subject_name}
                      {e.locked && <Lock className="size-3 text-slate-500" />}</div>
                    <div className="truncate text-xs text-slate-600">{mode === "teacher" ? e.room_name ?? "" : second(e)}{mode !== "teacher" && e.room_name ? ` · ${e.room_name}` : ""}</div>
                  </div>
                )) : <div className="flex-1 self-center text-xs text-slate-400">—</div>}
              </div>
            );
          })}
        </div>
      </div>
      {/* Планшет и компьютер: сетка дни × уроки */}
      <div className="hidden overflow-x-auto md:block">
      <table className="w-full table-fixed border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th className="w-20" />
            {bells.days.map((d) => <th key={d} className="py-1 text-sm font-semibold text-slate-600">{DAY_NAMES[d]}</th>)}
          </tr>
        </thead>
        <tbody>
          {bells.slots.map((b) => (
            <tr key={b.number}>
              <td className="align-top text-slate-500">
                <div className="font-semibold text-slate-700">{b.number}</div>
                <div className="tabular-nums">{b.start_time}</div>
              </td>
              {bells.days.map((d) => {
                const cell = at(d, b.number);
                const hl = highlight?.(d, b.number);
                return (
                  <td key={d} onClick={() => onCellClick?.(d, b.number, cell[0] ?? null)}
                    className={cn("h-16 rounded-md border align-top", onCellClick && "cursor-pointer",
                      cell.length === 0 && "border-dashed border-slate-200 bg-white",
                      hl === "ok" && "ring-2 ring-emerald-400", hl === "warn" && "ring-2 ring-amber-400", hl === "bad" && "opacity-40")}>
                    {cell.map((e) => (
                      <div key={e.id} className={cn("h-full rounded-md border p-1.5", COLORS[e.subject_id % COLORS.length],
                        selectedId === e.id && "ring-2 ring-indigo-600")}>
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-semibold leading-tight">{mode === "teacher" ? e.class_name : e.subject_name}</span>
                          {e.locked && <Lock className="size-3 shrink-0 text-slate-500" />}
                        </div>
                        <div className="truncate text-[11px] text-slate-600">
                          {mode === "class" ? e.teacher_name.split(" ").slice(0, 2).join(" ") : mode === "teacher" ? e.subject_name : `${e.class_name} · ${e.teacher_name.split(" ")[0]}`}
                        </div>
                        {e.room_name && <div className="truncate text-[10px] text-slate-500">{e.room_name}</div>}
                      </div>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}
