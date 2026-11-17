// Кнопка «Войти через Google» (Google Identity Services). Показывается, только если на сервере задан GOOGLE_CLIENT_ID.
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

interface GsiId {
  initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }) => void;
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
}
declare global { interface Window { google?: { accounts: { id: GsiId } } } }

const SRC = "https://accounts.google.com/gsi/client";

function loadScript(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    const s = existing ?? Object.assign(document.createElement("script"), { src: SRC, async: true, defer: true });
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", () => reject(new Error("Не удалось загрузить Google")));
    if (!existing) document.head.appendChild(s);
  });
}

export function GoogleSignIn({ onCredential, disabled }: { onCredential: (credential: string) => void; disabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [domains, setDomains] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;

  useEffect(() => { api.authConfig().then((c) => { setClientId(c.google_client_id); setDomains(c.google_allowed_domains); }).catch(() => setClientId(null)); }, []);
  useEffect(() => {
    if (!clientId || !ref.current) return;
    loadScript().then(() => {
      window.google!.accounts.id.initialize({ client_id: clientId, callback: (r) => cb.current(r.credential) });
      ref.current!.innerHTML = "";
      window.google!.accounts.id.renderButton(ref.current!, {
        theme: "outline", size: "large", text: "signin_with", shape: "rectangular", locale: "ru",
        width: Math.min(ref.current!.clientWidth || 320, 400),
      });
    }).catch((e) => setError(e.message));
  }, [clientId]);

  if (!clientId) return null;
  return (
    <div className={disabled ? "pointer-events-none opacity-60" : ""}>
      <div className="my-4 flex items-center gap-3 text-xs text-slate-400"><div className="h-px flex-1 bg-slate-200" />или<div className="h-px flex-1 bg-slate-200" /></div>
      <div ref={ref} className="flex w-full justify-center" />
      {domains.length > 0 && <p className="mt-2 text-center text-xs text-slate-500">Только почта {domains.map((d) => `@${d}`).join(", ")}</p>}
      {error && <p className="mt-2 text-center text-xs text-rose-600">{error}</p>}
    </div>
  );
}
