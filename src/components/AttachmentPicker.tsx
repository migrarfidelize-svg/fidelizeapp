import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export type Attachment = { path: string; name: string; mime: string; size: number };

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

type Props = {
  value: Attachment[];
  onChange: (list: Attachment[]) => void;
  upload: (args: { name: string; mime: string; base64: string }) => Promise<Attachment>;
  max?: number;
  disabled?: boolean;
};

export function AttachmentPicker({ value, onChange, upload, max = 5, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = max - value.length;
    if (remaining <= 0) { toast.error(`Máximo ${max} anexos`); return; }
    const picked = Array.from(files).slice(0, remaining);
    setBusy(true);
    try {
      const added: Attachment[] = [];
      for (const f of picked) {
        if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name} excede 10MB`); continue; }
        const base64 = await fileToBase64(f);
        const meta = await upload({ name: f.name, mime: f.type || "application/octet-stream", base64 });
        added.push(meta);
      }
      onChange([...value, ...added]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={disabled || busy || value.length >= max}>
        {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Paperclip className="h-4 w-4 mr-2" />}
        {busy ? "Enviando…" : `Anexar arquivo (${value.length}/${max})`}
      </Button>
      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((a, i) => (
            <li key={a.path} className="flex items-center justify-between rounded-md border bg-muted/40 px-2 py-1 text-xs">
              <span className="truncate">{a.name} <span className="text-muted-foreground">({Math.round(a.size / 1024)} KB)</span></span>
              <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
