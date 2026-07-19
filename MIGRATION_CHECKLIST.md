# MIGRATION_CHECKLIST.md

Checklist executável. Marque cada item. Referência: `MIGRATION_GUIDE.md`.

## Pré-corte (D-7)
- [ ] Projeto Supabase DESTINO criado (região = ORIGEM)
- [ ] Plano do DESTINO suporta `pg_cron` e `pg_net`
- [ ] `SUPABASE_DB_URL` do DESTINO em mãos
- [ ] `service_role` key do DESTINO em mãos
- [ ] Extensões habilitadas: `pgcrypto`, `uuid-ossp`, `pg_cron`, `pg_net`, `pg_stat_statements`, `supabase_vault`
- [ ] Migrations `0001`–`0011` aplicadas
- [ ] `supabase db lint` sem erros críticos
- [ ] Auth configurado: Site URL, Redirect URLs, SMTP (Resend), Google provider
- [ ] Buckets criados: `logos`, `ticket-attachments` (privados)
- [ ] Secrets configuradas no ambiente do deploy (ver `.env.migration.example`)
- [ ] Staging validado ponta-a-ponta

## Corte (D-0)

### Bloqueio
- [ ] App em modo manutenção / read-only
- [ ] Timestamp do corte anotado: `______________________`

### Export ORIGEM
- [ ] `scripts/export-database.sh` → `dumps/schema.sql`, `dumps/data.sql`
- [ ] `scripts/export-auth.ts` → `dumps/auth-users.json`
- [ ] `scripts/migrate-storage.ts --mode=export` → `dumps/storage/`
- [ ] `SELECT jobname, schedule, command FROM cron.job;` salvo em `dumps/cron.sql`

### Import DESTINO
- [ ] `ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;`
- [ ] `scripts/import-auth.ts`
- [ ] `ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;`
- [ ] `scripts/import-database.sh` (data-only, disable-triggers)
- [ ] `scripts/migrate-storage.ts --mode=import`
- [ ] `0010_cron.sql` re-aplicado com URLs do novo domínio + nova anon key
- [ ] `ALTER PUBLICATION supabase_realtime ADD TABLE ...` confirmado

### Validação
- [ ] `scripts/validate-migration.ts` — counts DESTINO == ORIGEM
- [ ] Nenhum órfão FK detectado
- [ ] `SELECT count(*) FROM auth.users` bate
- [ ] Storage: contagem por bucket bate

### Cutover
- [ ] Variáveis de ambiente do deploy trocadas
- [ ] Redeploy
- [ ] Webhook Mercado Pago apontando pro novo domínio
- [ ] Google OAuth redirect URI atualizado
- [ ] DNS (se aplicável) atualizado

## Smoke tests pós-corte
- [ ] `/` carrega
- [ ] Login por senha (usuário conhecido; se falhar → recovery)
- [ ] Login Google OAuth
- [ ] Signup novo usuário → onboarding → cria estabelecimento
- [ ] Reset de senha (email chega via Resend)
- [ ] `/app` — dashboard renderiza
- [ ] `/app/clientes` — lista + paginação
- [ ] `/app/carimbar` — busca cliente + adiciona carimbo
- [ ] `/app/carimbar` — QR scan + adiciona carimbo
- [ ] `/c/:token` — voucher renderiza, PWA installable
- [ ] `/c/:token` — carimbo aparece em tempo real
- [ ] `/app/campanhas` — CRUD
- [ ] `/app/planos` — upgrade sandbox MP
- [ ] `/app/suporte` — abrir ticket + anexar arquivo
- [ ] Admin responde ticket → cliente recebe notificação realtime
- [ ] `/admin` (super_admin) — métricas
- [ ] `/admin/notificacoes` — enviar push broadcast → chega no device
- [ ] Cron `process-email-queue` roda no próximo minuto (checar `email_logs`)
- [ ] Cron diários agendados corretamente (`SELECT * FROM cron.job`)

## Pós-corte (D+1 a D+7)
- [ ] Recovery email em massa disparado para todos usuários com senha
- [ ] Sentry sem erros novos
- [ ] `email_queue` drenando
- [ ] `push_logs` sem taxa anormal de `410 Gone`
- [ ] MRR/pagamentos coerentes com ORIGEM
- [ ] ORIGEM mantida read-only por 7 dias
- [ ] D+7: desligar ORIGEM
