import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { LoyaltyVoucher, type VoucherProps } from "@/components/LoyaltyVoucher";

const baseProps = (overrides: Partial<VoucherProps> = {}): VoucherProps => ({
  brandName: "Café Aurora",
  campaignName: "Café grátis",
  customerName: "Maria Silva",
  customerCode: "AB12CD",
  qrValue: "https://fidelize.app/c/token-abc-1234567890abcdef",
  stamps: 3,
  required: 10,
  reward: "1 Café expresso",
  ...overrides,
});

describe("LoyaltyVoucher", () => {
  it("renders brand, campaign, progress and QR payload", () => {
    render(<LoyaltyVoucher {...baseProps()} />);
    expect(screen.getByText("Café Aurora")).toBeInTheDocument();
    expect(screen.getByText("Café grátis")).toBeInTheDocument();
    expect(screen.getByText("3 / 10")).toBeInTheDocument();
    // "Faltam 7 carimbos"
    expect(screen.getByText(/Faltam/i).textContent).toMatch(/7/);
  });

  it("updates progress and status text when stamps change", () => {
    const { rerender } = render(<LoyaltyVoucher {...baseProps({ stamps: 3 })} />);
    expect(screen.getByText("3 / 10")).toBeInTheDocument();

    rerender(<LoyaltyVoucher {...baseProps({ stamps: 7 })} />);
    expect(screen.getByText("7 / 10")).toBeInTheDocument();
    expect(screen.getByText(/Faltam/i).textContent).toMatch(/3/);
  });

  it("shows reward-available UI when goal is reached", () => {
    render(<LoyaltyVoucher {...baseProps({ stamps: 10, rewardAvailable: true })} />);
    expect(screen.getByText("10 / 10")).toBeInTheDocument();
    expect(screen.getByText(/Recompensa disponível/i)).toBeInTheDocument();
    expect(screen.getByText(/Parabéns/i)).toBeInTheDocument();
  });
});

describe("Multi-campaign carousel", () => {
  function Carousel({ cards }: { cards: VoucherProps[] }) {
    return (
      <div data-testid="carousel" className="flex overflow-x-auto">
        {cards.map((c, i) => (
          <div key={i} data-testid="carousel-item" className="min-w-[92%] snap-center">
            <LoyaltyVoucher {...c} />
          </div>
        ))}
      </div>
    );
  }

  it("renders one voucher per campaign with independent progress", () => {
    const cards = [
      baseProps({ campaignName: "Café grátis", stamps: 3, required: 10 }),
      baseProps({ campaignName: "Sobremesa", stamps: 5, required: 6, reward: "Sobremesa" }),
      baseProps({ campaignName: "Combo", stamps: 6, required: 6, reward: "Combo grátis", rewardAvailable: true }),
    ];
    render(<Carousel cards={cards} />);
    const items = screen.getAllByTestId("carousel-item");
    expect(items).toHaveLength(3);

    expect(within(items[0]).getByText("3 / 10")).toBeInTheDocument();
    expect(within(items[1]).getByText("5 / 6")).toBeInTheDocument();
    expect(within(items[2]).getByText("6 / 6")).toBeInTheDocument();
    expect(within(items[2]).getByText(/Parabéns/i)).toBeInTheDocument();
  });
});
