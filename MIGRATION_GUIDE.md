# MIGRATION_GUIDE.md — Fidelize → Supabase próprio

Guia técnico para migrar o projeto **Fidelize** do Supabase gerenciado pelo Lovable Cloud para um **projeto Supabase próprio** (criado em supabase.com), preservando schema, dados, Auth, Storage, Realtime, cron, RLS e integrações. **Nenhuma alteração de código deve ser feita antes do corte** — este documento é o plano.

> Convenção: chamamos o Supabase gerenciado pelo Lovable Cloud de **ORIGEM** e o novo projeto Supabase próprio de **DESTINO**.

---

## 1. Visão geral e inventário

### 1.1 Stack atual (mapeada no código)

| Camada | Recurso |
|---|---|
| Frontend | React 19 + TanStack Start v1 + Vite 7 + Tailwind v4 |
| Backend runtime | `createServerFn` (TanStack Start) — **não usamos Edge Functions** |
| DB | Postgres (Supabase) |
| Auth | GoTrue via `@supabase/supabase-js` (client + admin) |
| Storage | 3 buckets (ver §6) |
| Realtime | Publicação `supabase_realtime` sobre `support_messages`, `support_tickets` |
| Agendamento | `pg_cron` (+ `pg_net` para HTTP) |
| Push | Web Push (VAPID) |
| Integrações externas | Resend, Mercado Pago |

### 1.2 Inventário (estado real, coletado no banco)

**Extensões instaladas (fora de plpgsql):**
`pg_cron 1.6.4`, `pg_net 0.20.4`, `pg_stat_statements 1.11`, `pgcrypto 1.3`, `supabase_vault 0.3.1`, `uuid-ossp 1.1`.

**Enums (schema `public`):**
`campaign_type(stamps,points)`, `customer_tier(bronze,prata,ouro,diamante)`, `helpdesk_role(hd_admin,hd_agent)`, `member_role(owner,manager,staff)`, `plan_tier(free,starter,pro,enterprise)`, `platform_role(super_admin)`, `support_author_type`, `support_category`, `support_priority`, `support_status`, `ticket_author_type`, `ticket_channel`, `ticket_priority`, `ticket_status`.

**Tabelas (`public`, 51):**
`api_keys, app_roles, audit_logs, campaigns, consents, coupons, customers, data_requests, email_logs, email_queue, email_templates, establishment_goals, establishment_members, establishment_settings, establishments, help_article_views, help_articles, help_categories, help_feedback, helpdesk_members, kb_articles, kb_categories, kb_feedback, loyalty_cards, notification_templates, payment_logs, payment_provider_credentials, payment_settings, payments, plan_features, plans, profiles, push_logs, push_subscriptions, retention_dispatches, retention_events, retention_settings, rewards, stamps, subscription_events, subscriptions, support_messages, support_quick_replies, support_status_history, support_tickets, system_email_settings, team_invites, ticket_messages, ticket_quick_replies, tickets, webhook_deliveries, webhooks`.

**Funções `SECURITY DEFINER` (`public`):**
`has_establishment_access`, `has_establishment_role`, `is_super_admin`, `is_helpdesk_admin`, `is_helpdesk_agent`, `has_plan_feature`, `get_establishment_plan`, `handle_new_user`, `tg_establishment_subscription_events`, `tg_support_message_after_insert`, `tg_support_status_history`, `tg_recompute_tier_after_stamp`, `mark_past_due_subscriptions`, `delete_my_account`. Funções não-definer: `tg_updated_at`, `tg_ticket_first_response`, `tg_ticket_defaults`, `compute_tier`.

**Publicação Realtime (`supabase_realtime`):**
`public.support_messages`, `public.support_tickets`.

**Cron jobs (`cron.job`):**
| Nome | Schedule | Finalidade |
|---|---|---|
| `process-email-queue` | `* * * * *` | Chama `/api/public/hooks/process-email-queue` para drenar `email_queue` (Resend) |
| `fidelize-birthday-daily` | `0 9 * * *` | Chama `/api/public/cron/birthday` |
| `fidelize-reengagement-daily` | `0 11 * * *` | Chama `/api/public/cron/reengagement` |
| `fidelize-mark-past-due` | `0 3 * * *` | `SELECT public.mark_past_due_subscriptions()` (dunning) |

