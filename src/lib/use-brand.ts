import { useEffect, useState, useSyncExternalStore } from "react";
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

  // Use useQuery for background updates but rely on memoryCache/localStorage for immediate render
  const { data } = useQuery({
    queryKey: ["brand-identity"],
    queryFn: () => load(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    placeholderData: memoryCache || DEFAULT_BRAND,
  });

  useEffect(() => {
    if (!data) return;
    if (JSON.stringify(data) === JSON.stringify(memoryCache)) return;
    memoryCache = data;
    try {
      localStorage.setItem(BRAND_CACHE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [data]);

  return data ?? memoryCache ?? DEFAULT_BRAND;
}
