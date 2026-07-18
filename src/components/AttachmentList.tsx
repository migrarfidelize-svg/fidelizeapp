import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAttachmentUrl } from "@/lib/helpdesk.functions";
import { Paperclip, Loader2 } from "lucide-react";

export type AttachmentRef = { path: string; name: string; mime?: string; size?: number };

export function AttachmentList({ items }: { items: AttachmentRef[] }) {
  const sign = useServerFn(getAttachmentUrl);
  const [busy, setBusy] = useState<string | null>(null);
  if (!items?.length) return null;
  async function open(path: string) {
    setBusy(path);
    try {
      const { url } = await sign({ data: { path } });
      window.open(url, "_blank", "noopener");
    } finally { setBusy(null); }
  }
  return (
    <ul className="mt-2 space-y-1">
      {items.map((a) => (
        <li key={a.path}>
          <button
            type="button"
            onClick={() => open(a.path)}
            className="inline-flex items-center gap-2 text-xs text-primary hover:underline"
          >
            {busy === a.path ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
            {a.name}{a.size ? <span className="text-muted-foreground">({Math.round(a.size / 1024)} KB)</span> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
