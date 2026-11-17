// Пожелания учителя к расписанию: клетка ✓ → «лучше нет» → «нет» (не могу).
import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import type { Bells } from "@/components/schedule/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { http } from "@/lib/api";
import { PrefGrid } from "@/pages/SchedulePage";

interface Pref { cells: Record<string, string>; max_lessons_per_day: number | null; comment: string | null }

export function PreferencesPage() {
  const [bells, setBells] = useState<Bells | null>(null);
  const [pref, setPref] = useState<Pref>({ cells: {}, max_lessons_per_day: null, comment: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    http.get<Bells>("/academic/bells").then(setBells);
    http.get<Pref>("/timetable/preferences/me").then((p) => setPref({ ...p, comment: p.comment ?? "" }));
  }, []);
  if (!bells) return <Loader2 className="size-6 animate-spin text-indigo-600" />;

  const toggle = (key: string) => {
    const next = { ...pref.cells };
    const v = next[key];
    if (!v) next[key] = "avoid"; else if (v === "avoid") next[key] = "no"; else delete next[key];
    setPref({ ...pref, cells: next });
  };
  const setDay = (day: number, value: "no" | "avoid" | null) => {
    const next = { ...pref.cells };
    bells.slots.forEach((s) => { if (value) next[`${day}-${s.number}`] = value; else delete next[`${day}-${s.number}`]; });
    setPref({ ...pref, cells: next });
  };
  async function save() {
    setBusy(true);
    try {
      await http.put("/timetable/preferences/me", { cells: pref.cells, max_lessons_per_day: pref.max_lessons_per_day || null, comment: pref.comment || null });
      setMsg("Сохранено. Завуч по учебной части получил уведомление.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Ошибка"); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Мои пожелания к расписанию</h1>
      <Card>
        <CardHeader><CardTitle>Когда мне удобно</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">Нажимайте на клетку: <b className="text-emerald-700">✓</b> — можно, <b className="text-amber-700">«лучше нет»</b> — по возможности не ставить
            (например, первые уроки), <b className="text-rose-700">«нет»</b> — не могу совсем (совместитель, другая работа). «Нет» помощник соблюдает всегда.</p>
          <PrefGrid bells={bells} cells={pref.cells} onToggle={toggle} />
          <div className="flex flex-wrap gap-2 text-xs">
            <Button size="sm" variant="outline" onClick={() => { const n = { ...pref.cells }; bells.days.forEach((d) => { n[`${d}-1`] = "avoid"; }); setPref({ ...pref, cells: n }); }}>Не ставить первые уроки</Button>
            {bells.days.map((d) => <Button key={d} size="sm" variant="ghost" onClick={() => setDay(d, "no")}>Не прихожу: {bells.day_names[d]}</Button>)}
            <Button size="sm" variant="ghost" onClick={() => setPref({ ...pref, cells: {} })}>Очистить</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
            <label className="text-sm">Не больше уроков в день
              <Input type="number" min={1} max={12} value={pref.max_lessons_per_day ?? ""} onChange={(e) => setPref({ ...pref, max_lessons_per_day: e.target.value ? Number(e.target.value) : null })} />
            </label>
            <label className="text-sm">Комментарий для завуча
              <Input value={pref.comment ?? ""} onChange={(e) => setPref({ ...pref, comment: e.target.value })} placeholder="Например: совместитель, во вторник и четверг работаю в другой школе" />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Сохранить</Button>
            {msg && <span className="text-sm text-slate-600">{msg}</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
