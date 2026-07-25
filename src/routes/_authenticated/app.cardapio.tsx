import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { useMyFeature } from "@/hooks/useMyFeature";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles, UtensilsCrossed } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/cardapio")({
  component: MenuGate,
});

function MenuGate() {
  const getEsts = useServerFn(getMyEstablishments);
  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const est = memberships?.[0]?.establishment as { id: string; name: string; slug: string } | undefined;
  const { allowed, viaPlan, isLoading } = useMyFeature(est?.id, "digital_menu");

  if (!est || isLoading) return <Outlet />;
  if (allowed) {
    return (
      <>
        {!viaPlan && (
          <div className="mx-4 mt-4 md:mx-8 rounded-lg border border-primary/30 bg-primary-soft/40 px-4 py-3 text-sm flex items-start gap-2">
            <Lock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>
              Acesso liberado pela equipe Fidelize para montar seu cardápio. Para{" "}
              <strong>publicar a vitrine pública</strong>, é necessário um plano com o recurso
              Cardápio digital.{" "}
              <Link to="/app/planos" className="underline font-medium">Ver planos</Link>
            </span>
          </div>
        )}
        <Outlet />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <Card className="border-primary/30">
        <CardContent className="p-8 text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-primary-soft grid place-items-center">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cardápio digital</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Este recurso não está incluído no seu plano atual. Faça upgrade para publicar sua vitrine
              online, com fotos, vídeos, categorias, QR Code por mesa e compartilhamento em PDF.
            </p>
          </div>
          <ul className="text-sm text-left space-y-2 mx-auto max-w-sm">
            <li className="flex gap-2"><UtensilsCrossed className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Página pública /cardapio/{est.slug}</li>
            <li className="flex gap-2"><Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Modelos prontos por segmento, stories em vídeo e PDF</li>
          </ul>
          <Button asChild><Link to="/app/planos">Ver planos</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}
