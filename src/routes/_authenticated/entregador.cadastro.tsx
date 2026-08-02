import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, FileUp, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getMyCourier, registerCourierDocument, saveCourierProfile } from "@/lib/courier-app.functions";

export const Route = createFileRoute("/_authenticated/entregador/cadastro")({
  head: () => ({
    meta: [
      { title: "Cadastro de Entregador — Fidelize" },
      { name: "description", content: "Envie seus dados e documentos para começar a fazer entregas pelo Fidelize." },
      { property: "og:title", content: "Cadastro de Entregador — Fidelize" },
      { property: "og:description", content: "Cadastro rápido, documentos seguros e aprovação da equipe Fidelize." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CourierSignup,
});

const DOCS = [
  { key: "cnh", label: "CNH ou RG", hint: "Frente e verso legíveis" },
  { key: "selfie", label: "Selfie com documento", hint: "Rosto visível" },
  { key: "crlv", label: "Documento do veículo", hint: "CRLV (moto/carro)" },
  { key: "proof_address", label: "Comprovante de endereço", hint: "Últimos 3 meses" },
] as const;

const VEHICLES = [
  { key: "moto", label: "Moto" },
  { key: "bike", label: "Bike" },
  { key: "carro", label: "Carro" },
  { key: "a_pe", label: "A pé" },
] as const;

function CourierSignup() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: me, isLoading } = useQuery({ queryKey: ["courier", "me"], queryFn: () => getMyCourier() });
  const courier = me?.courier ?? null;

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    cpf: "",
    phone: "",
    birth_date: "",
    vehicle_type: "moto" as (typeof VEHICLES)[number]["key"],
    vehicle_plate: "",
    vehicle_model: "",
    city: "",
    state: "",
    pix_key: "",
  });
  const [hydrated, setHydrated] = useState(false);
  if (courier && !hydrated) {
    setHydrated(true);
    setForm((f) => ({
      ...f,
      full_name: courier.full_name ?? "",
      cpf: courier.cpf ?? "",
      phone: courier.phone ?? "",
      birth_date: courier.birth_date ?? "",
      vehicle_type: (courier.vehicle_type ?? "moto") as typeof f.vehicle_type,
      vehicle_plate: courier.vehicle_plate ?? "",
      vehicle_model: courier.vehicle_model ?? "",
      city: courier.city ?? "",
      state: courier.state ?? "",
      pix_key: courier.pix_key ?? "",
    }));
  }

  const sent = new Set((me?.documents ?? []).map((d: any) => d.doc_type));

  async function save() {
    if (form.full_name.trim().length < 3) return toast.error("Informe seu nome completo.");
    setSaving(true);
    try {
      await saveCourierProfile({ data: { ...form, birth_date: form.birth_date || null } });
      await qc.invalidateQueries({ queryKey: ["courier"] });
      toast.success("Dados salvos!");
      setStep(2);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function upload(docType: string, file: File) {
    if (!courier) return toast.error("Salve seus dados primeiro.");
    if (file.size > 8_000_000) return toast.error("Arquivo muito grande (máx. 8MB).");
    setUploading(docType);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${courier.id}/${docType}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("courier-documents").upload(path, file, { upsert: false });
      if (error) throw new Error(error.message);
      await registerCourierDocument({
        data: {
          doc_type: docType as any,
          storage_path: path,
          file_name: file.name.slice(0, 160),
          mime_type: file.type || null,
          size_bytes: file.size,
        },
      });
      await qc.invalidateQueries({ queryKey: ["courier"] });
      toast.success("Documento enviado com segurança.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(null);
    }
  }

  if (isLoading) return <p className="py-16 text-center text-sm text-muted-foreground">Carregando…</p>;

  const steps = ["Dados", "Veículo", "Documentos"];
  const stepIndex = courier && step === 0 ? 0 : step;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex min-w-0 flex-1 items-center gap-2">
              <div
                className={
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold " +
                  (i <= stepIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")
                }
              >
                {i + 1}
              </div>
              <span className={"truncate text-[11px] font-semibold " + (i <= stepIndex ? "text-foreground" : "text-muted-foreground")}>
                {s}
              </span>
            </div>
          ))}
        </div>
      </div>

      {stepIndex < 2 && (
        <div className="space-y-4 rounded-3xl border border-border bg-card p-5">
          {stepIndex === 0 && (
            <>
              <Field label="Nome completo" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
              <Field label="CPF" value={form.cpf} onChange={(v) => setForm({ ...form, cpf: v })} />
              <Field label="WhatsApp" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cidade" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
                <Field label="UF" value={form.state} onChange={(v) => setForm({ ...form, state: v.toUpperCase().slice(0, 2) })} />
              </div>
              <Field label="Data de nascimento" type="date" value={form.birth_date} onChange={(v) => setForm({ ...form, birth_date: v })} />
              <Button className="min-h-[52px] w-full" onClick={() => setStep(1)}>
                Continuar
              </Button>
            </>
          )}

          {stepIndex === 1 && (
            <>
              <div>
                <Label className="text-xs">Tipo de veículo</Label>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {VEHICLES.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => setForm({ ...form, vehicle_type: v.key })}
                      className={
                        "min-h-[48px] rounded-xl border px-2 text-xs font-semibold transition-colors " +
                        (form.vehicle_type === v.key
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-muted/50 text-muted-foreground")
                      }
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
              <Field label="Placa" value={form.vehicle_plate} onChange={(v) => setForm({ ...form, vehicle_plate: v.toUpperCase() })} />
              <Field label="Modelo" value={form.vehicle_model} onChange={(v) => setForm({ ...form, vehicle_model: v })} />
              <Field label="Chave PIX para receber" value={form.pix_key} onChange={(v) => setForm({ ...form, pix_key: v })} />
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="min-h-[52px]" onClick={() => setStep(0)}>
                  Voltar
                </Button>
                <Button className="min-h-[52px]" disabled={saving} onClick={save}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar e enviar docs"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {stepIndex === 2 && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Seus documentos ficam em um cofre privado. Somente a equipe autorizada abre, com registro de auditoria.
          </div>

          {DOCS.map((doc) => (
            <div key={doc.key} className="rounded-2xl border border-border bg-card p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{doc.label}</p>
                  <p className="text-[11px] text-muted-foreground">{doc.hint}</p>
                </div>
                {sent.has(doc.key) ? (
                  <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary">
                    <CheckCircle2 className="h-4 w-4" /> Enviado
                  </span>
                ) : (
                  <label className="shrink-0">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void upload(doc.key, f);
                        e.target.value = "";
                      }}
                    />
                    <span className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-border bg-muted/60 px-3 text-xs font-semibold">
                      {uploading === doc.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                      Enviar
                    </span>
                  </label>
                )}
              </div>
            </div>
          ))}

          <Button className="min-h-[52px] w-full" onClick={() => navigate({ to: "/entregador" })}>
            Concluir
          </Button>
          <Button variant="ghost" className="w-full text-xs" onClick={() => setStep(0)}>
            Editar meus dados
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input className="mt-1.5 min-h-[48px]" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
