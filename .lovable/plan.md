
# Fidelize — SaaS de Cartão Fidelidade Digital (Fase 1)

Sistema completo e funcional, multi-tenant, com Lovable Cloud (Postgres + Auth + Storage + RLS). Textos em pt-BR, moeda R$, telefones com DDD.

## Identidade visual

- **Nome:** Fidelize
- **Tagline:** "Transforme visitantes em clientes fiéis."
- **Paleta:** violeta profundo `#5B21B6` (primário), coral `#F97066` (accent/recompensa), fundo off-white `#FAFAF9`, texto grafite `#0F172A`. Suporta tema claro/escuro.
- **Tipografia:** "Plus Jakarta Sans" (títulos) + "Inter" (corpo), via link no `__root.tsx`.
- **Estilo:** cantos arredondados generosos, sombras suaves, mockups de celular, ilustrações leves em SVG, animações discretas com Motion.

Todas as cores/gradientes/sombras vão em `src/styles.css` como tokens semânticos.

## Arquitetura

- **Frontend:** TanStack Start + React 19 + TS + Tailwind v4 + shadcn.
- **Backend:** Lovable Cloud (Supabase). Auth por e-mail/senha + Google (broker Lovable). RLS em todas as tabelas multi-tenant. Storage para logos/capas.
- **Server functions** (`createServerFn`) para operações sensíveis: adicionar/remover carimbo, resgatar recompensa, gerar tokens, auditoria. Cliente final autentica anonimamente com sessão vinculada a `customer_id` (via Supabase anon + link mágico por telefone/e-mail, sem senha).
- **Multi-tenant:** cada tabela relacionada leva `establishment_id`; policies RLS filtram por membership do usuário; helper `has_establishment_role(uid, est_id, role)` security definer.

## Modelo de dados (Fase 1)

- `profiles` (usuário → nome, avatar)
- `establishments` (empresa: slug único, nome, descrição, endereço, contato, cores, logo_url, cover_url, tema, whatsapp, instagram, horario)
- `establishment_members` (user_id, establishment_id, role: owner/manager/staff) + enum `app_role`
- `campaigns` (establishment_id, nome, tipo=stamps|points, stamps_required, reward_title, reward_description, rules, stamp_validity_days, reward_validity_days, icon, active)
- `customers` (establishment_id, name, phone, email, birthdate, code único, created_at) — UNIQUE(establishment_id, phone)
- `loyalty_cards` (customer_id, campaign_id, stamps, cycle_number, created_at) — 1 por (customer, campaign)
- `stamps` (card_id, added_by_user_id, added_at, note, ip) — imutável
- `rewards` (card_id, campaign_id, unlocked_at, redeemed_at, redeemed_by_user_id) 
- `consents` (customer_id, terms_version, marketing_opt_in, accepted_at, ip)
- `audit_logs` (establishment_id, user_id, action, entity, entity_id, metadata, created_at) — só INSERT via server fn, SELECT restrito a owner
- `plans`, `subscriptions`, `plan_limits` — estrutura pronta, valores default gratuito/inicial/pro. (Cobrança real fica para fase 2.)

Todas com `GRANT` explícito, RLS ligada e policies escopadas por membership. Função `has_role`/`has_establishment_role` security definer. Trigger `handle_new_user` cria profile.

## Fluxos-chave

1. **Cadastro lojista** → onboarding em 5 passos (empresa → visual → campanha → recompensa → QR).
2. **Cartão do cliente** — página pública `/l/:slug`; cliente informa telefone+nome; cria/recupera `customer` + `loyalty_card`; recebe cartão com QR individual (token assinado com HMAC + timestamp).
3. **Adicionar carimbo** — funcionário logado escaneia QR do cliente (ou busca por telefone/código) → server fn valida token, checa rate-limit (mesmo QR em <10s bloqueado), insere stamp, registra auditoria, retorna novo estado. Se completar → cria `reward` unlocked.
4. **Resgate** — funcionário confirma; server fn marca `redeemed_at`, inicia novo ciclo do cartão, registra auditoria.
5. **Undo** — janela de 60s para desfazer último stamp (server fn deleta + audita).

## Segurança

- RLS estrita por `establishment_id`.
- QR do cliente = token HMAC-SHA256 (payload: card_id + issued_at) validado no servidor, expira em 5min, reemitido no client a cada 4min.
- Server fns sensíveis usam `requireSupabaseAuth` + verificação de membership via RPC `has_establishment_role`.
- `audit_logs`: INSERT-only via server fn com service role; SELECT via RLS só para `owner`.
- Rate-limit por card_id no server (memória + tabela de nonces recentes).
- Client final NUNCA pode inserir stamps (nenhuma policy INSERT para role anon/customer).
- Validação Zod em todos os inputs (client + server).

## Telas (Fase 1)

Landing (`/`), Preços (`/precos`), FAQ, Auth (`/auth` — login/cadastro/reset), Onboarding (`/onboarding`), Dashboard lojista (`/app`), Campanhas (`/app/campanhas`, editor + preview em tempo real do cartão), Clientes (`/app/clientes` lista + perfil), Scan/Carimbar (`/app/carimbar` — leitor QR + busca), Funcionários (`/app/equipe`), Relatórios (`/app/relatorios`), Configurações (`/app/config`), QR Codes/materiais (`/app/qrcodes`).

Cliente final: página pública `/l/:slug`, cadastro `/l/:slug/entrar`, cartão `/c/:cardId` (QR próprio, histórico, regras).

Legais: `/termos`, `/privacidade`. Erros: `/404`, `/bloqueado`.

Painel admin geral e billing real ficam para Fase 2 (estrutura de dados já pronta).

## Bibliotecas extras

- `qrcode` (gerar QR SVG/PNG)
- `html5-qrcode` ou `@zxing/browser` (leitor no navegador)
- `motion` (animações de conquista)
- `recharts` (gráficos do dashboard)
- `zod`, `react-hook-form`

## Dados de demonstração

Migração de seed cria empresa "Café do Centro" com campanha "Café Premiado" (10 carimbos → 1 café grátis), 30 clientes fictícios, ~150 carimbos e 8 recompensas resgatadas para popular gráficos. Criada só se a tabela estiver vazia.

## Ordem de execução

1. Ativar Lovable Cloud + migração inicial (schema, RLS, funções, seed).
2. Design system (`styles.css`, tokens, fonts, tema).
3. Landing + páginas legais + preços.
4. Auth + onboarding.
5. Dashboard, campanhas + editor de cartão com preview.
6. Clientes + página pública `/l/:slug` + cartão do cliente `/c/:cardId`.
7. Scan/carimbo/resgate (server fns + leitor QR + auditoria).
8. Funcionários + relatórios básicos + configurações.
9. Materiais de QR (download PNG/SVG/PDF).
10. Testes de fluxo ponta-a-ponta.

Ao final você terá um SaaS funcional de verdade, pronto para expandir com painel admin, cobrança e integrações WhatsApp/e-mail na Fase 2.
