import { createFileRoute, Link } from "@tanstack/react-router";
import { HelpCircle, QrCode, Gift, Stamp, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/carteira/ajuda")({ component: WalletHelp });

function WalletHelp() {
  const topics = [
    { icon: QrCode, title: "Como apresentar meu QR?", text: "Abra o cartão do estabelecimento e apresente o QR de identidade ao atendente para receber carimbos." },
    { icon: Stamp, title: "Como ganhar carimbos?", text: "O estabelecimento registra o carimbo após uma compra elegível, conforme as regras exibidas no cartão." },
    { icon: Gift, title: "Como resgatar uma recompensa?", text: "Em Recompensas, gere o QR temporário da recompensa pronta e apresente-o ao funcionário." },
    { icon: ShieldCheck, title: "Privacidade e conta", text: "Use o Perfil para revisar seus dados, preferências de notificações e opções de privacidade." },
  ];
  return <div className="space-y-5"><header><h1 className="flex items-center gap-2 font-display text-2xl font-bold"><HelpCircle className="h-6 w-6 text-primary" /> Ajuda</h1><p className="text-sm text-muted-foreground">Orientações para usar sua carteira Fidelize.</p></header><div className="grid gap-3 sm:grid-cols-2">{topics.map((topic) => <article key={topic.title} className="rounded-2xl border bg-card/50 p-4"><topic.icon className="mb-3 h-5 w-5 text-primary" /><h2 className="font-semibold">{topic.title}</h2><p className="mt-1 text-sm text-muted-foreground">{topic.text}</p></article>)}</div><Link to="/ajuda" className="inline-flex rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-muted">Abrir Central de Ajuda</Link></div>;
}
