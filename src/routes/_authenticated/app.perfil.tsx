import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Upload, User as UserIcon, KeyRound, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil — Fidelize" },
      { name: "description", content: "Gerencie seus dados pessoais, foto, e-mail e senha na Fidelize." },
    ],
  }),
  component: PerfilPage,
});

const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

function PerfilPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: me, isLoading } = useQuery({
    queryKey: ["me-profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Sessão expirada");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, phone")
        .eq("id", uid)
        .maybeSingle();
      if (error) throw error;
      return { user: u.user, profile: data };
    },
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [savingPass, setSavingPass] = useState(false);

  useEffect(() => {
    if (me?.profile) {
      setFullName(me.profile.full_name ?? "");
      setPhone(me.profile.phone ?? "");
      setAvatarUrl(me.profile.avatar_url ?? null);
    }
    if (me?.user?.email) setNewEmail(me.user.email);
  }, [me]);

  async function saveProfile() {
    if (!me?.user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() || null, phone: phone.trim() || null, avatar_url: avatarUrl })
        .eq("id", me.user.id);
      if (error) throw error;
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["me-profile"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar perfil");
    } finally {
      setSavingProfile(false);
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !me?.user) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) {
      toast.error("Use PNG, JPG ou WEBP.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 5 MB).");
      return;
    }
    setUploading(true);
    try {
      const path = `${me.user.id}/avatar-${crypto.randomUUID()}.${f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg"}`;
      const { error: upErr } = await supabase.storage.from("logos").upload(path, f, {
        cacheControl: "31536000", upsert: false, contentType: f.type,
      });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage.from("logos").createSignedUrl(path, SIGNED_URL_TTL);
      if (sErr || !signed?.signedUrl) throw sErr || new Error("Falha ao gerar link");
      setAvatarUrl(signed.signedUrl);
      toast.success("Foto carregada. Clique em Salvar para confirmar.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar imagem");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function saveEmail() {
    if (!newEmail || newEmail === me?.user?.email) return;
    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) throw error;
      toast.success("Enviamos um link de confirmação para o novo e-mail.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao alterar e-mail");
    } finally {
      setSavingEmail(false);
    }
  }

  async function savePassword() {
    if (newPass.length < 6) { toast.error("A senha deve ter no mínimo 6 caracteres."); return; }
    if (newPass !== confirmPass) { toast.error("As senhas não conferem."); return; }
    setSavingPass(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) throw error;
      toast.success("Senha atualizada");
      setNewPass(""); setConfirmPass("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao alterar senha");
    } finally {
      setSavingPass(false);
    }
  }

  if (isLoading) {
    return <div className="grid min-h-[40vh] place-items-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const initials = (fullName || me?.user?.email || "?").slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-3xl p-4 md:p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Meu perfil</h1>
        <p className="text-sm text-muted-foreground">Atualize seus dados pessoais, e-mail e senha.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserIcon className="h-4 w-4" />Dados pessoais</CardTitle>
          <CardDescription>Como você aparece na plataforma.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full ring-2 ring-primary/20 bg-primary/10 grid place-items-center text-lg font-bold text-primary">
              {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" /> : initials}
            </div>
            <div className="space-y-2">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onPickFile} />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {avatarUrl ? "Trocar foto" : "Enviar foto"}
              </Button>
              {avatarUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setAvatarUrl(null)}>Remover</Button>
              )}
              <p className="text-xs text-muted-foreground">PNG, JPG ou WEBP até 5 MB.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Nome completo</Label>
              <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefone / WhatsApp</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveProfile} disabled={savingProfile}>
              {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar alterações
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="h-4 w-4" />E-mail de acesso</CardTitle>
          <CardDescription>Ao alterar, enviaremos um link de confirmação para o novo endereço.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <Button onClick={saveEmail} disabled={savingEmail || !newEmail || newEmail === me?.user?.email}>
              {savingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Atualizar e-mail
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" />Senha</CardTitle>
          <CardDescription>Escolha uma senha forte com pelo menos 6 caracteres.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="new_pass">Nova senha</Label>
              <Input id="new_pass" type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm_pass">Confirme a nova senha</Label>
              <Input id="confirm_pass" type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} autoComplete="new-password" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={savePassword} disabled={savingPass || !newPass}>
              {savingPass && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Alterar senha
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
