import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Trash2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LogoUploadProps {
  establishmentId: string;
  currentLogoUrl: string | null;
  onSuccess: (newUrl: string | null) => void;
  className?: string;
}

export function LogoUpload({ establishmentId, currentLogoUrl, onSuccess, className }: LogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validações
    if (!["image/png", "image/jpeg", "image/webp", "image/jpg"].includes(file.type)) {
      toast.error("Formato inválido. Use PNG, JPG ou WEBP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 2MB).");
      return;
    }

    setUploading(true);
    try {
      const ext = file.type.split("/")[1];
      const fileName = `logo-${Date.now()}.${ext}`;
      const path = `establishments/${establishmentId}/${fileName}`;

      // Upload para bucket 'logos'
      const { error: upErr } = await supabase.storage.from("logos").upload(path, file, {
        cacheControl: "31536000",
        upsert: true,
      });
      if (upErr) throw upErr;

      // Pegar URL pública permanente (o bucket logos é público para leitura via políticas)
      const { data } = supabase.storage.from("logos").getPublicUrl(path);
      const publicUrl = data.publicUrl;

      // Opcional: remover a antiga do storage se for do nosso sistema? 
      // Por simplicidade e segurança (evitar remover logos de outros), apenas atualizamos a ref.

      onSuccess(publicUrl);
      toast.success("Logo enviada com sucesso!");
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Erro ao enviar imagem.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemove() {
    if (!confirm("Remover a logo do estabelecimento?")) return;
    onSuccess(null);
    toast.success("Logo removida.");
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-dashed border-border/60 bg-muted/20 flex items-center justify-center">
          {currentLogoUrl ? (
            <img 
              src={currentLogoUrl} 
              alt="Preview" 
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
          )}
          {uploading && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileRef}
              onChange={handleFile}
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="h-9 gap-2"
            >
              <Upload className="h-4 w-4" />
              {currentLogoUrl ? "Alterar logo" : "Selecionar logo"}
            </Button>
            
            {currentLogoUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={uploading}
                onClick={handleRemove}
                className="h-9 gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
                Remover
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
            PNG, JPG ou WEBP · Máx 2MB
          </p>
        </div>
      </div>
    </div>
  );
}
