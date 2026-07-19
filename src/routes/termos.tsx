import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Fidelize" },
      { name: "description", content: "Termos e condições de uso da plataforma Fidelize." },
      { property: "og:title", content: "Termos de Uso — Fidelize" },
      { property: "og:description", content: "Direitos e deveres no uso da plataforma Fidelize." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Legal</div>
        <h1 className="font-display text-4xl font-bold mt-1">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground mt-2">Última atualização: 19 de julho de 2026</p>
      </div>

      <article className="space-y-6 text-[15px] leading-relaxed">
        <section>
          <h2 className="font-display text-xl font-semibold">1. Aceitação</h2>
          <p>
            Ao criar uma conta ou usar a plataforma <strong>Fidelize</strong>, você declara ter lido, entendido e concordado com estes
            Termos e com a <Link to="/privacidade" className="underline text-primary">Política de Privacidade</Link>.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">2. Objeto do serviço</h2>
          <p>
            A Fidelize disponibiliza uma plataforma SaaS de cartão fidelidade digital, atendimento ao cliente e gestão de campanhas
            promocionais. O acesso é feito mediante assinatura mensal ou anual, conforme o plano contratado.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">3. Cadastro e conta</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Você é responsável pela veracidade dos dados fornecidos e pela guarda da sua senha.</li>
            <li>É proibido criar conta em nome de terceiros sem autorização.</li>
            <li>Contas inativas por mais de 12 meses podem ser suspensas.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">4. Planos, pagamento e reembolso</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Preços vigentes estão publicados na página <Link to="/precos" className="underline">Preços</Link>.</li>
            <li>Cobranças recorrentes são processadas via Mercado Pago (PIX, cartão ou boleto).</li>
            <li>Direito de arrependimento: 7 dias após a primeira contratação, com reembolso integral (CDC art. 49).</li>
            <li>Falhas de pagamento colocam a assinatura em <em>inadimplência</em>; após 10 dias, o acesso é bloqueado até regularização.</li>
            <li>Cancelamento pode ser feito a qualquer momento — o serviço permanece ativo até o fim do período pago.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">5. Uso aceitável</h2>
          <p>É proibido:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Enviar spam, phishing ou conteúdo enganoso aos clientes finais;</li>
            <li>Coletar dados sem consentimento válido do titular;</li>
            <li>Fazer engenharia reversa, revender ou sublicenciar a plataforma sem autorização;</li>
            <li>Uso para atividades ilícitas, discriminatórias ou que violem direitos de terceiros.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">6. Propriedade dos dados</h2>
          <p>
            Os dados de clientes finais coletados por você permanecem <strong>sob sua titularidade</strong>. A Fidelize atua como operadora
            e permite exportação a qualquer momento. O software, marca e design da plataforma são de propriedade da Fidelize.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">7. Disponibilidade</h2>
          <p>
            Buscamos SLA de 99,5% de disponibilidade mensal. Janelas de manutenção programada são comunicadas com antecedência.
            Não nos responsabilizamos por indisponibilidades causadas por terceiros (provedores de internet, gateways de pagamento).
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">8. Limitação de responsabilidade</h2>
          <p>
            Na máxima extensão permitida em lei, a responsabilidade da Fidelize por eventuais danos limita-se ao valor efetivamente
            pago pelo assinante nos 12 meses anteriores ao evento que originou a demanda.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">9. Rescisão</h2>
          <p>
            Podemos suspender ou encerrar contas que violem estes Termos, mediante notificação prévia sempre que possível. Você pode
            encerrar sua conta a qualquer momento em <Link to="/lgpd" className="underline text-primary">Meus Dados</Link>.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">10. Foro</h2>
          <p>
            Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca do assinante para
            dirimir controvérsias, salvo disposição legal em contrário.
          </p>
        </section>
      </article>

      <div className="mt-10 text-sm text-muted-foreground border-t pt-6">
        Dúvidas: <strong>contato@fidelize.app</strong> · Encarregado (LGPD): <strong>dpo@fidelize.app</strong>
      </div>
    </main>
  );
}
