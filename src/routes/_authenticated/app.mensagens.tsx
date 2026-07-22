import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyMerchantMessages,
  publishMerchantMessage,
  deleteMerchantMessage,
  nextPublishSlot,
} from "@/lib/inbox.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { MessageSquare, Send, Trash2, Clock, Tag, Megaphone, Bell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/mensagens")({
  head: () => ({ meta: [{ title: "Central de mensagens — Fidelize" }] }),
  component: MerchantMessagesPage,
});

type Kind = "promo" | "novidade" | "aviso";

function MerchantMessagesPage() {
  const [estId, setEstId] = useState<string | null>(null);
  const [estName, setEstName] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getUser();
      const uid = session.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from("establishment_members")
        .select("establishment_id, establishments(name)")
        .eq("user_id", uid)
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      if (data?.establishment_id) {
        setEstId(data.establishment_id);
        setEstName((data.establishments as { name: string } | null)?.name ?? "");
      }
    })();
  }, []);

  if (!estId) {
    return (
      <div className="pt-10 text-center text-sm text-muted-foreground">
        Carregando estabelecimento…
      </div>
    );
  }

  return <Composer estId={estId} estName={estName} />;
}

function Composer({ estId, estName }: { estId: string; estName: string }) {
  const qc = useQueryClient();
  const publishFn = useServerFn(publishMerchantMessage);
  const deleteFn = useServerFn(deleteMerchantMessage);
  const listFn = useServerFn(listMyMerchantMessages);
  const slotFn = useServerFn(nextPublishSlot);

  const list = useQuery({
    queryKey: ["merchant-messages", estId],
    queryFn: () => listFn({ data: { establishmentId: estId } }),
  });

  const slot = useQuery({
    queryKey: ["merchant-messages-slot", estId],
    queryFn: () => slotFn({ data: { establishmentId: estId } }),
    refetchInterval: 60_000,
  });

  const [kind, setKind] = useState<Kind>("novidade");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const publish = useMutation({
    mutationFn: () =>
      publishFn({
        data: {
          establishmentId: estId,
          kind,
          title: title.trim(),
          body: body.trim(),
          imageUrl: imageUrl.trim() || null,
          linkUrl: linkUrl.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Mensagem enviada para seus clientes.");
      setTitle("");
      setBody("");
      setImageUrl("");
      setLinkUrl("");
      qc.invalidateQueries({ queryKey: ["merchant-messages", estId] });
      qc.invalidateQueries({ queryKey: ["merchant-messages-slot", estId] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Falha ao enviar.";
      toast.error(msg);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Mensagem removida.");
      qc.invalidateQueries({ queryKey: ["merchant-messages", estId] });
    },
  });

  const canSend = slot.data?.canSendNow ?? true;
  const nextAt = slot.data?.canSendAt ? new Date(slot.data.canSendAt) : null;
  const nextLabel = useMemo(() => {
    if (!nextAt) return null;
    const diff = nextAt.getTime() - Date.now();
    if (diff <= 0) return null;
    const hours = Math.floor(diff / 36e5);
    const days = Math.floor(hours / 24);
    if (days >= 1) return `${days} dia${days > 1 ? "s" : ""}`;
    return `${hours}h`;
  }, [nextAt]);

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Comunicação · {estName}
        </div>
        <h1 className="mt-1 flex items-center gap-2 font-display text-3xl font-bold">
          <MessageSquare className="h-7 w-7 text-primary" /> Central de mensagens
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Envie 1 mensagem por semana para todos os seus clientes cadastrados na Carteira Fidelize.
          Aparece no ícone de sino da carteira, com badge de não-lida.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova mensagem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canSend && nextLabel && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Você já enviou uma mensagem esta semana. Próximo envio em{" "}
                <strong>{nextLabel}</strong>.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { k: "novidade", label: "Novidade", Icon: Megaphone },
                { k: "promo", label: "Promoção", Icon: Tag },
                { k: "aviso", label: "Aviso", Icon: Bell },
              ] as const
            ).map(({ k, label, Icon }) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={
                  "flex items-center justify-center gap-2 rounded-xl border py-2 text-sm font-semibold transition-colors " +
                  (kind === k
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground")
                }
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          <div>
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Ex: 20% off nesta sexta"
            />
            <div className="mt-1 text-right text-[10px] text-muted-foreground">
              {title.length}/120
            </div>
          </div>

          <div>
            <Label htmlFor="body">Mensagem</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              rows={5}
              placeholder="Conte a novidade, condição e validade da oferta."
            />
            <div className="mt-1 text-right text-[10px] text-muted-foreground">
              {body.length}/2000
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="image">Imagem (URL, opcional)</Label>
              <Input
                id="image"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label htmlFor="link">Link (opcional)</Label>
              <Input
                id="link"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          <Button
            onClick={() => publish.mutate()}
            disabled={
              !canSend ||
              publish.isPending ||
              title.trim().length < 3 ||
              body.trim().length < 3
            }
            className="w-full"
          >
            <Send className="mr-2 h-4 w-4" />
            {publish.isPending ? "Enviando…" : "Enviar para meus clientes"}
          </Button>
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Enviadas recentemente
        </h2>
        {list.data && list.data.length > 0 ? (
          <ul className="space-y-2">
            {list.data.map((m) => (
              <li
                key={m.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-card/40 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                    {m.kind} · {new Date(m.published_at).toLocaleString()}
                  </div>
                  <div className="truncate font-semibold">{m.title}</div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{m.body}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (confirm("Remover esta mensagem?")) remove.mutate(m.id);
                  }}
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma mensagem enviada ainda.</p>
        )}
      </section>
    </div>
  );
}
