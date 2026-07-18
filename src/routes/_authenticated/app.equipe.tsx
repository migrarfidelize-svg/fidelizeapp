import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { getAdminStatus } from "@/lib/admin.functions";
import { EquipeTab } from "./app.config";

export const Route = createFileRoute("/_authenticated/app/equipe")({
  head: () => ({ meta: [{ title: "Equipe — Fidelize" }] }),
  component: EquipePage,
});

function EquipePage() {
  const getEsts = useServerFn(getMyEstablishments);
  const getAdmin = useServerFn(getAdminStatus);
  const { data: memberships } = useQuery({
    queryKey: ["my-establishments"],
    queryFn: () => getEsts({ data: {} }),
  });
  const { data: admin, isLoading: adminLoading } = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => getAdmin({ data: {} }),
  });

  if (adminLoading) return <div className="text-muted-foreground">Carregando…</div>;
  if (!admin?.is_super_admin) {
    return (
      <div className="max-w-md mx-auto mt-16 p-6 rounded-xl border bg-card text-center space-y-2">
        <h2 className="text-lg font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground">Apenas administradores podem gerenciar a equipe.</p>
      </div>
    );
  }

  const est = memberships?.[0]?.establishment as { id: string; name: string } | undefined;
  if (!est) return <div className="text-muted-foreground">Carregando estabelecimento…</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Equipe</h1>
        <p className="text-sm text-muted-foreground">Gerencie os membros e convites de {est.name}.</p>
      </div>
      <EquipeTab establishmentId={est.id} />
    </div>
  );
}
