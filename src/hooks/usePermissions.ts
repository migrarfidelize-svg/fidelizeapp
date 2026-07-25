import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyPermissions } from "@/lib/permissions.functions";
import type { PermissionAction, MemberRole } from "@/lib/permissions";

export function usePermissions(establishmentId: string | undefined) {
  const fn = useServerFn(getMyPermissions);
  const q = useQuery({
    queryKey: ["my-permissions", establishmentId],
    queryFn: () => fn({ data: { establishment_id: establishmentId! } }),
    enabled: !!establishmentId,
    staleTime: 60_000,
  });

  const permissions = q.data?.permissions ?? ({} as Record<PermissionAction, boolean>);
  const role = (q.data?.role ?? "staff") as MemberRole;
  const isSuper = !!q.data?.isSuper;

  const can = (action: PermissionAction) => {
    if (isSuper) return true;
    return permissions[action] === true;
  };

  return {
    isLoading: q.isLoading,
    role,
    isSuper,
    permissions,
    can,
  };
}
