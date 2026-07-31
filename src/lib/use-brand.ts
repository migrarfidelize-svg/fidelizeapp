import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBrandIdentity } from "@/lib/landing-content.functions";
import { BRAND_CACHE_KEY, DEFAULT_BRAND, normalizeBrand, type BrandIdentity } from "@/lib/brand";

/**
 * Logo da plataforma configurada no painel admin.
 * Usa cache em localStorage para evitar "piscar" a logo padrão em cada navegação.
 */
export function useBrand(): BrandIdentity {
  const load = useServerFn(getBrandIdentity);
  const [cached, setCached] = useState<BrandIdentity | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BRAND_CACHE_KEY);
      if (raw) setCached(normalizeBrand(JSON.parse(raw)));
    } catch {
      /* cache inválido */
    }
  }, []);

  const { data } = useQuery({
    queryKey: ["brand-identity"],
    queryFn: () => load(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    if (!data) return;
    try {
      localStorage.setItem(BRAND_CACHE_KEY, JSON.stringify(data));
    } catch {
      /* storage cheio/bloqueado */
    }
  }, [data]);

  return data ?? cached ?? DEFAULT_BRAND;
}
