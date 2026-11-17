// Колокольчик: уведомления сотруднику (новый ученик, задача по приёму, зачисление). Live через SSE.
import { Bell, CheckCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { useLiveEvents } from "@/hooks/useLiveEvents";
import { api } from "@/lib/api";
import type { StaffNotification } from "@/lib/types";
import { cn, minutesAgo } from "@/lib/utils";

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<StaffNotification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const n = await api.notifications();
    setUnread(n.unread);
    setItems(n.items);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useLiveEvents(useCallback((e) => {
    if (e.type === "staff.notification" && e.payload.user_id === user?.id) void load();
  }, [load, user?.id]));

  useEffect(() => {
    const close = (ev: MouseEvent) => { if (ref.current && !ref.current.contains(ev.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function openItem(n: StaffNotification) {
    if (!n.read) await api.readNotification(n.id);
    setOpen(false);
    void load();
    if (n.link) navigate(n.link);
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="relative cursor-pointer rounded-md p-2 hover:bg-slate-100" title="Уведомления">
        <Bell className="size-5 text-slate-600" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-14 z-30 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="text-sm font-semibold">Уведомления</span>
            {unread > 0 && (
              <button className="flex cursor-pointer items-center gap-1 text-xs text-indigo-600"
                onClick={async () => { await api.readAllNotifications(); void load(); }}>
                <CheckCheck className="size-3.5" /> прочитать все
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && <p className="p-4 text-center text-sm text-slate-500">Уведомлений нет</p>}
            {items.map((n) => (
              <button key={n.id} onClick={() => openItem(n)}
                className={cn("block w-full cursor-pointer border-b border-slate-50 px-4 py-2.5 text-left hover:bg-slate-50", !n.read && "bg-indigo-50/60")}>
                <div className="flex items-start justify-between gap-2">
                  <span className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</span>
                  <span className="shrink-0 text-[11px] text-slate-400">{minutesAgo(n.created_at)}</span>
                </div>
                {n.body && <div className="mt-0.5 text-xs text-slate-600">{n.body}</div>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
