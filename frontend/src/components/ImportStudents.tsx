// Загрузка учеников из Excel: выбрать файл → предпросмотр (ничего не меняется) → «Загрузить».
import { FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { ImportReport } from "@/lib/types";

export function ImportStudents({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportReport | null>(null);
  const [result, setResult] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(dryRun: boolean) {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const r = await api.importStudents(file, dryRun);
      if (dryRun) setPreview(r); else { setResult(r); onDone(); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  const r = result ?? preview;
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-slate-900/40 p-4 pt-20" onClick={onClose}>
      <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <CardHeader><CardTitle>Загрузить учеников из Excel</CardTitle>
          <button onClick={onClose} className="cursor-pointer text-slate-400 hover:text-slate-700"><X className="size-4" /></button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Файл с листом «Ученики» и столбцами <b>ID</b>, <b>ФИО (рус.)</b>, <b>ФИО (лат.)</b>, <b>Класс</b> (выгрузка из HikCentral).
            Ученик определяется по ID: повторная загрузка обновит ФИО и класс, дублей не будет. Никто не удаляется.
          </p>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-slate-300 p-4 hover:border-indigo-400">
            <FileSpreadsheet className="size-8 text-emerald-600" />
            <span className="text-sm">{file ? file.name : "Выберите файл .xlsx"}</span>
            <input type="file" accept=".xlsx" className="hidden"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setResult(null); }} />
          </label>

          {r && (
            <div className={result ? "rounded-lg bg-emerald-50 p-3 text-sm" : "rounded-lg bg-slate-50 p-3 text-sm"}>
              <div className="mb-1 font-semibold">{result ? "Загружено" : "Что будет сделано (предпросмотр)"}:</div>
              <ul className="space-y-0.5">
                <li>Учеников в файле: <b>{r.rows}</b></li>
                <li>Новых: <b>{r.created}</b>, обновится: <b>{r.updated}</b>{r.moved > 0 && ` (сменят класс: ${r.moved})`}, без изменений: {r.unchanged}</li>
                {r.classes_created.length > 0 && <li>Новые классы ({r.classes_created.length}): {r.classes_created.join(", ")}</li>}
                {r.not_in_file > 0 && <li>Есть в базе, но нет в файле: {r.not_in_file} (не удаляются)</li>}
              </ul>
              {r.warnings.length > 0 && (
                <div className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800">
                  <div className="font-semibold">Проверьте ({r.warnings.length}):</div>
                  {r.warnings.slice(0, 8).map((w) => <div key={w}>{w}</div>)}
                </div>
              )}
            </div>
          )}
          {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

          <div className="flex justify-end gap-2">
            {result ? <Button onClick={onClose}>Готово</Button> : !preview ? (
              <Button disabled={!file || busy} onClick={() => run(true)}>
                {busy && <Loader2 className="size-4 animate-spin" />} Проверить файл
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setPreview(null)}>Назад</Button>
                <Button variant="success" disabled={busy || preview.rows === 0} onClick={() => run(false)}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Загрузить {preview.rows} учеников
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
