import { createFileRoute, Link } from "@tanstack/react-router";
import {
  HelpCircle,
  QrCode,
  Stamp,
  Gift,
  KeyRound,
  MessageCircle,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/carteira/ajuda")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ajuda — Carteira Fidelize" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WalletHelp,
});

function WalletHelp() {
  const topics = [
    {
      icon: QrCode,
      title: "Como funciona o Meu QR?",
      text: "O Meu QR identifica você no estabelecimento. Apresente-o no atendimento quando for solicitado. Ele não é o mesmo QR usado para resgatar uma recompensa.",
    },
    {
      icon: Stamp,
      title: "Como recebo carimbos?",
      text: "Os carimbos são adicionados pelo estabelecimento participante conforme as regras da campanha ativa. A quantidade aparece automaticamente no seu cartão.",
    },
    {
      icon: Gift,
      title: "Como funcionam as recompensas?",
      text: "Quando você atingir a quantidade necessária de carimbos, a recompensa ficará disponível na área Recompensas. O resgate deve ser validado pelo estabelecimento.",
    },
    {
      icon: KeyRound,
      title: "Problemas para acessar minha conta",
      text: "Confira seu WhatsApp e tente novamente o código de acesso. Você também pode criar ou alterar uma senha na área de Configurações da carteira.",
    },
  ];

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3 pt-2">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <HelpCircle className="h-6 w-6" />
        </div>

        <div>
          <h1 className="font-display text-xl font-bold">Central de ajuda</h1>
          <p className="text-sm text-muted-foreground">
            Tire suas dúvidas sobre sua Carteira Fidelize.
          </p>
        </div>
      </header>

      <div className="grid gap-3">
        {topics.map(({ icon: Icon, title, text }) => (
          <section
            key={title}
            className="rounded-3xl border border-border/60 bg-card/40 p-5"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>

              <div>
                <h2 className="font-display text-sm font-bold">{title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {text}
                </p>
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="rounded-3xl border border-primary/30 bg-primary/5 p-5">
        <div className="flex items-start gap-3">
          <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />

          <div className="min-w-0 flex-1">
            <h2 className="font-display text-sm font-bold">
              Ainda precisa de ajuda?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Consulte suas mensagens ou revise os dados da sua conta.
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link
                to="/carteira/mensagens"
                className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold transition-colors hover:border-primary/50"
              >
                Mensagens
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>

              <Link
                to="/carteira/perfil"
                className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold transition-colors hover:border-primary/50"
              >
                Minha conta
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}