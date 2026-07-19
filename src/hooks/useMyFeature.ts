import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { checkMyFeature } from "@/lib/plans.functions";

export function useMyFeature(establishmentId: string | undefined, featureKey: string) {
  const fn = useServerFn(checkMyFeature);
  const q = useQuery({
    queryKey: ["feature", establishmentId, featureKey],
    queryFn: () => fn({ data: { establishment_id: establishmentId!, feature_key: featureKey } }),
    enabled: !!establishmentId,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
  return {
    allowed: q.data?.allowed ?? false,
    isLoading: q.isLoading,
  };
}
