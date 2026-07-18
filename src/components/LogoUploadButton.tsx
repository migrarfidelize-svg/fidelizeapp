import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LogoCropper } from "@/components/LogoCropper";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { updateEstablishmentLogo } from "@/lib/settings.functions";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10; // 10 anos

interface Props {
  establishmentId: string;
  currentLogoUrl?: string | null;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
  /** Extra query keys to invalidate após upload. */
  invalidateKeys?: (string | (string | undefined)[])[];
}

export function LogoUploadButton({
  establishmentId,
  currentLogoUrl,
  size = "sm",
  variant = "outline",
  className,
  invalidateKeys = [],
}: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const updateLogo = useServerFn(updateEstablishmentLogo);

  function pick() { inputRef.current?.click(); }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(f.type)) {
      toast.error("Formato não suportado. Use PNG, JPG, WEBP ou SVG.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 5 MB).");
      return;
    }
    setRawFile(f);
    setOpen(true);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onCropped(blob: Blob) {
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Sessão expirada");
      const path = `${uid}/${crypto.randomUUID()}.png`;
      const { error: upErr } = await supabase.storage.from("logos").upload(path, blob, {
        cacheControl: "31536000", upsert: false, contentType: "image/png",
      });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage.from("logos").createSignedUrl(path, SIGNED_URL_TTL);
      if (sErr || !signed?.signedUrl) throw sErr || new Error("Falha ao gerar link");
      await updateLogo({ data: { establishment_id: establishmentId, logo_url: signed.signedUrl } });
      toast.success("Logo atualizado!");
      qc.invalidateQueries({ queryKey: ["memberships"] });
      qc.invalidateQueries({ queryKey: ["est-full", establishmentId] });
      for (const key of invalidateKeys) {
        qc.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar logo");
    } finally {
      setUploading(false);
      setRawFile(null);
    }
  }

  const hasLogo = !!currentLogoUrl;
  return (
    <>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={onFile} />
      <Button type="button" size={size} variant={variant} className={className} onClick={pick} disabled={uploading}>
        {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> :
          hasLogo ? <Pencil className="h-4 w-4 mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
        {uploading ? "Enviando..." : hasLogo ? "Trocar logo" : "Enviar logo"}
      </Button>
      <LogoCropper file={rawFile} open={open} onOpenChange={setOpen} onCropped={onCropped} />
    </>
  );
}
