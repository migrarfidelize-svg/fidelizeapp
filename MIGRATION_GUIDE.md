# MIGRATION_GUIDE.md — Migração do Fidelize para um projeto Supabase próprio

> Cenário escolhido: **(1) Sair do Supabase gerenciado pelo Lovable Cloud e mover 100% do sistema (schema + dados + Auth users + Storage) para um projeto Supabase novo, sob sua conta e billing.**
>
> Este guia é derivado inteiramente do código atual do repositório (rotas TanStack Start em `src/routes/`, server functions em `src/lib/*.functions.ts`, migrations em `supabase/migrations/`, integrações em `src/integrations/supabase/`). Não há suposições — onde faltar informação, está marcado como **⚠ Verificar**.

---

## 1. Visão geral

### 1.1 O que é o Fidelize hoje
Fidelize é um SaaS multi-tenant de **cartão fidelidade digital** com:

- **Onboarding de lojista** (`/onboarding`) → cria `establishment` + `membership owner`.
- **Painel do lojista** (`/app/*`): dashboard, carimbar cliente (busca + QR scanner), base de clientes (CRM + import CSV + auditoria), campanhas, QR codes, retenção, notificações push, planos, pagamentos, suporte.
- **Voucher do cliente final** (`/c/:token`) com Realtime, PWA instalável, offline indicator, Web Push opcional.
- **Painel do Super Admin** (`/admin/*`): empresas, financeiro (MRR/ARR), assinaturas, planos, pagamentos, auditoria, alertas, notificações push, suporte/helpdesk, base de conhecimento (`/ajuda`), e-mails (Resend), fila de e-mails, equipe, configurações.
- **Suporte**: portal do cliente (`/suporte/*`) + área do agente (`/admin/suporte`) com attachments (Storage), CSAT, KB.
- **Automações**: `pg_cron` para aniversário, reengajamento, dunning de assinaturas past_due, processamento da fila de e-mails.
- **Integrações externas**: Resend (e-mail transacional), Mercado Pago (pagamentos + webhook HMAC), Web Push (VAPID), Sentry.

### 1.2 Stack real (não há intermediário)
Este projeto **já roda em Supabase**. O "Lovable Cloud" é apenas um Supabase gerenciado. Portanto migrar significa:

- Provisionar **um novo projeto Supabase** (seu, na `supabase.com`).
- Replicar **schema, RLS, funções, triggers, extensions, cron jobs, storage buckets, edge behavior** que hoje vivem no projeto gerenciado.
- Copiar **dados** (todas as tabelas em `public`) e **usuários do Auth** (`auth.users`).
- Trocar as **variáveis de ambiente** (URL, publishable key, service role, VAPID, Resend, Mercado Pago).
- **Republicar** o front (TanStack Start em Cloudflare Workers ou provedor equivalente) apontando para o novo Supabase.

### 1.3 O que **não** muda
- Nenhum código de aplicação (React/TanStack) precisa ser reescrito.
- Todas as tabelas, políticas, funções e triggers já estão em `supabase/migrations/` — são idempotentes e podem ser reaplicadas em um projeto vazio via `supabase db push`.
- Os clientes JS (`@supabase/supabase-js`) continuam idênticos. Só mudam credenciais.

