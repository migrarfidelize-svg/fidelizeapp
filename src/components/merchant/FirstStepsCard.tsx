import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Circle, Rocket, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Step = {
  key: string;
  label: string;
  hint: string;
  to: string;
  done: boolean;
  /** Passos sem sinal automático podem ser marcados manualmente. */
  manual?: boolean;
};

const STORAGE_KEY = "fidelize:first-steps:v1";

export function FirstStepsCard({
  establishmentId,
  hasCampaign,
  customersCount,
  stampsCount,
  teamCount,
}: {
  establishmentId: string;
  hasCampaign: boolean;
  customersCount: number;
  stampsCount: number;
  teamCount: number;
}) {
  const key = `${STORAGE_KEY}:${establishmentId}`;
  const [manualDone, setManualDone] = useState<string[]>([]);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as { manual?: string[]; hidden?: boolean };
        setManualDone(parsed.manual ?? []);
        setHidden(!!parsed.hidden);
      }
    } catch { /* noop */ }
  }, [key]);

  function persist(next: { manual?: string[]; hidden?: boolean }) {
    const payload = { manual: next.manual ?? manualDone, hidden: next.hidden ?? hidden };
    try { localStorage.setItem(key, JSON.stringify(payload)); } catch { /* noop */ }
  }

  const steps: Step[] = [
    {
      key: "campaign",
      label: "Configurar seu cartão fidelidade",
      hint: "Defina carimbos, recompensa e visual",
      to: "/app/campanhas",
      done: hasCampaign,
    },
    {
      key: "qr",
      label: "Imprimir seu QR Code",
      hint: "Material pronto para balcão e mesa",
      to: "/app/qr",
      done: manualDone.includes("qr"),
      manual: true,
    },
    {
      key: "customer",
      label: "Cadastrar o primeiro cliente",
      hint: "Pela busca ou lendo o QR do cliente",
      to: "/app/carimbar",
      done: customersCount > 0,
    },
    {
      key: "stamp",
      label: "Dar o primeiro carimbo",
      hint: "O coração da operação do dia a dia",
      to: "/app/carimbar",
      done: stampsCount > 0,
    },
    {
      key: "team",
      label: "Convidar sua equipe",
      hint: "Atendentes com permissões próprias",
      to: "/app/equipe",
      done: teamCount > 1,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  if (hidden || doneCount === steps.length) return null;

  return (
    <div className="dash-card dash-card-accent relative p-5 md:p-6">
      <button
        type="button"
        onClick={() => { setHidden(true); persist({ hidden: true }); }}
        aria-label="Ocultar primeiros passos"
        className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="card-icon card-icon-accent shrink-0" aria-hidden><Rocket /></span>
          <div className="min-w-0">
            <h3 className="sec-title truncate text-lg">Primeiros passos</h3>
            <p className="text-sm text-muted-foreground">
              {doneCount} de {steps.length} concluídos — coloque seu programa no ar.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="mt-4 space-y-2">
        {steps.map((s) => (
          <li
            key={s.key}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/60 bg-card/40 p-3"
          >
            {s.manual && !s.done ? (
              <button
                type="button"
                aria-label={`Marcar "${s.label}" como concluído`}
                onClick={() => {
                  const next = [...manualDone, s.key];
                  setManualDone(next);
                  persist({ manual: next });
                }}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-primary/40 text-muted-foreground hover:text-primary"
              >
                <Circle className="h-3.5 w-3.5" />
              </button>
            ) : (
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                  s.done ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
                }`}
                aria-hidden
              >
                {s.done ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
              </span>
            )}

            <div className="min-w-0">
              <div className={`truncate text-sm font-medium ${s.done ? "text-muted-foreground line-through" : ""}`}>
                {s.label}
              </div>
              <div className="truncate text-xs text-muted-foreground">{s.hint}</div>
            </div>

            <Button asChild size="sm" variant={s.done ? "ghost" : "outline"} className="shrink-0">
              <Link to={s.to}>
                {s.done ? "Ver" : "Fazer"}
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
