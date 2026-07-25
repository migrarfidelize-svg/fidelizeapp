import type { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import type { PermissionAction } from "@/lib/permissions";
import { Lock } from "lucide-react";

type Props = {
  action: PermissionAction;
  establishmentId: string | undefined;
  children: ReactNode;
  fallback?: ReactNode;
};

export function PermissionGate({ action, establishmentId, children, fallback }: Props) {
  const { can, isLoading } = usePermissions(establishmentId);
  if (isLoading) return null;
  if (can(action)) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-muted">
        <Lock className="h-5 w-5 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold">Acesso restrito</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Você não tem permissão para acessar esta área. Fale com o dono do estabelecimento
        para liberar acesso.
      </p>
    </div>
  );
}
