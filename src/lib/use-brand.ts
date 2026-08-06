import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBrandIdentity } from "@/lib/landing-content.functions";
import { BRAND_CACHE_KEY, DEFAULT_BRAND, normalizeBrand, type BrandIdentity } from "@/lib/brand";

// Variável de módulo para persistir o cache em memória durante a sessão da SPA
let memoryCache: BrandIdentity | null = null;

// Tenta carregar do localStorage sincronamente se estivermos no browser
if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem(BRAND_CACHE_KEY);
    if (raw) memoryCache = normalizeBrand(JSON.parse(raw));
  } catch {
    /* ignore */
  }
}

/**
 * Logo da plataforma configurada no painel admin.
 * Implementa estratégia de cache em duas camadas (Memória > LocalStorage) 
 * para eliminar o flash visual durante a hidratação e navegação.
 */
export function useBrand(): BrandIdentity {
  const load = useServerFn(getBrandIdentity);
  const [cached, setCached] = useState<BrandIdentity | null>(memoryCache);

  useEffect(() => {
    if (memoryCache) return;
    try {
      const raw = localStorage.getItem(BRAND_CACHE_KEY);
      if (raw) {
        const brand = normalizeBrand(JSON.parse(raw));
        memoryCache = brand;
        setCached(brand);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const { data } = useQuery({
    queryKey: ["brand-identity"],
    queryFn: () => load(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    // Se já temos algo em cache (memória ou local), não precisamos travar a UI
    placeholderData: memoryCache || undefined,
  });

  useEffect(() => {
    if (!data) return;
    memoryCache = data;
    try {
      localStorage.setItem(BRAND_CACHE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [data]);

  return data ?? cached ?? DEFAULT_BRAND;
}
