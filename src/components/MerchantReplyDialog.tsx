import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Reply, Loader2, EyeOff, Eye } from "lucide-react";
import { toast } from "sonner";
import { replyPublicReview, togglePublicReviewVisibility } from "@/lib/public-reviews.functions";

interface Props {
  reviewId: string;
  currentReply?: string | null;
  publicHidden?: boolean;
  invalidateKeys?: string[][];
}

export function MerchantReplyDialog({ reviewId, currentReply, publicHidden, invalidateKeys = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(currentReply ?? "");
  const qc = useQueryClient();
  const replyFn = useServerFn(replyPublicReview);
  const toggleFn = useServerFn(togglePublicReviewVisibility);

  const invalidateAll = () => invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));

  const reply = useMutation({
    mutationFn: async () => replyFn({ data: { id: reviewId, reply: text } }),
    onSuccess: (res) => {
      toast.success(res.has_email ? "Resposta publicada. Cliente será notificado." : "Resposta publicada.");
      invalidateAll();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async () => toggleFn({ data: { id: reviewId, hidden: !publicHidden } }),
    onSuccess: () => {
      toast.success(publicHidden ? "Avaliação exibida publicamente." : "Avaliação oculta da vitrine.");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex items-center gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant={currentReply ? "outline" : "default"}>
            <Reply className="mr-1 h-3.5 w-3.5" />
            {currentReply ? "Editar resposta" : "Responder"}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resposta pública à avaliação</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Sua resposta aparecerá abaixo da avaliação na página pública. Seja educado e objetivo — outros clientes verão.
          </p>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Olá! Agradecemos o feedback. Já entramos em contato para..."
            className="min-h-32"
            maxLength={1500}
          />
          <div className="text-right text-xs text-muted-foreground">{text.length}/1500</div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => reply.mutate()} disabled={reply.isPending || text.trim().length < 2}>
              {reply.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Publicar resposta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button size="sm" variant="ghost" onClick={() => toggle.mutate()} disabled={toggle.isPending} title={publicHidden ? "Exibir publicamente" : "Ocultar da vitrine"}>
        {publicHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  );
}