**Storage buckets:** `logos` (privado), `ticket-attachments` (privado), `database_export_19_07_26` (privado, artefato pontual — provavelmente não migrar).

**Secrets configuradas na ORIGEM:**
`SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`.

**Server functions (arquivos `src/lib/*.functions.ts`):**
`admin`, `auth-confirm`, `email`, `goals`, `help`, `helpdesk`, `lgpd`, `loyalty`, `mercadopago`, `plans`, `push`, `retention`, `settings`, `support`, `wallet`. Todas usam `@/integrations/supabase/auth-middleware` (bearer do usuário via `requireSupabaseAuth`) e, quando privilegiadas, carregam `@/integrations/supabase/client.server` (service role) dentro do `.handler()`.

**Rotas HTTP públicas (`src/routes/api/public`):**
`cron/birthday`, `cron/reengagement`, `hooks/process-email-queue`, `wallet.apple.$token`, `webhooks/mercadopago`.

### 1.3 Riscos e dependências

- **`auth.users.id`** referenciado em ~15 tabelas (`profiles.id`, `establishment_members.user_id`, `app_roles.user_id`, `customers` não usa auth, `push_subscriptions.user_id`, `audit_logs.actor_id` etc.). **Preservar UUIDs é obrigatório**.
- **Vault (`supabase_vault`)**: verificar se `payment_provider_credentials` armazena algum segredo via `vault.secrets` — se sim, não sai por `pg_dump` (é criptografado com chave do projeto de origem).
- **Realtime**: `ALTER PUBLICATION` precisa ser re-executado no DESTINO.
- **`pg_cron`**: schedule vive no DB (`cron.job`), mas as chamadas `net.http_post` referenciam URL pública do app — se a URL mudar (novo domínio), atualizar os jobs.

---

## 2. Estratégia de exportação (ORIGEM)

> **Acesso:** o Lovable Cloud **não expõe** o painel Supabase da ORIGEM. Você tem acesso a: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, e `SUPABASE_DB_URL` (string de conexão Postgres direta). Também há um botão **Cloud → Advanced settings → Export data** que baixa CSVs.

### 2.1 Schema (DDL)

```bash
pg_dump "$SOURCE_DB_URL" \
  --schema=public --schema=storage \
  --schema-only --no-owner --no-privileges \
  -f dumps/schema.sql
```

- `--no-owner --no-privileges` evita conflitos com roles internos do Supabase (`supabase_admin`, etc.).
- Roles/GRANTs devem ser re-declarados pelas migrations (§3).

### 2.2 Dados

```bash
pg_dump "$SOURCE_DB_URL" \
  --schema=public --data-only \
  --disable-triggers \
  --exclude-table-data='public.audit_logs' \
  -f dumps/data.sql
```

Alternativa por tabela (CSV) via `psql \COPY` — útil para inspeção e para reimportar em ordem controlada. Ver `scripts/export-database.sh`.

### 2.3 Auth users

`pg_dump` **não deve** ser rodado no schema `auth` do Supabase — colunas internas mudam entre versões e você pode quebrar o GoTrue do DESTINO. Use a **Admin API** do GoTrue (`/auth/v1/admin/users`) via `SUPABASE_SERVICE_ROLE_KEY`. Ver `scripts/export-auth.ts`.

O que sai:
- `id`, `email`, `phone`, `email_confirmed_at`, `phone_confirmed_at`, `banned_until`, `raw_user_meta_data`, `raw_app_meta_data`, `created_at`, `last_sign_in_at`, `identities[]` (provider, provider_id, identity_data).

O que **não** sai:
- **Hash de senha** — a Admin API não expõe `encrypted_password`. Ver §5.
- Sessions/refresh tokens ativos.
- MFA factors (a API lista, mas não permite reimportar segredos TOTP).

### 2.4 Storage

