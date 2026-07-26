import { ShieldCheck, WifiOff, Smartphone, Headphones, CreditCard, XCircle } from "lucide-react";
import { useInView } from "./use-in-view";

const ITEMS = [
  { icon: ShieldCheck, title: "LGPD por padrão", desc: "Os dados dos seus clientes são seus. Exporte quando quiser." },
  { icon: Smartphone, title: "Zero download", desc: "O cliente usa pelo navegador. Sem app store, sem atrito." },
  { icon: WifiOff, title: "Funciona offline", desc: "Carimbou sem sinal? A ação entra na fila e sincroniza sozinha." },
  { icon: Headphones, title: "Suporte com ticket", desc: "Central de ajuda com artigos e atendimento acompanhado." },
  { icon: CreditCard, title: "Pix e cartão", desc: "Cobrança recorrente com nota e histórico no painel." },
  { icon: XCircle, title: "Cancele quando quiser", desc: "Sem fidelidade forçada nem multa de saída." },
];

export function TrustStrip() {
  const { ref, inView } = useInView<HTMLElement>(0.15);

  return (
    <section ref={ref} className="border-y bg-card/25 py-14 md:py-16">
      <div className="container mx-auto px-4">
        <h2 className="text-center font-display text-2xl font-bold md:text-3xl">
          Sem letra miúda, <span className="text-primary">sem surpresa</span>
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map((it, i) => (
            <div
              key={it.title}
              className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/50 p-4 transition-all duration-500"
              style={{
                transitionDelay: `${i * 80}ms`,
                opacity: inView ? 1 : 0,
                transform: inView ? "translateY(0)" : "translateY(10px)",
              }}
            >
              <span className="card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <it.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold">{it.title}</p>
                <p className="text-sm text-muted-foreground">{it.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
