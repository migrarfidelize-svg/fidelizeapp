import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";

/**
 * Pure presentational badge for the wallet header. Extracted so we can test
 * the badge rendering independently of the router query wiring.
 */
export function InboxBellBadge({
  unread,
  active,
}: {
  unread: number;
  active: boolean;
}) {
  const label = unread > 0 ? `${unread} mensagens não lidas` : "Mensagens";
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
      {unread > 0 && (
        <span
          data-testid="inbox-bell-badge"
          className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-black leading-[18px] text-primary-foreground shadow-[0_0_8px_color-mix(in_oklab,var(--primary)_55%,transparent)]"
          aria-hidden
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