Listar e baixar cada bucket via Storage API S3-compat. Ver `scripts/migrate-storage.ts` (usa `list` + `download` na origem, `createBucket` + `upload` no destino, preservando path).

### 2.5 pg_cron, Realtime, extensions

Exportados pelas migrations declarativas em `supabase/migrations/` (§3). `cron.job` **não** faz parte de `pg_dump --schema=public`; extraia com:

```sql
SELECT jobname, schedule, command FROM cron.job;
```

### 2.6 Configurações de Auth, redirects, SMTP, providers

Não saem por SQL. Você precisa **reconfigurar manualmente** no painel do DESTINO (Auth → URL Configuration / Providers / Email Templates / Rate Limits). Ver §14.

### 2.7 Secrets

Não saem. São recriadas no DESTINO. Ver §13.

---

## 3. Baseline SQL / estrutura de migrations

Estrutura recomendada (arquivos gerados vazios como skeleton — preencher a partir do `dumps/schema.sql`):

```
supabase/
  config.toml
  migrations/
    0001_extensions.sql          -- CREATE EXTENSION pgcrypto, uuid-ossp, pg_cron, pg_net, pg_stat_statements
    0002_enums.sql               -- 14 enums listados em §1.2
    0003_tables.sql              -- 51 tabelas do public
    0004_indexes_constraints.sql -- FKs, uniques, índices custom
    0005_functions.sql           -- 18 funções (SECURITY DEFINER + trigger fns)
    0006_triggers.sql            -- Todos os triggers (handle_new_user em auth.users, tg_updated_at, tg_ticket_*, tg_support_*, tg_establishment_subscription_events, tg_recompute_tier_after_stamp)
    0007_rls.sql                 -- ALTER TABLE ... ENABLE RLS + CREATE POLICY (todas as ~90 policies)
    0008_storage.sql             -- INSERT INTO storage.buckets + policies em storage.objects
    0009_realtime.sql            -- ALTER PUBLICATION supabase_realtime ADD TABLE ...
    0010_cron.sql                -- SELECT cron.schedule(...) para os 4 jobs
    0011_seed_required_data.sql  -- plans + plan_features (dados obrigatórios de config)
```

