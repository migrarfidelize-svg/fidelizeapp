import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { ShieldCheck as HeroIcon } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { getAdminStatus } from "@/lib/admin.functions";
import { EquipeTab } from "./admin.config";
import { LoadingSkeleton } from "@/components/states";

export const Route = createFileRoute("/_authenticated/admin/equipe")({
  head: () => ({ meta: [{ title: "Equipe — Fidelize" }] }),
  component: EquipePage,
});

function EquipePage() {
  const getEsts = useServerFn(getMyEstablishments);
  const getAdmin = useServerFn(getAdminStatus);
  const { data: memberships } = useQuery({
    queryKey: ["my-establishments"],
    queryFn: () => getEsts(),
  });
  const { data: admin, isLoading: adminLoading } = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => getAdmin(),
  });

  if (adminLoading) return <LoadingSkeleton variant="page" />;
  if (!admin?.isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-16 p-6 rounded-xl border bg-card text-center space-y-2">
        <h2 className="text-lg font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground">Apenas administradores podem gerenciar a equipe.</p>
      </div>
    );
  }

  const est = memberships?.[0]?.establishment as { id: string; name: string } | undefined;
  if (!est) return <LoadingSkeleton variant="page" />;

  return (
    <div className="space-y-4">
      <PageHero
        icon={HeroIcon}
        eyebrow={"Super Admin · Time interno"}
        title={"Time interno Fidelize"}
        subtitle={"Administradores, papéis e escopos de acesso da plataforma."}
      />
      <div>
        <h1 className="text-2xl font-semibold">Equipe</h1>
        <p className="text-sm text-muted-foreground">Gerencie os membros e convites de {est.name}.</p>
      </div>
      <EquipeTab establishmentId={est.id} />
    </div>
  );
}
