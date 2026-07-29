import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { UserCheck, Sparkles } from "lucide-react";

const SNOOZE_KEY = "wallet:profile-snooze";
const SNOOZE_MS = 24 * 60 * 60 * 1000;

function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

function maskPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function snoozed() {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    return !!raw && Date.now() - Number(raw) < SNOOZE_MS;
  } catch {
    return false;
  }
}

/**
 * Modal "Complete seu perfil" (nome + WhatsApp).
 *
 * - `required=false` → pode adiar por 24h ("Agora não").
 * - `required=true`  → bloqueia até preencher (ações de valor: prêmios, cartão).
 */
export function CompleteProfileDialog({ required = false }: { required?: boolean }) {
  const [open, setOpen] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: session } = await supabase.auth.getUser();
      const id = session.user?.id;
      if (!id) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      const fullName = (data?.full_name ?? "").trim();
      const rawPhone = onlyDigits(data?.phone ?? "");
      const incomplete = fullName.length < 3 || rawPhone.length < 10;
      setUid(id);
      setName(fullName);
      setPhone(rawPhone ? maskPhone(rawPhone) : "");
      if (incomplete && (required || !snoozed())) setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [required]);

  const digits = onlyDigits(phone);
  const valid = name.trim().length >= 3 && digits.length >= 10 && digits.length <= 11;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!uid || !valid) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: uid, full_name: name.trim(), phone: digits }, { onConflict: "id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil completo! 🎉");
    setOpen(false);
  }

  function later() {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && required) return; // bloqueante
        if (!v) later();
      }}
    >
      <DialogContent
        className={`max-w-md ${required ? "[&>button]:hidden" : ""}`}
        onInteractOutside={(e) => { if (required) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (required) e.preventDefault(); }}
      >
        <DialogHeader>
          <div className="mb-2 grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 text-primary">
            <UserCheck className="h-5 w-5" />
          </div>
          <DialogTitle>Complete seu perfil</DialogTitle>
          <DialogDescription>
            {required
              ? "Precisamos do seu nome e WhatsApp para liberar seus carimbos e recompensas."
              : "Leva 15 segundos e garante que seus carimbos e prêmios fiquem sempre no seu nome."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cp-name">Nome completo</Label>
            <Input
              id="cp-name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 80))}
              placeholder="Seu nome e sobrenome"
              autoComplete="name"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-phone">WhatsApp</Label>
            <Input
              id="cp-phone"
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              placeholder="(11) 99999-9999"
              inputMode="tel"
              autoComplete="tel"
              required
            />
            <p className="text-xs text-muted-foreground">
              É por ele que o estabelecimento te encontra na hora de carimbar.
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
            <Sparkles className="mr-1 inline h-3.5 w-3.5 text-primary" />
            Usamos seus dados apenas dentro do Fidelize. Nada de spam.
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {!required && (
              <Button type="button" variant="ghost" onClick={later}>
                Agora não
              </Button>
            )}
            <Button type="submit" disabled={!valid || saving}>
              {saving ? "Salvando…" : "Salvar e continuar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