**Regra:** cada `CREATE TABLE public.*` deve ser seguido, na **mesma migration**, por:
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO authenticated;
GRANT ALL ON public.<table> TO service_role;
-- GRANT SELECT ON public.<table> TO anon; -- somente quando houver policy anon
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;
```

O DESTINO **não herda** GRANTs default — a ausência é o erro mais comum pós-migração ("permission denied for table X").

---

## 4. Migração dos dados

### 4.1 Ordem

Ordenada por dependência (FKs para `auth.users` e para tabelas de tenant):

1. `auth.users` + `auth.identities` (via Admin API, §5).
2. `profiles` (FK → auth.users).
3. `plans`, `plan_features` (via seed).
4. `establishments`.
5. `establishment_members`, `establishment_settings`, `establishment_goals`, `subscriptions`, `subscription_events`.
6. `app_roles`, `helpdesk_members`, `team_invites`.
7. `customers`, `retention_settings`, `retention_events`, `retention_dispatches`.
8. `loyalty_cards` → `stamps`, `rewards`, `coupons`.
9. `campaigns`, `notification_templates`.
10. `payment_provider_credentials`, `payment_settings`, `payments`, `payment_logs`.
11. `support_tickets` → `support_messages`, `support_status_history`, `support_quick_replies`.
12. `tickets` → `ticket_messages`, `ticket_quick_replies` (helpdesk B2B interno).
13. `help_categories` → `help_articles` → `help_article_views`, `help_feedback`.
14. `kb_categories` → `kb_articles` → `kb_feedback`.
15. `email_templates`, `email_queue`, `email_logs`, `system_email_settings`.
16. `push_subscriptions`, `push_logs`.
17. `webhooks`, `webhook_deliveries`, `api_keys`, `consents`, `data_requests`, `audit_logs`.

### 4.2 Estratégia

- **Preferir `pg_dump --data-only --disable-triggers`** — preserva UUIDs, timestamps e evita disparar `handle_new_user`, `tg_*_history` etc. duplicando eventos.
- Reabilitar triggers ao final: `SET session_replication_role = replica;` durante import e `origin` ao final.
- Rodar `SELECT setval(...)` para qualquer `SERIAL`/`BIGSERIAL` (o projeto usa UUID em quase tudo, mas confira `audit_logs`, `subscription_events` se tiverem `bigint identity`).
- CSV por tabela: só use quando `pg_dump` não for viável (ex.: ambiente sem `pg_dump` compatível com versão do Supabase — nesse caso, `\COPY`).

### 4.3 Validação

Ver §19 — script `scripts/validate-migration.ts` compara `count(*)` por tabela e sample de FKs.

---

## 5. Migração do Supabase Auth

### 5.1 O que pode ser migrado

| Campo | Migrável? | Como |
|---|---|---|
| `id` (uuid) | ✅ | `admin.createUser({ id, ... })` — GoTrue aceita `id` explícito |
| `email`, `phone` | ✅ | idem |
| `email_confirmed_at`, `phone_confirmed_at` | ✅ | `email_confirm: true` / `phone_confirm: true` |
| `raw_user_meta_data`, `raw_app_meta_data` | ✅ | `user_metadata`, `app_metadata` |
| `banned_until` | ✅ | `admin.updateUserById(id, { ban_duration })` |
| `identities` (Google etc.) | ⚠️ | GoTrue não tem endpoint público de import de identity. Ao recriar o usuário com o mesmo email e o provider Google habilitado no DESTINO, no primeiro login o GoTrue re-linka pela `email`. Documente que o usuário verá "conta já existe" e continuará no mesmo `user_id`. |
| `encrypted_password` (hash bcrypt) | ❌ | Admin API não retorna. **Todos os usuários com senha precisarão de reset**. |
| MFA factors | ❌ | Segredo TOTP não é exportável. Reenrolar. |
| Sessions | ❌ | Descartadas. |

### 5.2 Fluxo recomendado

1. Exportar usuários da ORIGEM (`scripts/export-auth.ts` → `dumps/auth-users.json`).
2. Criar no DESTINO com `id` preservado e `email_confirm: true` (`scripts/import-auth.ts`).
3. Disparar email de recuperação de senha em massa **após o corte**, com template customizado ("Migramos para nova infra, defina sua senha"). Endpoint: `admin.generateLink({ type: 'recovery', email })`.
4. Para o super_admin (`newdroidsk8@gmail.com`), definir senha manualmente via `admin.updateUserById(id, { password })` antes do corte, para garantir acesso.

### 5.3 Preservar FKs

Como o `id` é preservado, todas as FKs `user_id → auth.users(id)` funcionam sem remap. **Não gere UUIDs novos**.

---

## 6. Storage

### 6.1 Buckets a migrar

| Bucket | Público? | Origem | Uso no código |
|---|---|---|---|
| `logos` | ❌ (privado, URL assinada) | ORIGEM | `LogoUploadButton`, campanhas, onboarding |
| `ticket-attachments` | ❌ | ORIGEM | `uploadSupportAttachment` |
| `database_export_19_07_26` | — | ORIGEM | **NÃO migrar** — artefato de export pontual |

### 6.2 Passos

1. `scripts/migrate-storage.ts` lista objetos (paginado, `storage.from(bucket).list('', { limit: 1000, offset })`).
2. `download(path)` → escreve em `dumps/storage/<bucket>/<path>`.
3. No DESTINO: `createBucket(name, { public: false })` + recriar policies (`0008_storage.sql`).
4. `upload(path, file, { contentType, upsert: true })`.
5. Validar contagem por prefixo.

### 6.3 URLs no código

Buscar por `.getPublicUrl(` e `.createSignedUrl(` — o código armazena **path** (relativo ao bucket), não URL absoluta. As URLs assinadas são geradas on-demand. **Nenhuma correção de código deveria ser necessária**, mas confirmar:

```bash
rg -n "supabase\.co/storage" src/
```

Se aparecer URL absoluta hardcoded, trocar por `path` + `createSignedUrl` no momento do render.

---

## 7. RLS e segurança

### 7.1 Inventário

Todas as 51 tabelas têm RLS ativa (contagem de policies no `<supabase-tables>` do contexto). Policies dependem de:
- `auth.uid()` (usuário atual)
- `public.has_establishment_access(uid, est_id)` — pertence à empresa
- `public.has_establishment_role(uid, est_id, min_role)` — hierarquia owner > manager > staff
- `public.is_super_admin(uid)`
- `public.is_helpdesk_admin(uid, est_id)`, `public.is_helpdesk_agent(...)`
- `public.has_plan_feature(est_id, feature_key)`

### 7.2 Ordem correta no DESTINO

1. Criar tabelas → GRANT → ENABLE RLS (migration `0003`).
2. Criar funções `SECURITY DEFINER` (`0005`) **antes** das policies que as usam.
3. `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC, anon;` para as funções sensíveis (`has_*`, `is_*`) — já é feito hoje (finding `SUPA_*_security_definer_function_executable` foi corrigido).
4. Criar policies (`0007`).

### 7.3 Riscos a revisar

- Todas as funções `SECURITY DEFINER` têm `SET search_path = public` — ✅.
- Nenhuma policy consulta a própria tabela (evita recursão infinita) — o padrão é usar helpers `has_*`. ✅.
- `establishment_members` teve finding `establishment_members_self_owner_insert` já corrigido — manter policy corrigida na migration `0007`.

---

## 8. Funções, triggers, SECURITY DEFINER

Copiar `pg_get_functiondef` de cada função da ORIGEM para `0005_functions.sql`. Definir explicitamente:
- `LANGUAGE`, `STABLE`/`VOLATILE`/`IMMUTABLE`.
- `SECURITY DEFINER` **+** `SET search_path = public`.
- `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon;` para funções sensíveis.
- `GRANT EXECUTE ON FUNCTION ... TO authenticated;` quando apropriado.

**Trigger em schema `auth`:** `handle_new_user` é chamado por trigger `on_auth_user_created` em `auth.users`. Recriar no DESTINO:

```sql
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

⚠️ Ao importar usuários via Admin API, esse trigger vai disparar → duplicar linhas em `profiles`. **Desabilite o trigger durante o import** (`ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;`) e reabilite ao final.

---

## 9. pg_cron

Recriar no `0010_cron.sql` os 4 jobs. As URLs em `net.http_post(url := ...)` **devem refletir o novo domínio do app** (não do Supabase):

```sql
SELECT cron.schedule('process-email-queue', '* * * * *', $$
  SELECT net.http_post(
    url := 'https://<NEW_APP_URL>/api/public/hooks/process-email-queue',
    headers := jsonb_build_object('Content-Type','application/json','apikey','<NEW_ANON_KEY>'),
    body := '{}'::jsonb
  );
$$);
```

Repetir para `fidelize-birthday-daily`, `fidelize-reengagement-daily`. O job `fidelize-mark-past-due` é 100% SQL e não muda.

**Limitação:** planos Supabase Free e alguns Pro têm restrição em `pg_cron` (só usuário `postgres`). Confirme no plano do DESTINO.

---

## 10. Realtime

Migration `0009_realtime.sql`:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER TABLE public.support_messages REPLICA IDENTITY FULL;
ALTER TABLE public.support_tickets REPLICA IDENTITY FULL;
-- Voucher em tempo real usa loyalty_cards + stamps — se hoje funcionam via polling+refetch, não precisa entrar na publicação. Confirmar no código antes de decidir.
```

**Testar:** com dois navegadores, adicionar carimbo → voucher atualiza; responder ticket → toast no cliente.

---

## 11. Web Push

- Tabela: `push_subscriptions` (13 colunas) + `push_logs`.
- Chaves: `VAPID_PUBLIC_KEY` (em `src/lib/vapid.ts`, **hardcoded** — pública, ok) + `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` como secrets.
- Server function: `src/lib/push.functions.ts` + helper `src/lib/push.server.ts`.
- Service worker: `public/sw-push.js`.

**Se você regenerar as chaves VAPID no DESTINO**, todas as subscriptions antigas viram inválidas (`410 Gone`) — os usuários precisarão reinscrever. **Recomendação: reutilizar as VAPID_* existentes** (copiar dos secrets da ORIGEM para o DESTINO). Assim `push_subscriptions` migradas continuam válidas.

---

## 12. TanStack Start e server functions — o que muda no código

O objetivo é **trocar apenas as variáveis de ambiente**. Arquivos que instanciam clientes Supabase:

| Arquivo | Role | Lê variáveis |
|---|---|---|
| `src/integrations/supabase/client.ts` | browser (anon) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (fallback SSR: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`) |
| `src/integrations/supabase/auth-middleware.ts` | server (usuário via bearer) | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` |
| `src/integrations/supabase/client.server.ts` | server (service role) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

Esses três arquivos são **auto-gerados** pelo Lovable; ao rodar fora do Lovable Cloud, você mesmo os mantém. Nenhuma lógica muda. O bearer attach (`src/integrations/supabase/auth-attacher.ts`) e o middleware em `src/start.ts` **não mudam**.

**SSR/cookies:** o projeto guarda sessão em `localStorage` (padrão SPA), não em cookies. A rota gate `/routes/_authenticated/route.tsx` usa `ssr: false` — continua funcionando.

**Callback OAuth Google:** hoje via `lovable.auth.signInWithOAuth('google', ...)` (broker Lovable). **Ao sair do Lovable Cloud, esse broker deixa de existir** — trocar por `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: ... } })` e configurar o provider Google diretamente no painel do DESTINO. Ver §14.

---

## 13. Variáveis de ambiente

`.env.migration.example` (ver arquivo separado). Resumo:

| Var | Público? | Onde é usada | Origem do valor |
|---|---|---|---|
| `VITE_SUPABASE_URL` | ✅ público (bundle) | `client.ts` | painel DESTINO → Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ | `client.ts` | painel DESTINO → API Keys → publishable/anon |
| `VITE_SUPABASE_PROJECT_ID` | ✅ | tipos gerados | ref do projeto DESTINO |
| `SUPABASE_URL` | 🔒 server | `auth-middleware`, `client.server` | mesmo valor da URL |
| `SUPABASE_PUBLISHABLE_KEY` | 🔒 server | `auth-middleware` | mesma anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 🔒 server | `client.server`, `auth-confirm.functions`, admin | painel DESTINO → API Keys → service_role |
| `SUPABASE_DB_URL` | 🔒 | migração / scripts | painel DESTINO → Database → Connection string |
| `LOVABLE_API_KEY` | 🔒 server | AI Gateway (chat, embeddings) | continua igual se seguir usando Lovable AI, senão remover chamadas |
| `VAPID_PUBLIC_KEY` | ✅ (hardcoded em `src/lib/vapid.ts`) | frontend push subscribe | reutilizar da ORIGEM |
| `VAPID_PRIVATE_KEY` | 🔒 | `push.server.ts` | reutilizar |
| `VAPID_SUBJECT` | 🔒 | `push.server.ts` | reutilizar (`mailto:...`) |
| `RESEND_API_KEY` | 🔒 | `email.server.ts` | painel Resend |
| `MP_ACCESS_TOKEN` / `MP_WEBHOOK_SECRET` | 🔒 | `mercadopago.*` | painel Mercado Pago |

**Não commitar**. `.env.migration.example` só tem nomes.

---

## 14. Configuração de Auth no painel DESTINO

Reconfigurar manualmente (não é exportável):

- **Site URL:** `https://<novo-dominio>`
- **Redirect URLs:** `https://<novo-dominio>/**`, `https://<novo-dominio>/app`, `https://<novo-dominio>/auth`, `https://<novo-dominio>/auth/nova-senha`, callbacks de dev (`http://localhost:8080/**`).
- **Email templates:** copiar textos dos templates atuais (invite, recovery, magic link, confirm signup). Idioma: pt-BR.
- **SMTP:** conectar Resend como SMTP customizado (`smtp.resend.com`, porta 465, user `resend`, pass = `RESEND_API_KEY`) OU deixar o SMTP interno do Supabase (limite de rate baixo).
- **Providers:**
  - Email/Password: ativado, **desativar** "Confirm email" **ou** manter e reusar `confirmEmailByAddress` server fn (atenção: essa fn usa service role — continua funcionando).
  - Google OAuth: criar client_id/secret no Google Cloud Console, colar no painel. **Authorized redirect URI**: `https://<PROJECT_REF>.supabase.co/auth/v1/callback`.
