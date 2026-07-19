import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Fidelize" },
      { name: "description", content: "Como a Fidelize coleta, usa e protege dados pessoais em conformidade com a LGPD." },
      { property: "og:title", content: "Política de Privacidade — Fidelize" },
      { property: "og:description", content: "Compromisso da Fidelize com a Lei Geral de Proteção de Dados (LGPD)." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Legal</div>
        <h1 className="font-display text-4xl font-bold mt-1">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground mt-2">Última atualização: 19 de julho de 2026</p>
      </div>

      <article className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-[15px] leading-relaxed">
        <section>
          <h2 className="font-display text-xl font-semibold">1. Quem somos</h2>
          <p>
            A <strong>Fidelize</strong> é uma plataforma SaaS de cartão fidelidade digital operada por sua equipe de desenvolvimento.
            Atuamos como <strong>controladora</strong> dos dados de usuários da plataforma (donos de estabelecimento, administradores e funcionários)
            e como <strong>operadora</strong> dos dados de clientes finais coletados pelos estabelecimentos que usam nosso sistema.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">2. Dados que coletamos</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Cadastro:</strong> nome, e-mail, telefone/WhatsApp, senha (criptografada).</li>
            <li><strong>Empresa:</strong> razão social, CNPJ, endereço, logotipo, dados de contato.</li>
            <li><strong>Clientes finais:</strong> nome, telefone, e-mail (opcional), data de nascimento (opcional), histórico de carimbos e recompensas.</li>
            <li><strong>Pagamentos:</strong> dados mínimos de assinatura via Mercado Pago (nunca armazenamos dados de cartão).</li>
            <li><strong>Uso:</strong> logs de acesso, IP, dispositivo, ações realizadas para fins de segurança e auditoria.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">3. Base legal e finalidade (LGPD art. 7º)</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Execução de contrato:</strong> para prestar o serviço contratado.</li>
            <li><strong>Legítimo interesse:</strong> segurança, prevenção a fraudes, melhoria do produto.</li>
            <li><strong>Consentimento:</strong> para envio de comunicações de marketing, opt-in explícito do cliente final.</li>
            <li><strong>Obrigação legal:</strong> retenção de dados fiscais e de faturamento pelo prazo exigido em lei.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">4. Compartilhamento</h2>
          <p>Só compartilhamos dados com operadores essenciais à operação:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Infraestrutura:</strong> Supabase (banco e autenticação), Cloudflare (rede).</li>
            <li><strong>Pagamentos:</strong> Mercado Pago (processamento de assinaturas).</li>
            <li><strong>E-mail transacional:</strong> Resend (envio de notificações).</li>
            <li><strong>Autoridades:</strong> apenas mediante ordem judicial ou requisição legal válida.</li>
          </ul>
          <p>Não vendemos dados pessoais. Não os usamos para treinar modelos de IA de terceiros.</p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">5. Seus direitos (LGPD art. 18)</h2>
          <p>Você pode, a qualquer momento e gratuitamente:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Confirmar a existência de tratamento;</li>
            <li>Acessar e exportar seus dados;</li>
            <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
            <li>Solicitar anonimização, bloqueio ou <strong>eliminação</strong>;</li>
            <li>Revogar consentimento (opt-out de marketing);</li>
            <li>Solicitar portabilidade a outro fornecedor.</li>
          </ul>
          <p className="mt-3">
            Usuários com conta ativa podem executar exportação e exclusão diretamente em{" "}
            <Link to="/lgpd" className="underline text-primary font-medium">Meus Dados</Link>. Clientes finais devem
            solicitar através do estabelecimento onde possuem cartão fidelidade.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">6. Retenção</h2>
          <p>
            Mantemos dados enquanto sua conta estiver ativa. Após exclusão, dados pessoais são removidos em até 30 dias, exceto quando
            houver obrigação legal de retenção (ex.: registros fiscais por 5 anos — art. 195, §5º, CTN).
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">7. Segurança</h2>
          <p>
            Aplicamos criptografia em trânsito (TLS 1.2+) e em repouso, controles de acesso por papel (RBAC), Row-Level Security no
            banco de dados, logs de auditoria e revisão contínua de vulnerabilidades.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">8. Cookies</h2>
          <p>
            Usamos cookies essenciais para sessão e preferências. Não utilizamos cookies de publicidade de terceiros. Cookies analíticos
            (uso agregado do produto) podem ser desativados no seu navegador.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">9. Encarregado (DPO)</h2>
          <p>
            Contato do Encarregado pelo Tratamento de Dados Pessoais: <strong>dpo@fidelize.app</strong>. Respondemos em até 15 dias úteis
            (LGPD art. 19).
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">10. Alterações</h2>
          <p>
            Podemos atualizar esta política. Alterações materiais serão comunicadas por e-mail e/ou aviso na plataforma com
            antecedência mínima de 15 dias.
          </p>
        </section>
      </article>

      <div className="mt-10 text-sm text-muted-foreground border-t pt-6">
        Veja também nossos <Link to="/termos" className="underline">Termos de Uso</Link>.
      </div>
    </main>
  );
}
