// «Приём учеников»: менеджер/завуч по работе с родителями заводит ученика, кассир оформляет оплату,
// классный руководитель принимает в класс и отмечает пансионат, администратор СКУД настраивает доступ.
// Директор видит каждую заявку и каждый этап (кто и когда сделал).
import { Check, CircleDashed, ClipboardList, Loader2, Plus, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { useLiveEvents } from "@/hooks/useLiveEvents";
import { api } from "@/lib/api";
import type { Enrollment, EnrollmentStep, SchoolClass } from "@/lib/types";
import { cn, formatDate, minutesAgo, REGISTRAR_ROLES, ROLE_LABEL } from "@/lib/utils";

type Tab = "mine" | "active" | "completed";

export function EnrollmentPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("active");
  const [items, setItems] = useState<Enrollment[]>([]);
  const [mineCount, setMineCount] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const canRegister = !!user && REGISTRAR_ROLES.includes(user.role);

  const load = useCallback(async () => {
    const [list, mine] = await Promise.all([
      tab === "mine" ? api.enrollments({ mine: true }) : api.enrollments({ state: tab }),
      api.enrollments({ mine: true }),
    ]);
    setItems(list);
    setMineCount(mine.length);
  }, [tab]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (mineCount > 0 && tab === "active" && user && !REGISTRAR_ROLES.includes(user.role)) setTab("mine"); },
    // при первом открытии сотрудник с задачами сразу видит «Мои задачи»
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mineCount > 0]);
  useLiveEvents(useCallback((e) => { if (e.type === "enrollment.changed") void load(); }, [load]));

  const flash = (ok: boolean, text: string) => { setToast({ ok, text }); setTimeout(() => setToast(null), 3500); };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><ClipboardList className="size-6 text-indigo-600" /> Приём учеников</h1>
          <p className="text-sm text-slate-500">Анкета → оплата (кассир) → класс и пансионат (классный руководитель) → доступ (HikCentral) → «Учится»</p>
        </div>
        <div className="flex items-center gap-2">
          {toast && <span className={cn("rounded-md px-3 py-1.5 text-sm font-medium text-white shadow", toast.ok ? "bg-emerald-600" : "bg-rose-600")}>{toast.text}</span>}
          {canRegister && <Button onClick={() => setShowForm(true)}><UserPlus className="size-4" /> Новый ученик</Button>}
        </div>
      </div>

      <div className="flex gap-1">
        {([["mine", `Мои задачи${mineCount ? ` · ${mineCount}` : ""}`], ["active", "В процессе"], ["completed", "Зачислены"]] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn("cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium",
              tab === id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
              id === "mine" && mineCount > 0 && tab !== id && "text-rose-700")}>
            {label}
          </button>
        ))}
      </div>

      {items.length === 0 && (
        <Card><CardContent className="py-10 text-center text-slate-500">
          {tab === "mine" ? "Задач по приёму нет" : tab === "active" ? "Нет заявок в процессе" : "Пока никто не зачислен"}
        </CardContent></Card>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((e) => <EnrollmentCard key={e.id} e={e} onChanged={load} flash={flash} />)}
      </div>

      {showForm && <RegistrationForm onClose={() => setShowForm(false)} onCreated={(name) => { setShowForm(false); flash(true, `${name}: заявка создана, сотрудники уведомлены`); void load(); }} />}
    </div>
  );
}

