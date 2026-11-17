// Печать QR-кодов постов (по листу A4 на пост): повесить на этаже / у столовой.
import QRCode from "qrcode";
import { Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { http } from "@/lib/api";
import type { Post } from "@/pages/DutyPage";

export function DutyQrPrintPage() {
  const [posts, setPosts] = useState<(Post & { url: string; svg: string })[]>([]);
  useEffect(() => {
    http.get<Post[]>("/duty/posts").then(async (ps) => setPosts(await Promise.all(ps.filter((p) => p.qr_token && p.is_active).map(async (p) => {
      const url = `${window.location.origin}/duty/checkin/${p.qr_token}`;
      return { ...p, url, svg: await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) };
    }))));
  }, []);
  return (
    <div className="bg-white">
      {["localhost", "127.0.0.1"].includes(window.location.hostname) && (
        <div className="m-4 rounded-lg bg-rose-50 p-4 text-sm text-rose-800 print:hidden">
          <b>Внимание:</b> страница открыта по адресу <b>{window.location.host}</b> — такой QR-код не откроется на телефоне.
          Откройте SchoolOS по адресу этого компьютера в школьной сети (его показывает окно «SchoolOS 3 - site» в строке
          <b> Network</b>, например http://192.168.1.10:5173) или по адресу сайта школы, и распечатайте QR оттуда.
        </div>
      )}
      <div className="flex items-center gap-3 p-4 print:hidden">
        <Button onClick={() => window.print()}><Printer className="size-4" /> Печать</Button>
        <span className="text-sm text-slate-500">По одному листу на пост. Адрес в QR: {window.location.origin} — телефоны учителей должны открывать этот адрес (школьная сеть или сайт школы).</span>
      </div>
      {posts.map((p) => (
        <section key={p.id} className="mx-auto flex min-h-[90vh] max-w-xl flex-col items-center justify-center gap-6 p-8 text-center [break-after:page]">
          <div className="text-sm uppercase tracking-widest text-slate-500">Дежурство · SchoolOS</div>
          <h1 className="text-5xl font-bold">{p.name}</h1>
          {p.location && <div className="text-xl text-slate-600">{p.location}</div>}
          <div className="w-80 max-w-full" dangerouslySetInnerHTML={{ __html: p.svg }} />
          <div className="text-lg">Дежурный: отсканируйте камерой телефона,<br />когда приступили к дежурству</div>
          <div className="text-sm text-slate-500">{p.shifts.map((s) => `${s.name} ${s.start_time}–${s.end_time}`).join(" · ")}</div>
        </section>
      ))}
    </div>
  );
}
