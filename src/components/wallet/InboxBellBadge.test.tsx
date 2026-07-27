import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { InboxBellBadge } from "./InboxBellBadge";

// Stub TanStack Router's Link so we can render outside a router context
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...rest }: { children: React.ReactNode } & Record<string, unknown>) => (
    <a {...(rest as Record<string, unknown>)}>{children}</a>
  ),
}));

describe("InboxBellBadge", () => {
  beforeEach(() => cleanup());

  it("hides the badge and uses the neutral label when unread is 0", () => {
    render(<InboxBellBadge unread={0} active={false} />);
    expect(screen.queryByTestId("inbox-bell-badge")).toBeNull();
    expect(screen.getByLabelText("Notificações")).toBeInTheDocument();
  });

  it("renders the exact unread count when between 1 and 9", () => {
    render(<InboxBellBadge unread={3} active={false} />);
    const badge = screen.getByTestId("inbox-bell-badge");
    expect(badge).toHaveTextContent("3");
    expect(screen.getByLabelText("3 mensagens")).toBeInTheDocument();
  });

  it("caps the count at 9+ for large values", () => {
    render(<InboxBellBadge unread={42} active={false} />);
    expect(screen.getByTestId("inbox-bell-badge")).toHaveTextContent("9+");
    expect(screen.getByLabelText("42 mensagens")).toBeInTheDocument();
  });

  it("soma recompensas prontas no total e no rótulo", () => {
    render(<InboxBellBadge unread={1} active={false} readyRewards={2} />);
    expect(screen.getByTestId("inbox-bell-badge")).toHaveTextContent("3");
    expect(screen.getByLabelText("1 mensagem e 2 recompensas prontas")).toBeInTheDocument();
  });

  it("reflects the active state on the trigger", () => {
    render(<InboxBellBadge unread={0} active={true} />);
    const trigger = screen.getByLabelText("Notificações");
    expect(trigger.className).toContain("border-primary/50");
  });
});
