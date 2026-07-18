import {
  Coffee, Scissors, Pizza, Star, IceCream, ShoppingBag, Wrench, Sparkles, Gift,
  Heart, Check, Beer, Cookie, Utensils, Car, Dumbbell, Flower2, Cake, Croissant,
  Wine, Dog, Leaf, type LucideIcon,
} from "lucide-react";

/** Central stamp icon registry — shared by StampCard, LoyaltyVoucher and campaign editor. */
export const STAMP_ICONS: Record<string, LucideIcon> = {
  star: Star,
  heart: Heart,
  check: Check,
  coffee: Coffee,
  scissors: Scissors,
  pizza: Pizza,
  icecream: IceCream,
  bag: ShoppingBag,
  wrench: Wrench,
  sparkles: Sparkles,
  gift: Gift,
  beer: Beer,
  wine: Wine,
  cookie: Cookie,
  cake: Cake,
  croissant: Croissant,
  utensils: Utensils,
  car: Car,
  dumbbell: Dumbbell,
  flower: Flower2,
  dog: Dog,
  leaf: Leaf,
};

export const STAMP_ICON_OPTIONS: { value: string; label: string }[] = [
  { value: "star", label: "Estrela" },
  { value: "heart", label: "Coração" },
  { value: "check", label: "Check" },
  { value: "coffee", label: "Café" },
  { value: "scissors", label: "Tesoura" },
  { value: "pizza", label: "Pizza" },
  { value: "icecream", label: "Sorvete" },
  { value: "bag", label: "Sacola" },
  { value: "wrench", label: "Chave inglesa" },
  { value: "sparkles", label: "Brilho" },
  { value: "gift", label: "Presente" },
  { value: "beer", label: "Cerveja" },
  { value: "wine", label: "Vinho" },
  { value: "cookie", label: "Biscoito" },
  { value: "cake", label: "Bolo" },
  { value: "croissant", label: "Croissant" },
  { value: "utensils", label: "Talheres" },
  { value: "car", label: "Carro" },
  { value: "dumbbell", label: "Halter" },
  { value: "flower", label: "Flor" },
  { value: "dog", label: "Pet" },
  { value: "leaf", label: "Folha" },
];

export const DEFAULT_STAMP_ICON = "star";

export function getStampIcon(key: string | null | undefined): LucideIcon {
  return STAMP_ICONS[key ?? ""] ?? STAMP_ICONS[DEFAULT_STAMP_ICON];
}

export function stampIconLabel(key: string | null | undefined): string {
  return STAMP_ICON_OPTIONS.find((o) => o.value === key)?.label
    ?? STAMP_ICON_OPTIONS.find((o) => o.value === DEFAULT_STAMP_ICON)!.label;
}