### 1.4 O que muda
- **URL do projeto** (`SUPABASE_URL`) e **keys** (`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- **Providers de Auth** (Email, Google, etc.) precisam ser reconfigurados no dashboard do novo projeto.
- **Storage buckets** (`logos`, `ticket-attachments`) precisam ser recriados com as mesmas policies.
- **`pg_cron` jobs** precisam ser recriados (as migrations que os criam devem rodar; se você usa a UI, criar manualmente).
- **Redirect URLs** de OAuth precisam apontar para o novo domínio.
- **Webhook do Mercado Pago** precisa ser reconfigurado com a nova URL.

---

## 2. Inventário técnico (baseado no código atual)

### 2.1 Frontend
- **Framework**: TanStack Start v1 (React 19, Vite 7). Runtime alvo: Cloudflare Workers (workerd + `nodejs_compat`).
- **Roteador**: `src/router.tsx`, árvore auto-gerada em `src/routeTree.gen.ts`.
- **Estilo**: Tailwind v4 via `src/styles.css`, shadcn/ui.
- **PWA**: `public/manifest.webmanifest`, `public/sw-push.js`, `src/lib/pwa-register.ts`. Cache offline restrito a `/c/*` (voucher).
- **Estado servidor**: TanStack Query 5; QueryClient em `src/router.tsx`.

### 2.2 Integração Supabase (arquivos-chave — **não editar em produção**)
| Arquivo | Propósito |
|---|---|
| `src/integrations/supabase/client.ts` | Cliente browser (publishable key). |
| `src/integrations/supabase/client.server.ts` | Cliente admin (service role). Usado só via `await import` dentro de handlers. |
| `src/integrations/supabase/auth-middleware.ts` | `requireSupabaseAuth` — valida bearer em server functions. |
| `src/integrations/supabase/auth-attacher.ts` | Anexa Bearer token em chamadas de server functions. Registrado em `src/start.ts`. |
| `src/integrations/supabase/types.ts` | Types gerados do schema (regeneráveis). |

### 2.3 Server functions (`createServerFn`) — todas em `src/lib/*.functions.ts`
- `admin.functions.ts` — status admin, ações de super admin.
- `auth-confirm.functions.ts` — confirma e-mail via Admin API (workaround "Email not confirmed").
- `email.functions.ts` — Resend, recuperação de senha, envio transacional, fila.
- `goals.functions.ts` — metas por estabelecimento.
- `help.functions.ts` — categorias/artigos da Central de Ajuda.
- `helpdesk.functions.ts` — tickets/mensagens/attachments do helpdesk.
- `lgpd.functions.ts` — data_requests, exportação/exclusão de dados.
- `loyalty.functions.ts` — **coração do sistema**: estabelecimentos, cartões, carimbos, clientes, campanhas, importação CSV, undo.
- `mercadopago.functions.ts` — criar preferência, checkout, consulta de status.
- `plans.functions.ts` — planos, features, upgrade/downgrade, `assertFeature`.
- `push.functions.ts` — subscribe, broadcast, logs de push.
- `retention.functions.ts` — segmentação, dispatches, eventos de tier.
- `settings.functions.ts` — perfil, segurança, notificações.
- `support.functions.ts` — tickets (support_tickets), mensagens, quick replies.
- `wallet.functions.ts` — geração `.pkpass` (Apple Wallet — atualmente pausado).

### 2.4 Server routes HTTP (`src/routes/api/public/*`)
Endpoints públicos (bypassam auth do site; validação de assinatura obrigatória no handler):
- `POST /api/public/webhooks/mercadopago` — webhook HMAC (`MERCADOPAGO_WEBHOOK_SECRET`).
- `POST /api/public/cron/birthday` — cron aniversário (chamado por `pg_cron` via `pg_net`).
- `POST /api/public/cron/reengagement` — cron reengajamento.
- `POST /api/public/hooks/process-email-queue` — dispatcher da fila Resend.
- `GET  /api/public/wallet/apple/:token` — download `.pkpass`.

### 2.5 Banco de dados (schema `public`)
Consolidado nas 22 migrations em `supabase/migrations/`. Tabelas (52):

**Núcleo multi-tenant**
- `establishments`, `establishment_members`, `establishment_settings`, `establishment_goals`, `profiles`, `app_roles`, `team_invites`

**Fidelidade**
- `customers`, `loyalty_cards`, `stamps`, `rewards`, `coupons`, `campaigns`

**Retenção**
- `retention_settings`, `retention_events`, `retention_dispatches`

**Notificações**
- `push_subscriptions`, `push_logs`, `notification_templates`

**Comunicação / E-mail**
- `email_templates`, `email_queue`, `email_logs`, `system_email_settings`

**Suporte / Helpdesk**
- `support_tickets`, `support_messages`, `support_status_history`, `support_quick_replies`
- `tickets`, `ticket_messages`, `ticket_quick_replies`, `helpdesk_members`
- `kb_categories`, `kb_articles`, `kb_feedback`
- `help_categories`, `help_articles`, `help_article_views`, `help_feedback`

**Financeiro / Planos**
- `plans`, `plan_features`, `subscriptions`, `subscription_events`
- `payments`, `payment_logs`, `payment_settings`, `payment_provider_credentials`

**Governança**
- `audit_logs`, `consents`, `data_requests`
- `api_keys`, `webhooks`, `webhook_deliveries`

### 2.6 Funções do Postgres (13 conhecidas — ver bloco `<db-functions>` no repositório)
- `tg_updated_at()`, `handle_new_user()`, `tg_ticket_defaults()`, `tg_ticket_first_response()`,
- `tg_support_message_after_insert()`, `tg_support_status_history()`, `tg_recompute_tier_after_stamp()`, `tg_establishment_subscription_events()`,
- `has_establishment_access()`, `has_establishment_role()`, `is_super_admin()`, `is_helpdesk_admin()`, `is_helpdesk_agent()`, `has_plan_feature()`, `get_establishment_plan()`, `compute_tier()`, `mark_past_due_subscriptions()`, `delete_my_account()`.

Todas usam `SECURITY DEFINER` + `SET search_path = public` quando aplicável, com `EXECUTE` revogado de `PUBLIC`/`anon` para as sensíveis (fix aplicado em migration).

### 2.7 Extensões Postgres em uso
- `pg_cron` — jobs periódicos (dunning, cron http).
- `pg_net` — HTTP calls do banco para os endpoints `/api/public/cron/*` e `/api/public/hooks/*`.
- `pgcrypto` / `gen_random_uuid()` — PKs.
- `uuid-ossp` — **⚠ Verificar** se ainda é necessário (algumas migrations podem referenciar).

### 2.8 Storage buckets
| Bucket | Público | Uso |
|---|---|---|
| `logos` | não | Logos de estabelecimentos, campanhas, uploads do cliente. Servido via signed URL. |
| `ticket-attachments` | não | Anexos de suporte (imagens/PDF). Signed URL curto. |

### 2.9 Auth
- Providers ativos: **Email/Password** (obrigatório), **Google OAuth** (via broker Lovable — precisará ser reconfigurado como provider nativo Supabase no novo projeto).
- Auto-confirm e-mail: **habilitado** (setting `auto_confirm_email = true`).
- Recovery URL de senha: `${PUBLIC_APP_URL}/auth/nova-senha`.
- Trigger `on_auth_user_created` chama `handle_new_user()` para popular `public.profiles`.
- Primeiro usuário promovido a `super_admin` via seed em `app_roles`.

### 2.10 Secrets em uso (`fetch_secrets` snapshot)
Configurados hoje: `LOVABLE_API_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`.

Referenciados no código mas ainda **não configurados em produção** (o próprio checklist do sistema aponta): `RESEND_API_KEY`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, opcionais: `APPLE_PASS_*`, `GOOGLE_WALLET_*`, `SENTRY_DSN`, `PUBLIC_APP_URL`.

### 2.11 Cron jobs esperados (via `pg_cron` + `pg_net`)
- **Dunning** — `mark_past_due_subscriptions()` diário.
- **Aniversário** — chamada HTTP para `/api/public/cron/birthday` diária.
- **Reengajamento** — HTTP para `/api/public/cron/reengagement` diária.
- **Fila de e-mails** — HTTP para `/api/public/hooks/process-email-queue` a cada 1–5 min.

**⚠ Verificar**: SQL exato de `cron.schedule(...)` está nas migrations `202607190408*` e `202607190558*`. Reaplicar na íntegra no novo projeto.

---

## 3. Passo-a-passo da migração

### Fase 0 — Preparação (sem tocar em nada)
1. Fazer **snapshot completo** do projeto atual: backup de código (git), export do schema e export dos dados.
2. Ter em mãos: conta na `supabase.com`, cartão para o plano desejado, domínio final da app (para OAuth redirect URLs).

### Fase 1 — Criar o novo projeto Supabase
1. `supabase.com` → New project → escolher região próxima do público (BR → `sa-east-1` São Paulo).
2. Anotar: `Project ref`, `Project URL`, `anon (publishable) key`, `service_role key`, `DB password`.
3. Instalar CLI localmente:
   ```bash
   npm i -g supabase
   supabase login
   supabase link --project-ref <NEW_REF>
   ```

### Fase 2 — Aplicar schema no projeto novo
As 22 migrations em `supabase/migrations/` já são a fonte de verdade.

```bash
supabase db push
```

Isso executa, em ordem, tudo que criou o schema atual: enums, tabelas, GRANTs, RLS, policies, funções, triggers, extensions, cron. Se algum `CREATE EXTENSION` faltar, adicionar em uma migration nova (`supabase migration new enable_extensions`) contendo:
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;
```
> `pg_cron` só pode ser criado no schema `extensions` no Supabase gerenciado — a UI do dashboard tem toggle dedicado. Ativar por lá antes do `db push` se der erro.

**Verificação**: rodar `supabase db lint` e comparar `supabase db diff` até dar vazio.

### Fase 3 — Reconfigurar Auth
1. Dashboard → Authentication → Providers:
   - Email: habilitar, ativar **auto-confirm** para preservar o comportamento atual.
   - Google: colar `Client ID` / `Client Secret` do Google Cloud Console; adicionar redirect: `https://<NEW_REF>.supabase.co/auth/v1/callback`.
2. Authentication → URL Configuration:
   - Site URL: `https://<seu-domínio>`
   - Redirect URLs: `https://<seu-domínio>/auth/nova-senha`, `https://<seu-domínio>/auth/callback`, e o preview URL se houver.
3. Authentication → Email templates: reaplicar templates customizados (recuperação, invite, confirm) — o código do app espera links que apontem para `/auth/nova-senha`.

### Fase 4 — Migrar dados
Dois caminhos, escolha um:

#### 4a — `pg_dump`/`pg_restore` (recomendado — cópia bit-a-bit)
```bash
# origem (projeto atual — pedir SUPABASE_DB_URL ao suporte Lovable)
pg_dump "$OLD_DB_URL" \
  --schema=public --schema=storage \
  --data-only --no-owner --no-privileges \
  --disable-triggers \
  -Fc -f fidelize.dump

# destino (novo projeto)
pg_restore --dbname="$NEW_DB_URL" --data-only --disable-triggers fidelize.dump
```
Notas:
- `--disable-triggers` evita que triggers de auditoria disparem durante import.
- Restaurar **depois** do `supabase db push` (schema já pronto).
- Sequências: rodar `SELECT setval(...)` para cada sequence caso necessário — o dump binário já cuida.

#### 4b — CSV por tabela (fallback quando não há acesso ao DB URL antigo)
Para cada tabela, usar Studio → Table Editor → Export CSV no antigo e Import CSV no novo. Ordem obrigatória (respeitar FKs): `profiles` → `app_roles` → `establishments` → `establishment_members` → `establishment_settings` → `plans` → `plan_features` → `subscriptions` → `customers` → `loyalty_cards` → `stamps` → `rewards` → `campaigns` → `coupons` → resto.

### Fase 5 — Migrar usuários do Auth (`auth.users`)
`auth.users` não sai no `pg_dump` padrão. Usar a **Auth Admin API**:

```ts
// script Node avulso (executar localmente com service role do projeto ANTIGO)
const old = createClient(OLD_URL, OLD_SERVICE_ROLE);
const nw  = createClient(NEW_URL, NEW_SERVICE_ROLE);

let page = 1;
while (true) {
  const { data } = await old.auth.admin.listUsers({ page, perPage: 200 });
  if (!data.users.length) break;
  for (const u of data.users) {
    await nw.auth.admin.createUser({
      id: u.id, // preserva o UUID → FKs continuam válidas
      email: u.email!,
      email_confirm: true,
      phone: u.phone ?? undefined,
      user_metadata: u.user_metadata,
      app_metadata: u.app_metadata,
    });
  }
  if (data.users.length < 200) break;
  page++;
}
```
**Limitação conhecida**: senhas hashadas (`encrypted_password`) **não** são expostas pela Admin API. Duas opções:
- (a) Forçar reset de senha para todos via `resetPasswordForEmail` em lote.
- (b) Pedir dump direto de `auth.users` ao suporte Lovable para preservar hashes bcrypt (compatíveis com GoTrue novo).

### Fase 6 — Migrar Storage buckets (`logos`, `ticket-attachments`)
1. Criar buckets no novo projeto com **mesmas** configurações (privados).
2. Copiar objetos:
   ```bash
   # baixar do antigo
   supabase storage --project-ref OLD_REF download --recursive ss:///logos ./_logos
   # enviar para o novo
   supabase storage --project-ref NEW_REF upload --recursive ./_logos ss:///logos
   ```
3. Reaplicar as **policies** dos buckets (as migrations em `supabase/migrations/` já contêm as policies de `storage.objects` para esses buckets).

### Fase 7 — Cron jobs
Se as migrations que criam `cron.schedule(...)` rodaram, os jobs já existem no novo projeto. Verificar:
```sql
select jobid, schedule, command from cron.job;
```
Se faltar algum, recriar apontando para o **novo** domínio da app (o URL dos endpoints `/api/public/cron/*` e `/api/public/hooks/*`).

### Fase 8 — Republicar o frontend
1. Atualizar `.env` (build-time do Vite):
   ```env
   VITE_SUPABASE_URL=https://<NEW_REF>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<new anon key>
   VITE_SUPABASE_PROJECT_ID=<NEW_REF>
   ```
2. Configurar secrets runtime (Cloudflare/Vercel/servidor de escolha):
   ```
   SUPABASE_URL=...
   SUPABASE_PUBLISHABLE_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   VAPID_PUBLIC_KEY=...  VAPID_PRIVATE_KEY=...  VAPID_SUBJECT=mailto:...
   RESEND_API_KEY=...
   MERCADOPAGO_ACCESS_TOKEN=...  MERCADOPAGO_WEBHOOK_SECRET=...
   PUBLIC_APP_URL=https://<seu-domínio>
   SENTRY_DSN=... (opcional)
   ```
3. `bun install && bun run build` — validar zero erros de tipo (types Supabase serão regenerados apontando pro novo projeto: `supabase gen types typescript --linked > src/integrations/supabase/types.ts`).
4. Deploy (Cloudflare Workers recomendado — o template já é workerd-ready).

### Fase 9 — Reconectar integrações externas
- **Mercado Pago** → dashboard → Webhooks → apontar para `https://<seu-domínio>/api/public/webhooks/mercadopago`.
- **Resend** → domain verified? Manter mesma sender identity.
- **Google OAuth** → adicionar novo redirect URI no Google Cloud Console.
- **Sentry** → novo DSN se quiser separar ambientes.

### Fase 10 — Smoke test (ponta-a-ponta)
Roteiro mínimo para validar migração:
1. Login com usuário existente (se senhas migradas) ou fluxo de reset.
2. Abrir dashboard `/app` → ver estabelecimento, dados de clientes.
3. Carimbar cliente (busca) → contador incrementa → voucher `/c/:token` atualiza em tempo real.
4. Abrir `/admin` como super admin → ver métricas MRR/ARR consistentes.
5. Disparar recuperação de senha → chega e-mail via Resend.
6. Fazer upgrade de plano de teste no sandbox Mercado Pago → webhook grava `payments` + `subscription_events`.
7. Enviar push broadcast → cliente com subscription recebe.
8. Abrir voucher offline → indicador aparece.

---

## 4. Riscos, inconsistências e pontos de atenção

- **Senhas Auth**: Admin API não expõe hashes. Sem dump direto, todos os usuários precisarão redefinir senha.
- **`SUPABASE_DB_URL`**: no Lovable Cloud, essa string está entre os secrets, mas o acesso direto ao Postgres pode estar restrito por firewall — pode ser necessário abrir chamado com o suporte Lovable para liberar `pg_dump` ou receber o dump pronto.
- **Realtime**: o voucher usa `supabase.channel(...).on('postgres_changes', ...)`. Verificar que Realtime está habilitado na tabela `stamps` (e nas outras usadas) no novo projeto: Dashboard → Database → Replication → toggle por tabela.
- **`pg_cron` e `pg_net`**: precisam ser habilitados via UI antes das migrations que os usam.
- **VAPID keys**: se você trocar as chaves, **todas as subscriptions atuais em `push_subscriptions` viram inválidas** (o navegador as invalidará no próximo `pushsubscriptionchange`). Recomenda-se **preservar** as VAPID keys atuais copiando os secrets para o novo ambiente.
- **`.pkpass` (Apple Wallet)**: hoje pausado — se reativar, cadastrar `APPLE_PASS_*` no novo ambiente.
- **Google OAuth via broker Lovable**: hoje o app chama `lovable.auth.signInWithOAuth('google', ...)`. Ao sair do Lovable Cloud, esse helper **não** funcionará; será necessário trocar para `supabase.auth.signInWithOAuth({ provider: 'google', ... })` diretamente **em produção do novo ambiente**. Marcar como TODO de código pós-migração (fora do escopo deste guia, que é "apenas documentar").
- **Templates de e-mail Supabase**: são configurados por projeto — reaplicar os HTMLs.
- **`app_roles` seed do super admin**: garantir que o UUID do usuário principal foi migrado; se não, promover manualmente via SQL após import: `insert into public.app_roles(user_id, role) values ('<uuid>', 'super_admin');`.
- **Sequences**: se usar CSV import, resetar sequences com `select setval(pg_get_serial_sequence('public.<t>','id'), coalesce(max(id),1)) from public.<t>;` — não aplicável a tabelas com `uuid` (a maioria), mas verificar as poucas com `bigint`.
- **Índices concorrentes**: as 15 índices adicionadas em otimização estão nas migrations — devem ser recriados normalmente.
- **Custos**: plano `Free` da Supabase tem 500MB DB / 1GB storage. Para produção real deste sistema, prever `Pro` ($25/mo) + storage adicional conforme volume de logos e attachments.

---

## 5. Pasta `supabase/`

Já existe:
- `supabase/config.toml` — pode ser ajustado manualmente após `supabase init` no novo projeto (project ref, port).
- `supabase/migrations/` — **22 migrations** cronologicamente ordenadas, prontas para `supabase db push` em projeto vazio.

Nenhuma migration nova foi criada por este guia (regra: não alterar código). Se durante a migração for identificada uma extension faltando, criar `supabase migration new enable_missing_extensions` e commitar antes do push.

---

## 6. Checklist final de corte (day-of-migration)

- [ ] Backup completo (dump binário + export CSV redundante + git tag `pre-migration`).
- [ ] Novo projeto Supabase provisionado, extensions habilitadas.
- [ ] `supabase db push` OK, `db diff` vazio.
- [ ] Storage buckets criados e objetos copiados.
- [ ] Auth users importados; e-mails de reset enviados se aplicável.
- [ ] Dados restaurados; contagens `select count(*)` idênticas por tabela.
- [ ] Realtime habilitado nas tabelas usadas.
- [ ] Cron jobs listados via `select * from cron.job` — todos apontando para o novo domínio.
- [ ] Secrets do runtime configurados no host do frontend.
- [ ] `.env` (Vite) atualizado, `types.ts` regenerado.
- [ ] DNS apontando para o novo host; SSL válido.
- [ ] Webhook Mercado Pago reconfigurado; teste com evento de sandbox.
- [ ] OAuth redirect URIs atualizadas no Google Cloud Console.
- [ ] Smoke test 8 passos: OK.
- [ ] Congelar escrita no projeto antigo (ou colocar em manutenção) durante a janela de corte para evitar drift.
- [ ] Após 24–48h de operação estável, decommission do projeto antigo.

---

**Fim do guia.** Este documento reflete o estado do repositório na data da geração e deve ser revisado se novas migrations, server functions ou secrets forem adicionados antes da execução da migração.
