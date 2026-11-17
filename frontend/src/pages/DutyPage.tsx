// Дежурства: «Мои дежурства» (учитель), график недели с автосоставлением и заменой, посты и QR-коды, отчёт.
import { CalendarClock, ChevronLeft, ChevronRight, Loader2, Plus, Printer, QrCode, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { http } from "@/lib/api";
import { cn, DAY_NAMES, formatDate, formatTime } from "@/lib/utils";

export interface Duty { id: number; date: string; weekday: string; post_id: number; post_name: string; shift_id: number; shift_name: string;
  start_time: string; end_time: string; teacher_id: number; teacher_name: string; status: "PLANNED" | "STARTED" | "MISSED";
  checked_in_at: string | null; late_minutes: number | null; manual: boolean; lessons_that_day: number | null }
export interface Post { id: number; name: string; location: string | null; is_active: boolean; qr_token: string | null;
  shifts: { id: number; name: string; start_time: string; end_time: string; required: number }[] }

const MANAGERS = ["SuperAdmin", "ZavuchUpbringing", "Director", "Zavuch"];
const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const monday = (d: Date) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export function DutyStatusBadge({ d }: { d: Duty }) {
  if (d.status === "STARTED") return <Badge className={d.late_minutes ? "bg-amber-100 text-amber-800 ring-amber-600/20" : "bg-emerald-100 text-emerald-800 ring-emerald-600/20"}>
    {d.late_minutes ? `пришёл с опозданием ${d.late_minutes} мин` : `приступил ${formatTime(d.checked_in_at)}`}</Badge>;
  if (d.status === "MISSED") return <Badge className="bg-rose-600 text-white ring-rose-700">не пришёл</Badge>;
  return <Badge className="bg-slate-100 text-slate-600 ring-slate-500/20">назначен</Badge>;
}

export function DutyPage() {
  const { user } = useAuth();
  const isManager = !!user && MANAGERS.includes(user.role);
  const [tab, setTab] = useState<"my" | "roster" | "posts" | "report">(isManager ? "roster" : "my");
  const tabs: [typeof tab, string, boolean][] = [["roster", "График", isManager], ["my", "Мои дежурства", true], ["posts", "Посты и QR-коды", isManager], ["report", "Отчёт", isManager]];
  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><CalendarClock className="size-6 text-indigo-600" /> Дежурства</h1>
      <div className="flex flex-wrap gap-1">
        {tabs.filter(([, , v]) => v).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={cn("cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium", tab === id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}>{label}</button>
        ))}
      </div>
      {tab === "my" && <MyDuties />}
      {tab === "roster" && isManager && <Roster />}
      {tab === "posts" && isManager && <Posts />}
      {tab === "report" && isManager && <Report />}
    </div>
  );
}

function MyDuties() {
  const [items, setItems] = useState<Duty[] | null>(null);
  useEffect(() => { http.get<Duty[]>("/duty/my", { days: 30 }).then(setItems); }, []);
  if (!items) return null;
  const today = iso(new Date());
  const upcoming = items.filter((d) => d.date >= today);
  const past = items.filter((d) => d.date < today).reverse();
  return (
    <div className="space-y-4">
      <Card className="border-indigo-200 bg-indigo-50/40">
        <CardContent className="flex items-start gap-3 py-4 text-sm">
          <QrCode className="mt-0.5 size-6 shrink-0 text-indigo-600" />
          <div>На посту висит QR-код. Когда придёте на дежурство, <b>отсканируйте его камерой телефона</b> — откроется SchoolOS и отметит,
            что вы приступили. Отметиться можно за 20 минут до начала и до конца смены.</div>
        </CardContent>
      </Card>
      {upcoming.length === 0 && <Card><CardContent className="py-8 text-center text-slate-500">Ближайших дежурств нет</CardContent></Card>}
      <div className="grid gap-3 md:grid-cols-2">
        {upcoming.map((d) => (
          <Card key={d.id} className={cn(d.date === today && "border-indigo-400 ring-1 ring-indigo-300")}>
            <CardContent className="flex items-center justify-between gap-3 py-4">
              <div>
                <div className="text-xs text-slate-500">{d.date === today ? "Сегодня" : `${d.weekday}, ${formatDate(d.date)}`}</div>
                <div className="text-lg font-semibold">{d.post_name}</div>
                <div className="text-sm text-slate-600">{d.shift_name} · {d.start_time}–{d.end_time}</div>
              </div>
              <DutyStatusBadge d={d} />
            </CardContent>
          </Card>
        ))}
      </div>
      {past.length > 0 && (
        <Card><CardHeader><CardTitle>Прошедшие</CardTitle></CardHeader>
          <CardContent className="divide-y divide-slate-100 p-0">
            {past.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
                <span>{d.weekday}, {formatDate(d.date)} · {d.post_name}, {d.shift_name}</span><DutyStatusBadge d={d} />
              </div>
            ))}
          </CardContent></Card>
      )}
    </div>
  );
}

interface Teacher { id: number; full_name: string }

