import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/app/config")({
  head: () => ({ meta: [{ title: "Configurações — Fidelize" }] }),
  component: () => (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Ajustes</div>
        <h1 className="font-display text-3xl font-bold">Configurações</h1>
      </div>
      <Card><CardContent className="p-8 text-center text-muted-foreground">Edição de identidade, cores e planos em breve.</CardContent></Card>
    </div>
  ),
});
