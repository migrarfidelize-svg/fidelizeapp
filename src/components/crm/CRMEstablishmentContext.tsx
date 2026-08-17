import { createContext, useContext } from "react";

export const CRMEstablishmentContext = createContext<string | null>(null);

export function useCRMEstablishmentId(): string {
  const establishmentId = useContext(CRMEstablishmentContext);
  if (!establishmentId) throw new Error("Selecione um estabelecimento para acessar o CRM.");
  return establishmentId;
}
