import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/app/campanhas")({
  head: () => ({ meta: [{ title: "Campanhas — Fidelize" }] }),
  component: () => (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Programas</div>
        <h1 className="font-display text-3xl font-bold">Campanhas</h1>
      </div>
      <Card><CardContent className="p-8 text-center text-muted-foreground">Edição de campanhas em breve. Sua campanha inicial já está ativa e recebendo carimbos.</CardContent></Card>
    </div>
  ),
});
