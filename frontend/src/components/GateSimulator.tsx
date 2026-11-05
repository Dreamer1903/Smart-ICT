// GateKeeper Sim: ручная отправка прохода через турникет (POST /gate/pass) для демо.
import { DoorClosed, DoorOpen, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { GateDirection, StudentLiveRow } from "@/lib/types";
import { STATUS_META } from "@/lib/utils";

export function GateSimulator({ students }: { students: StudentLiveRow[] }) {
  const [studentId, setStudentId] = useState<number | "">("");
  const [busy, setBusy] = useState<GateDirection | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function send(direction: GateDirection) {
    if (!studentId) return;
    setBusy(direction);
    try {
      const r = await api.gatePass(studentId, direction);
      setResult(`${direction}: статус → ${STATUS_META[r.status].label}${r.applied ? "" : " (событие устарело)"}`);
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Симулятор турникета</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Select value={studentId} onChange={(e) => setStudentId(e.target.value ? Number(e.target.value) : "")}>
          <option value="">Выберите ученика…</option>
          {[...students].sort((a, b) => a.full_name.localeCompare(b.full_name, "ru")).map((s) => (
            <option key={s.student_id} value={s.student_id}>{s.full_name} ({s.class_name})</option>
          ))}
        </Select>
        <div className="flex gap-2">
          <Button variant="success" className="flex-1" disabled={!studentId || busy !== null} onClick={() => send("IN")}>
            {busy === "IN" ? <Loader2 className="size-4 animate-spin" /> : <DoorOpen className="size-4" />} Вход
          </Button>
          <Button variant="outline" className="flex-1" disabled={!studentId || busy !== null} onClick={() => send("OUT")}>
            {busy === "OUT" ? <Loader2 className="size-4 animate-spin" /> : <DoorClosed className="size-4" />} Выход
          </Button>
        </div>
        {result && <p className="text-xs text-slate-600">{result}</p>}
      </CardContent>
    </Card>
  );
}