function EnrollmentCard({ e, onChanged, flash }: { e: Enrollment; onChanged: () => void; flash: (ok: boolean, t: string) => void }) {
  const pct = Math.round((e.done_steps / e.total_steps) * 100);
  return (
    <Card className={cn(e.my_pending && "border-indigo-300 ring-1 ring-indigo-200")}>
      <CardHeader>
        <div>
          <Link to={`/students/${e.student.id}`} className="font-semibold hover:text-indigo-700 hover:underline">{e.student.full_name}</Link>
          <span className="ml-2 text-sm text-slate-500">{e.student.class_name}</span>
          <div className="text-xs text-slate-500">
            Завёл(а): {e.created_by_name ?? "—"} · {minutesAgo(e.created_at)}
            {e.student.birth_date && <> · д.р. {formatDate(e.student.birth_date)}</>}
          </div>
        </div>
        {e.status === "COMPLETED"
          ? <Badge className="bg-emerald-100 text-emerald-800 ring-emerald-600/20">Зачислен</Badge>
          : <span className="text-xs font-semibold tabular-nums text-slate-600">{e.done_steps}/{e.total_steps}</span>}
      </CardHeader>
      <div className="h-1 bg-slate-100"><div className="h-1 bg-emerald-500 transition-all" style={{ width: `${pct}%` }} /></div>
      <CardContent className="space-y-2.5 p-4">
        {e.steps.map((s) => <StepRow key={s.kind} e={e} s={s} onChanged={onChanged} flash={flash} />)}
      </CardContent>
    </Card>
  );
}

function StepRow({ e, s, onChanged, flash }: { e: Enrollment; s: EnrollmentStep; onChanged: () => void; flash: (ok: boolean, t: string) => void }) {
  const [open, setOpen] = useState(false);
  const done = s.status === "DONE";
  return (
    <div className={cn("rounded-lg border p-2.5", done ? "border-emerald-200 bg-emerald-50/40" : s.can_complete ? "border-indigo-200 bg-indigo-50/40" : "border-slate-200")}>
      <div className="flex items-start gap-2">
        {done ? <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <CircleDashed className="mt-0.5 size-4 shrink-0 text-slate-400" />}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{s.label}</div>
          <div className="text-xs text-slate-500">
            {done
              ? <>Выполнил(а): {s.completed_by_name ?? "автоматически"} · {minutesAgo(s.completed_at)}{stepSummary(s)}</>
              : <>Ждёт: {s.assignee_name ?? ROLE_LABEL[s.assignee_role]}</>}
          </div>
        </div>
        {s.can_complete && !open && <Button size="sm" onClick={() => setOpen(true)}>Выполнить</Button>}
      </div>
      {open && <StepForm e={e} s={s} onCancel={() => setOpen(false)}
        onDone={(t) => { setOpen(false); flash(true, t); onChanged(); }} onError={(t) => flash(false, t)} />}
    </div>
  );
}

function stepSummary(s: EnrollmentStep): string {
  const d = s.data ?? {};
  if (s.kind === "PAYMENT_SETUP" && d.external_1c_id) return ` · л/с ${d.external_1c_id}${d.contract_number ? `, договор ${d.contract_number}` : ""}`;
  if (s.kind === "CLASS_ACCEPTANCE" && typeof d.is_boarder === "boolean")
    return d.is_boarder ? ` · пансионат${d.boarding_room ? `, комната ${d.boarding_room}` : ""}` : " · не в пансионате";
  return "";
}

