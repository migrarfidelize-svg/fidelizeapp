import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  Gift, CalendarClock, Clock3, PartyPopper, CheckCircle2,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { getStampIcon } from "@/lib/stampIcons";

function initialsOf(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface VoucherProps {
  brandName: string;
  logoUrl?: string | null;
  campaignName: string;
  customerName: string;
  customerCode: string;
  cardNumber?: string | null;
  qrValue: string;
  stamps: number;
  required: number;
  reward: string;
  primary?: string;
  accent?: string;
  icon?: string;
  lastStampAt?: string | null;
  expiresAt?: string | null;
  rewardAvailable?: boolean;
}

export function LoyaltyVoucher({
  brandName, logoUrl, campaignName, customerName, customerCode, cardNumber,
  qrValue, stamps, required, reward,
  primary = "#5B21B6", accent = "#F97066", icon = "star",
  lastStampAt, expiresAt, rewardAvailable = false,
}: VoucherProps) {
  const Icon = ICONS[icon] ?? Star;
  const filled = Math.min(stamps, required);
  const missing = Math.max(0, required - stamps);
  const progress = required > 0 ? Math.min(100, (filled / required) * 100) : 0;
  const isComplete = rewardAvailable || filled >= required;

  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(qrValue, {
      width: 512, margin: 1, errorCorrectionLevel: "M",
      color: { dark: "#111111", light: "#ffffff" },
    }).then(setQrDataUrl).catch(() => {});
  }, [qrValue]);

  const status = useMemo(() => {
    if (isComplete) return { label: "Recompensa disponível", tone: "bg-emerald-400 text-emerald-950" };
    if (filled > 0) return { label: "Ativa", tone: "bg-white/25 text-white" };
    return { label: "Nova", tone: "bg-white/20 text-white" };
  }, [isComplete, filled]);

  const cells = Array.from({ length: required }, (_, i) => i < filled);

  return (
    <article
      className="relative w-full overflow-hidden rounded-[28px] text-white shadow-[0_30px_60px_-25px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
      style={{ background: `linear-gradient(160deg, ${primary} 0%, ${accent} 130%)` }}
    >
      {/* Decorative sheen */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-black/20 blur-3xl" />

      {/* HEADER */}
      <header className="relative px-6 pt-6 pb-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {logoUrl ? (
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/95 p-1.5 ring-2 ring-white/40 shadow-lg">
                <img src={logoUrl} alt="" className="h-full w-full object-contain" />
              </div>
            ) : (
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/20 backdrop-blur ring-2 ring-white/30 font-display font-bold">
                {initialsOf(brandName)}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] opacity-80">Cartão fidelidade</div>
              <div className="truncate font-display text-lg font-bold leading-tight">{brandName}</div>
              <div className="truncate text-xs opacity-85">{campaignName}</div>
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${status.tone}`}>
            {status.label}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/20 backdrop-blur text-sm font-display font-bold ring-1 ring-white/30">
            {initialsOf(customerName)}
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest opacity-75">Titular</div>
            <div className="truncate text-sm font-semibold">{customerName}</div>
          </div>
        </div>
      </header>

      {/* Perforation */}
      <div aria-hidden className="relative">
        <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-background" />
        <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-background" />
        <div className="mx-8 border-t border-dashed border-white/40" />
      </div>

      {/* QR PANEL */}
      <section className="relative px-6 py-6">
        <div className="mx-auto max-w-xs rounded-3xl bg-white p-4 text-neutral-900 shadow-xl">
          <div className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Apresente ao atendente
          </div>
          <div className="mt-2 grid place-items-center">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR do cartão" className="h-56 w-56 rounded-xl" />
            ) : (
              <div className="h-56 w-56 rounded-xl bg-neutral-100 animate-pulse" />
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-600">
            <span className="font-mono font-semibold text-neutral-800">#{customerCode}</span>
            {lastStampAt && (
              <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{formatDate(lastStampAt)}</span>
            )}
          </div>
          {expiresAt && (
            <div className="mt-1 flex items-center justify-center gap-1 text-[11px] text-neutral-500">
              <CalendarClock className="h-3 w-3" /> Válido até {formatDate(expiresAt)}
            </div>
          )}
        </div>
      </section>

      {/* STAMPS */}
      <section className="relative px-6 pb-5">
        <div className="rounded-3xl bg-white/12 backdrop-blur-sm p-4 ring-1 ring-white/15">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-widest opacity-85">Progresso</span>
            <span className="font-mono font-semibold">{filled} / {required}</span>
          </div>

          <div className={`mt-3 grid gap-1.5 ${required > 10 ? "grid-cols-10" : required > 6 ? "grid-cols-5" : "grid-cols-6"}`}>
            {cells.map((isFilled, i) => (
              <div
                key={i}
                className={`aspect-square grid place-items-center rounded-xl transition ${
                  isFilled
                    ? "bg-white text-neutral-900 shadow-md scale-100"
                    : "bg-white/10 text-white/45 ring-1 ring-inset ring-white/20"
                }`}
              >
                <Icon className={`${required > 10 ? "h-3.5 w-3.5" : "h-4 w-4"}`} />
              </div>
            ))}
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-white transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-3 text-center text-sm">
            {isComplete ? (
              <div className="inline-flex items-center gap-1.5 font-semibold">
                <PartyPopper className="h-4 w-4" /> Parabéns! Sua recompensa está disponível.
              </div>
            ) : (
              <span className="opacity-90">
                Faltam apenas <strong>{missing}</strong> carimbo{missing !== 1 ? "s" : ""} para ganhar <strong>{reward}</strong>.
              </span>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER META */}
      <footer className="relative border-t border-white/15 bg-black/15 px-6 py-4">
        {isComplete && (
          <div className="mb-3 flex items-center gap-2 rounded-2xl bg-emerald-400/95 px-3 py-2 text-emerald-950 shadow-md">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <div className="min-w-0 text-xs font-semibold leading-tight">
              Mostre este cartão ao atendente para resgatar <strong className="truncate">{reward}</strong>.
            </div>
          </div>
        )}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
          <MetaItem label="Recompensa" value={reward} icon={<Gift className="h-3 w-3" />} />
          <MetaItem label="Faltam" value={isComplete ? "0" : `${missing}`} />
          <MetaItem label="Última visita" value={lastStampAt ? formatDate(lastStampAt) : "—"} />
          <MetaItem label="Campanha" value={campaignName} />
          {cardNumber && <MetaItem label="Nº do cartão" value={cardNumber} mono />}
          {expiresAt && <MetaItem label="Expira em" value={formatDate(expiresAt)} />}
        </dl>
      </footer>
    </article>
  );
}

function MetaItem({ label, value, icon, mono }: { label: string; value: string; icon?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 uppercase tracking-widest opacity-70">{icon}{label}</dt>
      <dd className={`mt-0.5 truncate font-semibold ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
