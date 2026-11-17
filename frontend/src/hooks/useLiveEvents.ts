// Подписка на SSE-поток доменных событий backend (/dashboard/stream).
// EventSource сам переподключается; мы лишь отражаем состояние соединения.
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { DomainEvent } from "@/lib/types";

const EVENT_TYPES = ["presence.changed", "presence.discrepancy", "presence.reset", "gate.pass", "nurse.visit", "access.decision", "payment.changed", "staff.notification", "enrollment.changed"];

export function useLiveEvents(onEvent: (e: DomainEvent) => void, enabled = true) {
  const [connected, setConnected] = useState(false);
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!enabled) return;
    const es = new EventSource(api.streamUrl());
    const listener = (msg: MessageEvent) => {
      try {
        handler.current(JSON.parse(msg.data) as DomainEvent);
      } catch { /* игнорируем битые сообщения */ }
    };
    es.addEventListener("hello", () => setConnected(true));
    es.onerror = () => setConnected(false);
    EVENT_TYPES.forEach((t) => es.addEventListener(t, listener));
    return () => es.close();
  }, [enabled]);

  return connected;
}
