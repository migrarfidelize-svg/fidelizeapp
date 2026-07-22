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
    expect(screen.getByLabelText("Mensagens")).toBeInTheDocument();
  });

  it("renders the exact unread count when between 1 and 9", () => {
    render(<InboxBellBadge unread={3} active={false} />);
    const badge = screen.getByTestId("inbox-bell-badge");
    expect(badge).toHaveTextContent("3");
    expect(screen.getByLabelText("3 mensagens não lidas")).toBeInTheDocument();
  });

  it("caps the count at 9+ for large values", () => {
    render(<InboxBellBadge unread={42} active={false} />);
    expect(screen.getByTestId("inbox-bell-badge")).toHaveTextContent("9+");
    expect(screen.getByLabelText("42 mensagens não lidas")).toBeInTheDocument();
  });

  it("reflects the active state on the trigger", () => {
    render(<InboxBellBadge unread={0} active={true} />);
    const trigger = screen.getByLabelText("Mensagens");
    expect(trigger.className).toContain("border-primary/50");
  });
});
