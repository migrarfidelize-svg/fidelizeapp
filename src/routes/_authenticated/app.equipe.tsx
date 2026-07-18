import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/app/equipe")({
  head: () => ({ meta: [{ title: "Equipe — Fidelize" }] }),
  component: () => (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Acesso</div>
        <h1 className="font-display text-3xl font-bold">Equipe</h1>
      </div>
      <Card><CardContent className="p-8 text-center text-muted-foreground">Gestão de funcionários em breve. Por enquanto, você é o proprietário e pode carimbar.</CardContent></Card>
    </div>
  ),
});