function StepForm({ e, s, onCancel, onDone, onError }: {
  e: Enrollment; s: EnrollmentStep; onCancel: () => void; onDone: (t: string) => void; onError: (t: string) => void;
}) {
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState("");
  const [boarder, setBoarder] = useState<boolean | null>(null);
  const [room, setRoom] = useState("");
  const [personId, setPersonId] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const data: Record<string, unknown> =
      s.kind === "PAYMENT_SETUP" ? { external_1c_id: account, contract_number: contract || undefined }
        : s.kind === "CLASS_ACCEPTANCE" ? { is_boarder: boarder, boarding_room: room || undefined }
          : { hik_person_id: personId || undefined };
    setBusy(true);
    try {
      await api.completeStep(e.id, s.kind, data, comment || undefined);
      onDone(`${e.student.full_name}: «${s.label}» — готово`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-2.5 space-y-2 border-t border-slate-200 pt-2.5">
      {s.kind === "PAYMENT_SETUP" && (
        <div className="grid grid-cols-2 gap-2">
          <Input required placeholder="Лицевой счёт 1С, напр. LS-0030" value={account} onChange={(x) => setAccount(x.target.value)} />
          <Input placeholder="№ договора" value={contract} onChange={(x) => setContract(x.target.value)} />
        </div>
      )}
      {s.kind === "CLASS_ACCEPTANCE" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">Пансионат:</span>
          {[true, false].map((v) => (
            <button type="button" key={String(v)} onClick={() => setBoarder(v)}
              className={cn("cursor-pointer rounded-full border px-3 py-1 text-xs", boarder === v ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300 bg-white")}>
              {v ? "Живёт в пансионате" : "Не в пансионате"}
            </button>
          ))}
          {boarder && <Input className="h-8 w-32" placeholder="Комната" value={room} onChange={(x) => setRoom(x.target.value)} />}
        </div>
      )}
      {s.kind === "ACCESS_SETUP" && (
        <div className="space-y-1">
          <p className="text-xs text-slate-600">Добавьте ученика и его лицо/ладонь в HikCentral (personCode = лицевой счёт 1С). Этап закроется сам после синхронизации, либо подтвердите вручную.</p>
          <Input placeholder="personId в HikCentral (необязательно)" value={personId} onChange={(x) => setPersonId(x.target.value)} />
        </div>
      )}
      <Input placeholder="Комментарий (необязательно)" value={comment} onChange={(x) => setComment(x.target.value)} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Отмена</Button>
        <Button type="submit" size="sm" variant="success" disabled={busy || (s.kind === "CLASS_ACCEPTANCE" && boarder === null)}>
          {busy && <Loader2 className="size-3.5 animate-spin" />} Готово
        </Button>
      </div>
    </form>
  );
}

function RegistrationForm({ onClose, onCreated }: { onClose: () => void; onCreated: (name: string) => void }) {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [form, setForm] = useState({ full_name: "", class_id: "", birth_date: "", notes: "" });
  const [guardians, setGuardians] = useState([{ full_name: "", relation: "мать", phone: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.classes().then(setClasses); }, []);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.createEnrollment({
        full_name: form.full_name, class_id: Number(form.class_id), birth_date: form.birth_date || null, notes: form.notes || null,
        guardians: guardians.filter((g) => g.full_name.trim()).map((g, i) => ({ ...g, is_primary: i === 0 })),
      });
      onCreated(form.full_name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-16" onClick={onClose}>
      <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <CardHeader><CardTitle>Новый ученик</CardTitle>
          <button onClick={onClose} className="cursor-pointer text-slate-400 hover:text-slate-700"><X className="size-4" /></button>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <Input required placeholder="ФИО ученика" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Select required value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
                <option value="">Класс…</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Input type="date" title="Дата рождения" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
            </div>
            <div className="space-y-2 rounded-lg border border-slate-200 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Родители / представители</div>
              {guardians.map((g, i) => (
                <div key={i} className="grid grid-cols-[1fr_96px_1fr] gap-2">
                  <Input required={i === 0} placeholder="ФИО" value={g.full_name}
                    onChange={(e) => setGuardians(guardians.map((x, j) => j === i ? { ...x, full_name: e.target.value } : x))} />
                  <Select value={g.relation} onChange={(e) => setGuardians(guardians.map((x, j) => j === i ? { ...x, relation: e.target.value } : x))}>
                    <option>мать</option><option>отец</option><option>опекун</option><option>другое</option>
                  </Select>
                  <Input required={i === 0} placeholder="+998…" value={g.phone}
                    onChange={(e) => setGuardians(guardians.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))} />
                </div>
              ))}
              <button type="button" className="flex cursor-pointer items-center gap-1 text-xs text-indigo-600"
                onClick={() => setGuardians([...guardians, { full_name: "", relation: "отец", phone: "" }])}>
                <Plus className="size-3" /> ещё представитель
              </button>
            </div>
            <Input placeholder="Примечание (откуда перешёл и т.п.)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            <p className="text-xs text-slate-500">После сохранения уведомления получат: директор, кассир, классный руководитель и администратор СКУД.</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Отмена</Button>
              <Button type="submit" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />} Завести ученика</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
