import { supabase } from "@/integrations/supabase/client";

/**
 * Normaliza a URL da logo do estabelecimento.
 * Trata signed URLs antigas e caminhos relativos, garantindo que usem o host atual e o bucket público.
 */
export function resolveLogoUrl(value?: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const signedMarker = "/storage/v1/object/sign/logos/";
    const publicMarker = "/storage/v1/object/public/logos/";

    // Se for uma signed URL antiga, extraímos o path do objeto e geramos uma URL pública estável
    if (url.pathname.includes(signedMarker)) {
      const encodedPath = url.pathname.split(signedMarker)[1];
      if (!encodedPath) return value;

      let objectPath = encodedPath;
      try {
        objectPath = decodeURIComponent(encodedPath);
      } catch {
        // Mantém original se falhar o decode
      }

      const { data } = supabase.storage.from("logos").getPublicUrl(objectPath);
      return data?.publicUrl || value;
    }

    // Se for uma URL pública, removemos query params (como tokens ou timestamps de cache)
    if (url.pathname.includes(publicMarker)) {
      return value.split("?")[0];
    }

    return value;
  } catch {
    // Compatibilidade caso o valor seja apenas o path relativo do objeto no bucket
    if (!value.startsWith("http://") && !value.startsWith("https://")) {
      const cleanPath = value.replace(/^\/+/, "");
      const { data } = supabase.storage.from("logos").getPublicUrl(cleanPath);
      return data?.publicUrl || value;
    }

    return value;
  }
}
