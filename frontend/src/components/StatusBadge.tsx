import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LocationStatus } from "@/lib/types";
import { STATUS_META } from "@/lib/utils";

export function StatusBadge({ status, discrepancy }: { status: LocationStatus; discrepancy?: boolean }) {
  if (discrepancy) {
    return (
      <Badge className="bg-rose-600 text-white ring-rose-700">
        <AlertTriangle className="size-3" /> DISCREPANCY
      </Badge>
    );
  }
  const meta = STATUS_META[status];
  return <Badge className={meta.className}>{meta.label}</Badge>;
}
