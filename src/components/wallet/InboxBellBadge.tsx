import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";

/**
 * Badge unificado do sino: soma mensagens não lidas + recompensas prontas.
 * Rota alvo continua sendo a caixa de mensagens (hub de novidades da conta);
 * o número inclui recompensas para o cliente não perder um resgate disponível.
 */
export function InboxBellBadge({
  unread,
  active,
  readyRewards = 0,
}: {
  unread: number;
  active: boolean;
  readyRewards?: number;
}) {
  const total = unread + readyRewards;
  const parts: string[] = [];
  if (unread > 0) parts.push(`${unread} ${unread === 1 ? "mensagem" : "mensagens"}`);
  if (readyRewards > 0)
    parts.push(`${readyRewards} ${readyRewards === 1 ? "recompensa pronta" : "recompensas prontas"}`);
  const label = parts.length ? parts.join(" e ") : "Notificações";
  return (
    <Link
      to="/carteira/mensagens"
      className={
        "relative grid h-9 w-9 place-items-center rounded-full border transition-colors " +
        (active
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border/60 text-muted-foreground hover:text-foreground")
      }
      aria-label={label}
    >
      <Bell className="h-4 w-4" />
      {total > 0 && (
        <span
          data-testid="inbox-bell-badge"
          className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-black leading-[18px] text-primary-foreground shadow-[0_0_8px_color-mix(in_oklab,var(--primary)_55%,transparent)]"
          aria-hidden
        >
          {total > 9 ? "9+" : total}
        </span>
      )}
    </Link>
  );
}
