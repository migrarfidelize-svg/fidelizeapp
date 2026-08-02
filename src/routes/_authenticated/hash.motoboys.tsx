import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PageHero } from "@/components/PageHero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/states/EmptyState";
import {
  Bike, KeyRound, Lock, Search, ShieldCheck, Eye, Star, FileText, Loader2, Ban, CheckCheck, RotateCcw,
} from "lucide-react";
import {
  unlockCourierArea, adminListCouriers, adminGetCourier, adminSetCourierStatus, adminSignCourierDocument,
} from "@/lib/couriers.functions";

export const Route = createFileRoute("/_authenticated/hash/motoboys")({
  head: () => ({
    meta: [
      { title: "Motoboys — Fidelize Admin" },
      { name: "description", content: "Aprovação, documentos e desempenho dos entregadores da plataforma." },
    ],
  }),
  component: MotoboysPage,
});

const DOC_LABEL: Record<string, string> = {
  cnh: "CNH", crlv: "CRLV", selfie: "Selfie", proof_address: "Comprovante de endereço",
  criminal_record: "Antecedentes", other: "Outro",
};

const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  suspended: "bg-muted text-muted-foreground",
};

function MotoboysPage() {
  const unlockFn = useServerFn(unlockCourierArea);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");

  const unlock = useMutation({
    mutationFn: () => unlockFn({ data: { pin } }),
    onSuccess: (r: any) => {
      if (r?.ok) { setUnlocked(true); toast.success("Área liberada"); }
      else toast.error("Código incorreto");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao validar o código"),
  });

  if (!unlocked) {
    return (
      <div className="grid min-h-[70vh] place-items-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Lock className="h-6 w-6" />
            </div>
            <CardTitle>Área protegida</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-center text-sm text-muted-foreground">
              Informe o código de acesso para abrir os dados dos entregadores.
            </p>
            <Input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              onKeyDown={(e) => e.key === "Enter" && unlock.mutate()}
              inputMode="numeric"
              placeholder="••••"
              className="text-center text-2xl tracking-[0.5em]"
            />
            <Button className="w-full" onClick={() => unlock.mutate()} disabled={unlock.isPending || pin.length < 4}>
              {unlock.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Desbloquear
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <CouriersPanel />;
}

function CouriersPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListCouriers);
  const [status, setStatus] = useState<"all" | "pending" | "approved" | "rejected" | "suspended">("pending");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["admin-couriers", status, search],
    queryFn: () => listFn({ data: { status, search } }),
    refetchInterval: 30_000,
  });

  const couriers = (list.data as any)?.couriers ?? [];
  const counts = (list.data as any)?.counts ?? { pending: 0, approved: 0, rejected: 0, suspended: 0 };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHero
        icon={Bike}
        eyebrow="Logística"
        title="Motoboys"
        subtitle="Aprove cadastros, consulte documentos protegidos e acompanhe o desempenho dos entregadores."
        ticker={[
          { label: "Em análise", value: counts.pending, icon: ShieldCheck },
          { label: "Aprovados", value: counts.approved, icon: CheckCheck },
          { label: "Suspensos", value: counts.suspended, icon: Ban },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={status} onValueChange={(v) => setStatus(v as any)}>
          <TabsList>
            <TabsTrigger value="pending">Em análise ({counts.pending})</TabsTrigger>
            <TabsTrigger value="approved">Aprovados</TabsTrigger>
            <TabsTrigger value="suspended">Suspensos</TabsTrigger>
            <TabsTrigger value="rejected">Recusados</TabsTrigger>
            <TabsTrigger value="all">Todos</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, CPF ou telefone" className="pl-9" />
        </div>
      </div>

      {couriers.length === 0 ? (
        <EmptyState icon={Bike} title="Nenhum entregador" description="Assim que alguém se cadastrar, o pedido aparece aqui para análise." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {couriers.map((c: any) => (
            <Card key={c.id} className="transition hover:shadow-md">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.full_name}</p>
                    <p className="text-xs text-muted-foreground">{c.city ?? "—"} · {c.vehicle_type ?? "moto"}</p>
                  </div>
                  <Badge variant="outline" className={STATUS_TONE[c.status]}>{c.status}</Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {Number(c.rating_avg ?? 0).toFixed(1)} ({c.rating_count ?? 0})
                  </span>
                  <span>{c.deliveries_count ?? 0} entregas</span>
                  <Badge variant="outline" className="capitalize">{c.level_code}</Badge>
                </div>
                <Button variant="secondary" size="sm" className="w-full" onClick={() => setOpenId(c.id)}>
                  <Eye className="mr-1 h-4 w-4" /> Ver cadastro
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CourierDrawer
        courierId={openId}
        onClose={() => setOpenId(null)}
        onChanged={() => qc.invalidateQueries({ queryKey: ["admin-couriers"] })}
      />
    </div>
  );
}

function CourierDrawer({ courierId, onClose, onChanged }: { courierId: string | null; onClose: () => void; onChanged: () => void }) {
  const getFn = useServerFn(adminGetCourier);
  const statusFn = useServerFn(adminSetCourierStatus);
  const signFn = useServerFn(adminSignCourierDocument);
  const [reason, setReason] = useState("");

  const q = useQuery({
    queryKey: ["admin-courier", courierId],
    queryFn: () => getFn({ data: { courier_id: courierId! } }),
    enabled: !!courierId,
  });

  const setStatus = useMutation({
    mutationFn: (s: "approved" | "rejected" | "suspended" | "pending") =>
      statusFn({ data: { courier_id: courierId!, status: s, reason: reason || null } }),
    onSuccess: () => { toast.success("Status atualizado"); q.refetch(); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar"),
  });

  const openDoc = useMutation({
    mutationFn: (id: string) => signFn({ data: { document_id: id } }),
    onSuccess: (r: any) => {
      if (r?.url) window.open(r.url, "_blank", "noopener,noreferrer");
      else toast.error("Arquivo indisponível");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao abrir documento"),
  });

  const c = (q.data as any)?.courier;
  const docs = (q.data as any)?.documents ?? [];
  const reviews = (q.data as any)?.reviews ?? [];

  return (
    <Dialog open={!!courierId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{c?.full_name ?? "Cadastro do entregador"}</DialogTitle>
          <DialogDescription>
            Documentos ficam no armazenamento protegido. O link de visualização expira em 60 segundos e o acesso é auditado.
          </DialogDescription>
        </DialogHeader>

        {q.isLoading || !c ? (
          <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <Field label="CPF" value={c.cpf} />
              <Field label="Telefone" value={c.phone} />
              <Field label="Cidade/UF" value={`${c.city ?? "—"} / ${c.state ?? "—"}`} />
              <Field label="Veículo" value={`${c.vehicle_type ?? "—"} ${c.vehicle_plate ?? ""}`} />
              <Field label="Chave PIX" value={c.pix_key} />
              <Field label="Saldo" value={((c.balance_cents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">Documentos ({docs.length})</p>
              <div className="space-y-2">
                {docs.length === 0 && <p className="text-xs text-muted-foreground">Nenhum documento enviado.</p>}
                {docs.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                    <span className="inline-flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {DOC_LABEL[d.doc_type] ?? d.doc_type}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => openDoc.mutate(d.id)} disabled={openDoc.isPending}>
                      <Eye className="mr-1 h-3.5 w-3.5" /> Ver
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {reviews.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold">Avaliações recentes</p>
                <div className="space-y-2">
                  {reviews.slice(0, 5).map((r: any) => (
                    <div key={r.id} className="rounded-lg border p-2 text-sm">
                      <span className="inline-flex items-center gap-1 text-amber-500">
                        {Array.from({ length: Number(r.rating ?? 0) }).map((_, i) => (
                          <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                        ))}
                      </span>
                      {r.comment && <p className="mt-1 text-muted-foreground">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="reason" className="text-xs">Motivo (recusa ou suspensão)</Label>
              <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            </div>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          {c?.status !== "approved" && (
            <Button onClick={() => setStatus.mutate("approved")} disabled={setStatus.isPending}>
              <CheckCheck className="mr-1 h-4 w-4" /> Aprovar
            </Button>
          )}
          {c?.status === "approved" && (
            <Button variant="destructive" onClick={() => setStatus.mutate("suspended")} disabled={setStatus.isPending}>
              <Ban className="mr-1 h-4 w-4" /> Desativar
            </Button>
          )}
          {(c?.status === "suspended" || c?.status === "rejected") && (
            <Button variant="secondary" onClick={() => setStatus.mutate("approved")} disabled={setStatus.isPending}>
              <RotateCcw className="mr-1 h-4 w-4" /> Reativar
            </Button>
          )}
          {c?.status === "pending" && (
            <Button variant="outline" onClick={() => setStatus.mutate("rejected")} disabled={setStatus.isPending}>
              Recusar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg border p-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value || "—"}</p>
    </div>
  );
}
