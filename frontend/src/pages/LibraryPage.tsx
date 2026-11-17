// Библиотека: поурочные планы, планы-конспекты, книги, карточки, презентации.
// Автор загружает (черновик видит только он) → публикует для учителей или для всех (и учеников) → другие скачивают.
import { Download, FileText, Library, Loader2, Search, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/auth/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { http } from "@/lib/api";
import { cn, FAMILY_ROLES, formatDate } from "@/lib/utils";

interface Material { id: number; title: string; kind: string; kind_label: string; subject_id: number | null; subject_name: string | null; grade_level: number | null;
  description: string | null; file_name: string; size_bytes: number; visibility: "PRIVATE" | "TEACHERS" | "ALL"; downloads: number; author_name: string | null; created_at: string; can_edit: boolean }
interface Subject { id: number; name: string }

const KINDS: [string, string][] = [["LESSON_PLAN", "Поурочный план"], ["OUTLINE", "План-конспект"], ["BOOK", "Книга"], ["CARDS", "Карточки"], ["PRESENTATION", "Презентация"], ["OTHER", "Другое"]];
const VIS: Record<string, [string, string]> = { PRIVATE: ["черновик — вижу только я", "bg-slate-100 text-slate-700 ring-slate-500/20"],
  TEACHERS: ["опубликовано для учителей", "bg-sky-100 text-sky-800 ring-sky-600/20"], ALL: ["опубликовано для всех", "bg-emerald-100 text-emerald-800 ring-emerald-600/20"] };
const size = (b: number) => b > 1048576 ? `${(b / 1048576).toFixed(1)} МБ` : `${Math.max(1, Math.round(b / 1024))} КБ`;

export function LibraryPage() {
  const { user } = useAuth();
  const family = !!user && FAMILY_ROLES.includes(user.role);
  const [items, setItems] = useState<Material[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [q, setQ] = useState(""); const [kind, setKind] = useState(""); const [subjectId, setSubjectId] = useState("");
  const [mine, setMine] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => setItems(await http.get<Material[]>("/library/materials",
    { q: q || undefined, kind: kind || undefined, subject_id: subjectId || undefined, mine: mine || undefined })), [q, kind, subjectId, mine]);
  useEffect(() => { http.get<Subject[]>("/academic/subjects").then(setSubjects); }, []);
  useEffect(() => { const t = setTimeout(() => void load(), 250); return () => clearTimeout(t); }, [load]);

  async function act(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); setMsg(ok); await load(); } catch (e) { setMsg(e instanceof Error ? e.message : "Ошибка"); }
    setTimeout(() => setMsg(null), 4000);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Library className="size-6 text-indigo-600" /> Библиотека</h1>
        <div className="flex items-center gap-2">
          {msg && <span className="text-sm text-slate-600">{msg}</span>}
          {!family && <Button onClick={() => setShowUpload(true)}><Upload className="size-4" /> Загрузить материал</Button>}
        </div>
      </div>
      <Card>
        <div className="flex flex-wrap items-center gap-2 p-4">
          <div className="relative w-64"><Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-slate-400" />
            <Input className="pl-8" placeholder="Поиск по названию…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select className="w-44" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Все виды</option>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
          <Select className="w-48" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}><option value="">Все предметы</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
          {!family && <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Только мои</label>}
          <span className="ml-auto text-sm text-slate-500">{items.length} материалов</span>
        </div>
      </Card>
      {items.length === 0 && <Card><CardContent className="py-10 text-center text-slate-500">Материалов пока нет{!family && " — загрузите первый"}</CardContent></Card>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((m) => (
          <Card key={m.id} className="flex flex-col">
            <CardContent className="flex flex-1 flex-col gap-2 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-indigo-50 p-2"><FileText className="size-5 text-indigo-600" /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold leading-tight">{m.title}</div>
                  <div className="text-xs text-slate-500">{m.kind_label}{m.subject_name && ` · ${m.subject_name}`}{m.grade_level ? ` · ${m.grade_level} класс` : ""}</div>
                </div>
              </div>
              {m.description && <p className="text-sm text-slate-600">{m.description}</p>}
              <div className="mt-auto text-xs text-slate-500">{m.author_name} · {formatDate(m.created_at)} · {m.file_name} ({size(m.size_bytes)}) · скачиваний: {m.downloads}</div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => act(() => http.download(`/library/materials/${m.id}/download`, m.file_name), "Скачивание началось")}><Download className="size-3.5" /> Скачать</Button>
                {m.can_edit ? (
                  <>
                    <Select className="h-8 w-52 text-xs" value={m.visibility} onChange={(e) => act(() => http.patch(`/library/materials/${m.id}`, { visibility: e.target.value }),
                      e.target.value === "PRIVATE" ? "Снято с публикации" : "Опубликовано")}>
                      <option value="PRIVATE">Черновик (только я)</option><option value="TEACHERS">Опубликовать для учителей</option><option value="ALL">Опубликовать для всех</option>
                    </Select>
                    <button className="cursor-pointer text-slate-400 hover:text-rose-600" title="Удалить" onClick={() => confirm(`Удалить «${m.title}»?`) && act(() => http.del(`/library/materials/${m.id}`), "Удалено")}><Trash2 className="size-4" /></button>
                  </>
                ) : !family && <Badge className={VIS[m.visibility][1]}>{VIS[m.visibility][0]}</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {showUpload && <UploadDialog subjects={subjects} onClose={() => setShowUpload(false)} onDone={() => { setShowUpload(false); void load(); setMsg("Материал загружен"); }} />}
    </div>
  );
}

function UploadDialog({ subjects, onClose, onDone }: { subjects: Subject[]; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ title: "", kind: "PRESENTATION", subject_id: "", grade_level: "", description: "", visibility: "PRIVATE" });
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
    setBusy(true); setError(null);
    try { await http.upload("/library/materials", fd); onDone(); } catch (err) { setError(err instanceof Error ? err.message : "Ошибка"); } finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-slate-900/40 p-4 pt-16" onClick={onClose}>
      <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <CardHeader><CardTitle>Загрузить материал</CardTitle><button className="cursor-pointer text-slate-400" onClick={onClose}><X className="size-4" /></button></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-slate-300 p-4 hover:border-indigo-400">
              <Upload className="size-6 text-indigo-600" />
              <span className="text-sm">{file ? file.name : "Файл: pdf, pptx, docx, xlsx, изображения, zip… до 50 МБ"}</span>
              <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !form.title) setForm({ ...form, title: f.name.replace(/\.[^.]+$/, "") }); }} />
            </label>
            <Input required placeholder="Название" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
              <Select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}><option value="">Предмет…</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
              <Input type="number" min={0} max={12} placeholder="Класс" value={form.grade_level} onChange={(e) => setForm({ ...form, grade_level: e.target.value })} />
            </div>
            <Input placeholder="Описание (к какому уроку, тема)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
              <option value="PRIVATE">Пока черновик — вижу только я</option><option value="TEACHERS">Сразу опубликовать для учителей</option><option value="ALL">Сразу опубликовать для всех (и учеников)</option>
            </Select>
            {error && <p className={cn("rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700")}>{error}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Отмена</Button>
              <Button type="submit" disabled={busy || !file}>{busy && <Loader2 className="size-4 animate-spin" />} Загрузить</Button></div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
