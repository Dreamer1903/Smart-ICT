// Сотрудники: загрузка из Excel (роли по отделам, логины и временные пароли), назначение ролей,
// почта для входа через Google, сброс пароля, отключение.
import { Download, FileSpreadsheet, KeyRound, Loader2, Search, ShieldAlert, UserCog, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { http } from "@/lib/api";
import type { UserRole } from "@/lib/types";
import { cn, ROLE_LABEL } from "@/lib/utils";

interface StaffUser { id: number; email: string; full_name: string; role: UserRole; is_active: boolean; phone: string | null;
  telegram_chat_id: string | null; department: string | null; hik_person_id: string | null; google_linked: boolean }
interface Account { full_name: string; email: string; role: UserRole; department: string; password: string }
interface Report { rows: number; departments: Record<string, { count: number; role: string }>; created: number; updated: number;
  unchanged: number; skipped: number; warnings: string[]; accounts: Account[]; dry_run: boolean; roles: UserRole[] }

const ROLE_ORDER: UserRole[] = ["Director", "ZavuchAcademic", "ZavuchUpbringing", "Zavuch", "ParentRelations", "Teacher", "Nurse",
  "DutyTeacher", "Admissions", "Cashier", "Staff", "SuperAdmin"];

function downloadCsv(accounts: Account[]) {
  const lines = [["ФИО", "Отдел", "Роль", "Логин (email)", "Временный пароль"].join(";"),
    ...accounts.map((a) => [a.full_name, a.department, ROLE_LABEL[a.role], a.email, a.password].join(";"))];
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const el = document.createElement("a");
  el.href = URL.createObjectURL(blob);
  el.download = "schoolos-staff-logins.csv";
  document.body.appendChild(el);
  el.click();
  el.remove();
}

export function StaffPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<StaffUser[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState(""); const [role, setRole] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);
  const load = useCallback(async () => {
    setRows(await http.get<StaffUser[]>("/staff", { q: q || undefined, role: role || undefined }));
    setLoaded(true);
  }, [q, role]);
  useEffect(() => { const t = setTimeout(() => void load(), 250); return () => clearTimeout(t); }, [load]);
  const pending = useMemo(() => rows.filter((r) => r.role === "Staff" && r.is_active).length, [rows]);
  const roles = ROLE_ORDER.filter((r) => r !== "SuperAdmin" || user?.role === "SuperAdmin");

  async function patch(u: StaffUser, body: Partial<StaffUser>, ok: string) {
    try { await http.patch(`/staff/${u.id}`, body); setMsg({ ok: true, text: ok }); await load(); }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Ошибка" }); await load(); }
    setTimeout(() => setMsg(null), 4000);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><UserCog className="size-6 text-indigo-600" /> Сотрудники</h1>
        <Button variant="outline" onClick={() => setShowImport(true)}><FileSpreadsheet className="size-4" /> Загрузить из Excel</Button>
      </div>
      {pending > 0 && (
        <Card className="border-amber-300 bg-amber-50/60"><CardContent className="flex items-center gap-2 py-3 text-sm text-amber-900">
          <ShieldAlert className="size-4" /> У {pending} сотрудников роль не назначена — они не видят разделов. Выберите роль в таблице.
          <button className="cursor-pointer underline" onClick={() => setRole("Staff")}>Показать их</button></CardContent></Card>
      )}
      {msg && <div className={cn("rounded-lg px-4 py-2 text-sm", msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800")}>{msg.text}</div>}
      {secret && (
        <Card className="border-indigo-300"><CardContent className="flex flex-wrap items-center gap-3 py-3 text-sm">
          <KeyRound className="size-4 text-indigo-600" /> Новый временный пароль для <b>{secret.email}</b>:
          <code className="rounded bg-slate-100 px-2 py-1 text-base">{secret.password}</code>
          <span className="text-xs text-slate-500">Передайте сотруднику лично. Больше пароль не покажется.</span>
          <button className="ml-auto cursor-pointer text-slate-400" onClick={() => setSecret(null)}><X className="size-4" /></button>
        </CardContent></Card>
      )}
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
          <div className="relative w-full sm:w-72"><Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-slate-400" />
            <Input className="pl-8" placeholder="ФИО, почта, отдел…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select className="w-full sm:w-60" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Все роли</option>{ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </Select>
          <span className="ml-auto text-sm text-slate-500">{loaded ? `${rows.length} сотрудников` : "загрузка…"}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2">Сотрудник</th><th className="px-4 py-2">Роль</th><th className="px-4 py-2">Почта (логин)</th><th className="px-4 py-2">Телефон</th><th className="px-4 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((u) => (
                <tr key={u.id} className={cn(!u.is_active && "opacity-50", u.role === "Staff" && "bg-amber-50/40")}>
                  <td className="px-4 py-2"><div className="font-medium">{u.full_name}</div><div className="text-xs text-slate-500">{u.department ?? ""}{u.google_linked && " · Google подключён"}</div></td>
                  <td className="px-4 py-2">
                    <Select className="h-8 w-56 text-xs" value={u.role} disabled={u.id === user?.id || (u.role === "SuperAdmin" && user?.role !== "SuperAdmin")}
                      onChange={(e) => patch(u, { role: e.target.value as UserRole }, `${u.full_name}: ${ROLE_LABEL[e.target.value as UserRole]}`)}>
                      {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </Select>
                  </td>
                  <td className="px-4 py-2"><Input className="h-8 w-64 text-xs" defaultValue={u.email} title="Укажите личный Gmail — сотрудник сможет входить через Google"
                    onBlur={(e) => e.target.value.trim() !== u.email && patch(u, { email: e.target.value.trim() }, "Почта изменена")} /></td>
                  <td className="px-4 py-2"><Input className="h-8 w-36 text-xs" defaultValue={u.phone ?? ""} placeholder="+998…"
                    onBlur={(e) => (e.target.value || null) !== u.phone && patch(u, { phone: e.target.value || null }, "Телефон сохранён")} /></td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    <Button size="sm" variant="ghost" title="Сбросить пароль" onClick={async () => {
                      try { const r = await http.post<{ email: string; temporary_password: string }>(`/staff/${u.id}/reset-password`); setSecret({ email: r.email, password: r.temporary_password }); }
                      catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Ошибка" }); }
                    }}><KeyRound className="size-3.5" /></Button>
                    {u.id !== user?.id && <Button size="sm" variant="ghost" onClick={() => patch(u, { is_active: !u.is_active }, u.is_active ? "Учётная запись отключена" : "Учётная запись включена")}>
                      {u.is_active ? "Отключить" : "Включить"}</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {showImport && <ImportStaff onClose={() => setShowImport(false)} onDone={load} />}
    </div>
  );
}

function ImportStaff({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [domain, setDomain] = useState("oxford.uz");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Report | null>(null);
  const [result, setResult] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);

  async function run(dryRun: boolean) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file); fd.append("domain", domain);
    if (Object.keys(mapping).length) fd.append("mapping", JSON.stringify(mapping));
    setBusy(true); setError(null);
    try {
      const r = await http.upload<Report>(`/staff/import?dry_run=${dryRun}`, fd);
      if (dryRun) { setPreview(r); setMapping(Object.fromEntries(Object.entries(r.departments).map(([d, v]) => [d, v.role]))); }
      else { setResult(r); onDone(); }
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка"); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-12" onClick={onClose}>
      <Card className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <CardHeader><CardTitle>Загрузить сотрудников из Excel</CardTitle><button className="cursor-pointer text-slate-400" onClick={onClose}><X className="size-4" /></button></CardHeader>
        <CardContent className="space-y-4">
          {!result && (<>
            <p className="text-sm text-slate-600">Лист «Сотрудники» (выгрузка HikCentral): <b>ID</b>, <b>ФИО (рус.)</b>, <b>ФИО (лат.)</b>, <b>Отдел</b>.
              Логин — фамилия.имя латиницей @домен, пароль — временный. Повторная загрузка не создаёт дублей и не меняет назначенные роли.</p>
            <div className="grid gap-2 sm:grid-cols-[1fr_200px]">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-slate-300 p-3 hover:border-indigo-400">
                <FileSpreadsheet className="size-6 text-emerald-600" /><span className="text-sm">{file ? file.name : "Выберите файл .xlsx"}</span>
                <input type="file" accept=".xlsx" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); }} />
              </label>
              <label className="text-sm">Домен почты<Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="oxford.uz" /></label>
            </div>
          </>)}
          {preview && !result && (
            <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
              <div className="font-semibold">Роли по отделам</div>
              {Object.entries(preview.departments).map(([dept, v]) => (
                <div key={dept} className="flex items-center justify-between gap-2">
                  <span>{dept} <span className="text-slate-500">({v.count})</span></span>
                  <Select className="h-8 w-60 text-xs" value={mapping[dept] ?? v.role} onChange={(e) => setMapping({ ...mapping, [dept]: e.target.value })}>
                    <option value="SKIP">Не создавать учётные записи</option>
                    {preview.roles.filter((r) => r !== "SuperAdmin").map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </Select>
                </div>
              ))}
              <div className="pt-1 text-slate-600">Будет создано: <b>{preview.created}</b> · обновится: {preview.updated} · без изменений: {preview.unchanged} · пропущено: {preview.skipped}</div>
              {preview.warnings.length > 0 && <div className="text-xs text-amber-800">{preview.warnings.slice(0, 6).map((w) => <div key={w}>{w}</div>)}</div>}
              <p className="text-xs text-slate-500">После смены ролей нажмите «Проверить» ещё раз, чтобы пересчитать.</p>
            </div>
          )}
          {result && (
            <div className="space-y-3">
              <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Создано учётных записей: <b>{result.created}</b>, обновлено: {result.updated}, пропущено: {result.skipped}.</div>
              {result.accounts.length > 0 && (<>
                <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><b>Сохраните список сейчас</b> — временные пароли показываются один раз. Раздайте их лично; файл не пересылайте в общие чаты.</div>
                <Button onClick={() => downloadCsv(result.accounts)}><Download className="size-4" /> Скачать список входов (Excel, CSV)</Button>
                <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs"><tbody className="divide-y divide-slate-100">
                    {result.accounts.map((a) => <tr key={a.email}><td className="px-3 py-1.5">{a.full_name}</td><td className="px-3 py-1.5 text-slate-500">{ROLE_LABEL[a.role]}</td>
                      <td className="px-3 py-1.5 font-mono">{a.email}</td><td className="px-3 py-1.5 font-mono">{a.password}</td></tr>)}
                  </tbody></table>
                </div>
              </>)}
            </div>
          )}
          {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <div className="flex justify-end gap-2">
            {result ? <Button onClick={onClose}>Готово</Button> : (<>
              <Button variant="outline" disabled={!file || busy} onClick={() => run(true)}>{busy && !preview ? <Loader2 className="size-4 animate-spin" /> : null} Проверить</Button>
              {preview && <Button variant="success" disabled={busy || preview.created + preview.updated === 0} onClick={() => run(false)}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null} Загрузить ({preview.created} новых)</Button>}
            </>)}
          </div>
          {busy && preview && <p className="text-right text-xs text-slate-500">Создаю учётные записи… это может занять до минуты</p>}
        </CardContent>
      </Card>
    </div>
  );
}

export function RoleBadge({ role }: { role: UserRole }) {
  return <Badge className="bg-slate-100 text-slate-700 ring-slate-500/20">{ROLE_LABEL[role]}</Badge>;
}