- **Rate limits:** subir para 100+/h se for enviar recovery em massa pós-corte.
- **Session duration:** 1 semana (default, ok).
- **Password policy:** min 6 (já usado no signup).
- **CAPTCHA / MFA / Hooks:** não usados hoje; não configurar.

---

## 15. Integrações externas

| Integração | Atualização necessária |
|---|---|
| Resend | Nenhuma no Resend em si (só reconfigurar SMTP no Auth DESTINO). Reconfirmar `RESEND_API_KEY` como secret. |
| Mercado Pago | Atualizar **Notification URL do webhook** para `https://<novo-dominio>/api/public/webhooks/mercadopago`. `MP_WEBHOOK_SECRET` continua o mesmo. |
| Web Push | Reutilizar VAPID (§11). Nenhum endpoint externo depende de URL Supabase. |
| PWA / Service Worker | Nenhuma dependência de URL Supabase. |
| Google OAuth | Novo `redirect URI` (§14). |
| Cron externos | Nenhum — todos são `pg_cron` interno. |
| WhatsApp | Não integrado no código atual (só campo `phone` no perfil). |

---

## 16. Plano de corte

### Fase A — Preparação (D-7 a D-1, **sem indisponibilidade**)
1. Criar projeto DESTINO em supabase.com.
2. Rodar migrations `0001`–`0011` (§3). Validar linter Supabase.
3. Configurar Auth (§14), buckets vazios, providers, SMTP.
4. Definir secrets no ambiente onde o app roda (Vercel/Cloudflare/etc.).
5. Rodar `scripts/export-auth.ts`, `scripts/migrate-storage.ts`, `pg_dump` da ORIGEM contra um **projeto DESTINO de staging** para validar procedimento ponta-a-ponta.
6. Executar suíte §18 no staging.