function Roster() {
  const [week, setWeek] = useState(() => monday(new Date()));
  const [items, setItems] = useState<Duty[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const end = addDays(week, 6);
  const load = useCallback(async () => setItems(await http.get<Duty[]>("/duty/roster", { date_from: iso(week), date_to: iso(end) })), [week]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { http.get<Post[]>("/duty/posts").then(setPosts); http.get<Teacher[]>("/academic/teachers").then(setTeachers); }, []);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)).filter((d) => items.some((x) => x.date === iso(d)) || d.getDay() !== 0 && d.getDay() !== 6), [week, items]);
  const flash = (ok: boolean, text: string) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 6000); };

  async function generate() {
    setBusy(true);
    try {
      const r = await http.post<{ assigned: number; kept: number; unfilled: string[] }>("/duty/generate", { date_from: iso(week), date_to: iso(end) });
      flash(r.unfilled.length === 0, `Назначено: ${r.assigned}${r.kept ? `, оставлено ручных/начатых: ${r.kept}` : ""}. Учителя получили уведомления.` +
        (r.unfilled.length ? `\nНе хватило учителей:\n${r.unfilled.join("\n")}` : ""));
      await load();
    } catch (e) { flash(false, e instanceof Error ? e.message : "Ошибка"); } finally { setBusy(false); }
  }
  async function replace(d: Duty, teacherId: number) {
    try { await http.patch(`/duty/assignments/${d.id}`, { teacher_id: teacherId }); flash(true, "Дежурный заменён, оба учителя уведомлены"); await load(); }
    catch (e) { flash(false, e instanceof Error ? e.message : "Ошибка"); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-4">
          <button className="cursor-pointer rounded p-1.5 hover:bg-slate-100" onClick={() => setWeek(addDays(week, -7))}><ChevronLeft className="size-4" /></button>
          <span className="font-medium">{formatDate(iso(week))} – {formatDate(iso(end))}</span>
          <button className="cursor-pointer rounded p-1.5 hover:bg-slate-100" onClick={() => setWeek(addDays(week, 7))}><ChevronRight className="size-4" /></button>
          <Button className="ml-auto" disabled={busy} onClick={generate}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Составить на неделю</Button>
        </CardContent>
        <p className="px-5 pb-4 text-xs text-slate-500">Дежурят те, у кого в этот день мало уроков и нет урока во время смены; учитываются «не могу» из пожеланий, дежурства распределяются поровну. Ручные замены и начатые дежурства не перезаписываются.</p>
      </Card>
      {msg && <div className={cn("whitespace-pre-line rounded-lg px-4 py-3 text-sm", msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900")}>{msg.text}</div>}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-3 py-2">Пост / смена</th>{days.map((d) => <th key={iso(d)} className="px-3 py-2">{DAY_NAMES[d.getDay() || 7]} {formatDate(iso(d)).slice(0, 5)}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {posts.flatMap((p) => p.shifts.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2 align-top"><div className="font-medium">{p.name}</div><div className="text-xs text-slate-500">{s.name} {s.start_time}–{s.end_time}{s.required > 1 ? ` · ${s.required} чел.` : ""}</div></td>
                  {days.map((d) => {
                    const cell = items.filter((x) => x.shift_id === s.id && x.date === iso(d));
                    return (
                      <td key={iso(d)} className="px-3 py-2 align-top">
                        {cell.map((x) => (
                          <div key={x.id} className="mb-1.5 space-y-1">
                            <Select className="h-8 text-xs" value={x.teacher_id} onChange={(e) => replace(x, Number(e.target.value))}>
                              {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                            </Select>
                            <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                              {x.lessons_that_day !== null && <span>уроков: {x.lessons_that_day}</span>}{x.manual && <span>· замена</span>}
                              {x.status !== "PLANNED" && <DutyStatusBadge d={x} />}
                            </div>
                          </div>
                        ))}
                        {cell.length < s.required && <div className="text-xs text-rose-600">не назначен</div>}
                      </td>
                    );
                  })}
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Posts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [draft, setDraft] = useState({ name: "", location: "", shift: "Перемена", start: "10:10", end: "10:25", required: "1" });
  const [shiftDraft, setShiftDraft] = useState<Record<number, { name: string; start: string; end: string; required: string }>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => setPosts(await http.get<Post[]>("/duty/posts")), []);
  useEffect(() => { void load(); }, [load]);
  async function act(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); setMsg(ok); await load(); } catch (e) { setMsg(e instanceof Error ? e.message : "Ошибка"); }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/duty/qr" target="_blank"><Button><Printer className="size-4" /> Печать QR-кодов для всех постов</Button></Link>
        {msg && <span className="text-sm text-slate-600">{msg}</span>}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {posts.map((p) => {
          const sd = shiftDraft[p.id] ?? { name: "", start: "", end: "", required: "1" };
          return (
            <Card key={p.id}>
              <CardHeader><div><CardTitle>{p.name}</CardTitle><div className="text-xs text-slate-500">{p.location ?? "место QR не указано"}</div></div>
                <Button size="sm" variant="ghost" title="Если код сфотографировали — сделайте новый и перепечатайте"
                  onClick={() => confirm(`Заменить QR-код поста «${p.name}»? Старый перестанет работать, новый нужно распечатать.`) && act(() => http.post(`/duty/posts/${p.id}/rotate-qr`), "QR-код заменён — распечатайте новый")}>
                  <RefreshCw className="size-3.5" /> Новый QR</Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {p.shifts.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span>{s.name} · {s.start_time}–{s.end_time}{s.required > 1 ? ` · ${s.required} чел.` : ""}</span>
                    <button className="cursor-pointer text-xs text-slate-400 hover:text-rose-600" onClick={() => act(() => http.del(`/duty/shifts/${s.id}`), "Смена удалена")}>удалить</button>
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-1.5">
                  <Input className="h-8 w-32 text-xs" placeholder="Смена" value={sd.name} onChange={(e) => setShiftDraft({ ...shiftDraft, [p.id]: { ...sd, name: e.target.value } })} />
                  <Input className="h-8 w-24 text-xs" type="time" value={sd.start} onChange={(e) => setShiftDraft({ ...shiftDraft, [p.id]: { ...sd, start: e.target.value } })} />
                  <Input className="h-8 w-24 text-xs" type="time" value={sd.end} onChange={(e) => setShiftDraft({ ...shiftDraft, [p.id]: { ...sd, end: e.target.value } })} />
                  <Input className="h-8 w-14 text-xs" type="number" min={1} value={sd.required} onChange={(e) => setShiftDraft({ ...shiftDraft, [p.id]: { ...sd, required: e.target.value } })} />
                  <Button size="sm" disabled={!sd.name || !sd.start || !sd.end} onClick={() => act(async () => {
                    await http.post(`/duty/posts/${p.id}/shifts`, { name: sd.name, start_time: sd.start, end_time: sd.end, required: Number(sd.required) });
                    setShiftDraft({ ...shiftDraft, [p.id]: { name: "", start: "", end: "", required: "1" } });
                  }, "Смена добавлена")}><Plus className="size-3.5" /> Смена</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        <Card>
          <CardHeader><CardTitle>Новый пост</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Input placeholder="Название (например, 4 этаж, Спортзал)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <Input placeholder="Где висит QR-код" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
            <div className="flex flex-wrap gap-1.5">
              <Input className="w-32" placeholder="Смена" value={draft.shift} onChange={(e) => setDraft({ ...draft, shift: e.target.value })} />
              <Input className="w-28" type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
              <Input className="w-28" type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
              <Input className="w-16" type="number" min={1} value={draft.required} onChange={(e) => setDraft({ ...draft, required: e.target.value })} />
            </div>
            <Button disabled={!draft.name} onClick={() => act(async () => {
              await http.post("/duty/posts", { name: draft.name, location: draft.location || null, shifts: [{ name: draft.shift, start_time: draft.start, end_time: draft.end, required: Number(draft.required) }] });
              setDraft({ ...draft, name: "", location: "" });
            }, "Пост добавлен — распечатайте его QR-код")}><Plus className="size-4" /> Добавить пост</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface ReportData { totals: Record<string, number>; teachers: { teacher: string; assigned: number; on_time: number; late: number; missed: number; planned: number }[]; missed: Duty[]; late: Duty[] }

function Report() {
  const [from, setFrom] = useState(() => iso(addDays(new Date(), -30)));
  const [to, setTo] = useState(() => iso(new Date()));
  const [r, setR] = useState<ReportData | null>(null);
  useEffect(() => { http.get<ReportData>("/duty/report", { date_from: from, date_to: to }).then(setR); }, [from, to]);
  if (!r) return null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2"><Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} /> — <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {([["Назначено", r.totals.assigned, ""], ["Вовремя", r.totals.on_time, "text-emerald-700"], ["С опозданием", r.totals.late, "text-amber-700"], ["Не пришли", r.totals.missed, "text-rose-700"]] as const).map(([l, v, c]) => (
          <Card key={l} className="p-4"><div className="text-xs text-slate-500">{l}</div><div className={cn("text-3xl font-bold tabular-nums", c)}>{v}</div></Card>
        ))}
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2">Учитель</th><th className="px-4 py-2 text-center">Назначено</th><th className="px-4 py-2 text-center">Вовремя</th><th className="px-4 py-2 text-center">Опоздал</th><th className="px-4 py-2 text-center">Не пришёл</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {r.teachers.map((t) => (
                <tr key={t.teacher}><td className="px-4 py-2">{t.teacher}</td><td className="px-4 py-2 text-center">{t.assigned}</td><td className="px-4 py-2 text-center text-emerald-700">{t.on_time || ""}</td>
                  <td className="px-4 py-2 text-center text-amber-700">{t.late || ""}</td><td className="px-4 py-2 text-center font-semibold text-rose-700">{t.missed || ""}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {r.missed.length > 0 && <Card><CardHeader><CardTitle>Не пришли на дежурство</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">{r.missed.map((d) => <div key={d.id}>{d.weekday}, {formatDate(d.date)} · {d.post_name}, {d.shift_name} — <b>{d.teacher_name}</b></div>)}</CardContent></Card>}
    </div>
  );
}
