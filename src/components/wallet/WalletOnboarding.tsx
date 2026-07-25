import { useEffect, useState } from "react";
import { InstallAppCard } from "@/components/wallet/InstallAppCard";
import { EnableNotificationsCard } from "@/components/wallet/EnableNotificationsCard";

/**
 * Fila única de convites da carteira: mostra **um** card por vez.
 * Prioridade: instalar o app → ativar notificações.
 *
 * Antes a home empilhava três blocos (PWA, instalar, notificações) acima do
 * cartão — o cliente novo via pedidos do app antes do próprio produto.
 */
const INSTALL_DISMISS_KEY = "carteira_install_dismissed_v1";
export const WALLET_ONBOARDING_EVENT = "wallet:onboarding-changed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function WalletOnboarding() {
  const [mounted, setMounted] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    setMounted(true);
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(WALLET_ONBOARDING_EVENT, bump);
    return () => window.removeEventListener(WALLET_ONBOARDING_EVENT, bump);
  }, []);

  // Evita divergência de hidratação: só decidimos no cliente.
  if (!mounted) return null;

  let installDismissed = true;
  try {
    installDismissed = localStorage.getItem(INSTALL_DISMISS_KEY) === "1";
  } catch {
    installDismissed = true;
  }

  if (!isStandalone() && !installDismissed) return <InstallAppCard />;
  return <EnableNotificationsCard />;
}