### Fase B — Janela de manutenção (estimativa 30–90 min)
1. Colocar app em modo read-only (feature flag ou página de manutenção estática).
2. Rodar dump final: `scripts/export-database.sh` + `scripts/export-auth.ts` + `scripts/migrate-storage.ts` (delta).
3. Importar no DESTINO real: `scripts/import-database.sh` + `scripts/import-auth.ts`.
4. Rodar `scripts/validate-migration.ts` — abortar se qualquer count divergir.
5. Trocar variáveis de ambiente do deploy (Vercel/CF Env → novos valores).
6. Deploy do app (mesmo commit, novas envs).
7. Atualizar URLs em `cron.job` (novo domínio, nova anon key) — rodar `0010_cron.sql` re-aplicado.
8. Smoke test §18.

### Fase C — Pós-migração (D+0 a D+7)
- Monitorar Sentry, logs Supabase, `email_logs`, `push_logs`, `payments`.
- Disparar recovery email em massa para todos usuários (§5).
- Manter ORIGEM em modo read-only por 7 dias para eventual rollback (§17).
- Após 7 dias sem incidentes: desligar ORIGEM (Lovable Cloud → Disable — não remove do projeto atual, apenas de futuros).

---

## 17. Rollback

**Ponto de decisão:** até 4h após reabrir o app. Depois disso, dados novos criados no DESTINO tornam rollback destrutivo.

