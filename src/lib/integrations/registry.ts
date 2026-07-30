import type { IntegrationCategory, IntegrationProvider } from "./types";
import { aiProviders } from "./ai";
import { paymentProviders } from "./payments";
import { marketingProviders } from "./marketing";

const ALL: IntegrationProvider[] = [...aiProviders, ...paymentProviders, ...marketingProviders];

export function listProviders(category?: IntegrationCategory): IntegrationProvider[] {
  return category ? ALL.filter((p) => p.meta.category === category) : ALL;
}

export function getProvider(category: IntegrationCategory, id: string): IntegrationProvider {
  const found = ALL.find((p) => p.meta.category === category && p.meta.id === id);
  if (!found) throw new Error(`Provider desconhecido: ${category}/${id}`);
  return found;
}

export function providerCatalog() {
  return ALL.map((p) => p.meta);
}