Se rollback for necessário nesse intervalo:
1. Repor variáveis de ambiente antigas no deploy (ORIGEM).
2. Deploy (mesmo commit).
3. Exportar do DESTINO **apenas as linhas criadas após o corte** (`WHERE created_at > '<timestamp-corte>'`) e reimportar no ORIGEM. Priorizar: `customers`, `stamps`, `support_messages`, `payments`, `push_logs`.
4. Comunicar clientes: pedidos de senha executados no DESTINO durante a janela precisarão ser refeitos.

**Backup obrigatório antes do corte:** `pg_dump` completo da ORIGEM salvo em local externo (S3 pessoal).

---

## 18. Checklist de testes ponta-a-ponta

Executar no staging **e** no DESTINO real pós-corte. Ver `MIGRATION_CHECKLIST.md` (arquivo separado) com detalhamento.

Resumo: login (email+senha), signup, recovery, Google OAuth, sessão persistente, RLS (usuário A não vê dados de B), CRUD de empresas/clientes/campanhas, carimbar (via busca **e** via QR), voucher (`/c/:token`) com realtime, resgate de recompensa, PWA install, Web Push, cron dispara (aguardar 24h ou rodar manual), Mercado Pago sandbox flow, upload/download em `logos` e `ticket-attachments`, super_admin acessa `/admin`, exportação CSV, isolamento multi-tenant.

---

## 19. Validação técnica

`scripts/validate-migration.ts` conecta em ORIGEM e DESTINO e compara:

```sql
-- 1. Contagem por tabela
SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY relname;

-- 2. Órfãos (exemplo)
SELECT COUNT(*) FROM public.stamps s LEFT JOIN public.loyalty_cards c ON c.id=s.card_id WHERE c.id IS NULL;

-- 3. Auth
SELECT COUNT(*) FROM auth.users;

-- 4. Storage
SELECT bucket_id, COUNT(*) FROM storage.objects GROUP BY 1;

-- 5. Cron
SELECT jobname, schedule FROM cron.job ORDER BY jobname;

-- 6. Realtime
SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime';

-- 7. Policies
SELECT schemaname, tablename, COUNT(*) FROM pg_policies WHERE schemaname='public' GROUP BY 1,2 ORDER BY 2;
```

Resultado esperado: DESTINO == ORIGEM em todos os counts. Divergência → investigar antes de liberar.

---

## 20. Arquivos gerados junto com este guia

- `MIGRATION_GUIDE.md` (este)
- `MIGRATION_CHECKLIST.md` — checklist executável
- `ROLLBACK_PLAN.md` — plano de rollback expandido
- `.env.migration.example`
- `supabase/config.toml` (skeleton)
- `supabase/migrations/0001_extensions.sql` … `0011_seed_required_data.sql` (skeletons — preencher com output de `pg_dump`)
- `scripts/export-database.sh`
- `scripts/import-database.sh`
- `scripts/export-auth.ts`
- `scripts/import-auth.ts`
- `scripts/migrate-storage.ts`
- `scripts/validate-migration.ts`

---

## 21. Limitações do Lovable Cloud (o que **não** pode ser 100% automatizado)

1. **Painel Supabase da ORIGEM não é acessível** — não dá para exportar Auth settings, providers, templates, rate limits: precisam ser reconfigurados manualmente no DESTINO usando este guia como referência.
2. **Hashes de senha não são exportáveis** — Admin API não retorna `encrypted_password`. **Todos os usuários com login por senha precisarão fazer reset**.
3. **MFA factors não migram** — quem tiver 2FA precisa reenrolar.
4. **Sessions ativas são invalidadas** — todos são deslogados no momento do corte.
5. **Identities OAuth** — recriadas no primeiro login se o mesmo email + provider estiver configurado no DESTINO. Não existe endpoint público de import.
6. **Secrets** (VAPID, Resend, MP, LOVABLE_API_KEY) — precisam ser lidas da ORIGEM (você tem acesso) e re-cadastradas manualmente no ambiente de deploy do DESTINO.
7. **`supabase_vault`** — se algum credential estiver criptografado no vault da ORIGEM (verificar `payment_provider_credentials`), a chave de criptografia é do projeto; o valor precisa ser reintroduzido em texto claro no DESTINO.
8. **`pg_stat_statements`** — dados históricos de performance não migram (é telemetria in-memory).
9. **Backups automáticos, PITR, logs de auditoria do Supabase** — pertencem ao projeto ORIGEM e não são portados.

Fim.
