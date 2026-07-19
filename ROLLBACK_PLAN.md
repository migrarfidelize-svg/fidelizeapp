# ROLLBACK_PLAN.md

## Quando abortar
- Divergência em `scripts/validate-migration.ts` que não seja explicável em 15 min.
- Login falha para > 5% dos usuários testados no smoke test.
- Realtime não funciona no voucher após 3 tentativas.
- Cron não agenda no plano do DESTINO.
- Storage: > 1% dos objetos com hash divergente.

## Janela de decisão
- **T+0 a T+4h**: rollback simples (basta reverter env vars).
- **T+4h a T+24h**: rollback com re-sync de deltas (mais complexo).
- **> T+24h**: rollback deixa de ser viável — corrigir no DESTINO.

## Procedimento de rollback (T+0 a T+4h)

1. Colocar app em manutenção.
2. No painel do deploy (Vercel/CF/etc.), restaurar snapshot anterior das env vars:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
3. Redeploy (mesmo commit).
4. Reverter webhook do Mercado Pago para URL antiga.
5. Reverter `redirect URI` do Google OAuth (se foi alterado).
6. Tirar do modo manutenção.
7. Validar login + carimbar cliente teste.

## Procedimento de rollback (T+4h a T+24h)

Igual ao anterior + re-sync de dados novos criados no DESTINO:

```sql
-- Rodar no DESTINO, exportar em CSV, importar no ORIGEM
COPY (SELECT * FROM public.stamps WHERE created_at > '<CUTOVER_TS>') TO STDOUT WITH CSV HEADER;
COPY (SELECT * FROM public.customers WHERE created_at > '<CUTOVER_TS>') TO STDOUT WITH CSV HEADER;
COPY (SELECT * FROM public.support_messages WHERE created_at > '<CUTOVER_TS>') TO STDOUT WITH CSV HEADER;
COPY (SELECT * FROM public.payments WHERE created_at > '<CUTOVER_TS>') TO STDOUT WITH CSV HEADER;
COPY (SELECT * FROM public.push_logs WHERE created_at > '<CUTOVER_TS>') TO STDOUT WITH CSV HEADER;
```

Importar no ORIGEM via `\COPY ... FROM STDIN`, na ordem de FKs (§4.1 do guia).

## Backup obrigatório antes do corte

```bash
pg_dump "$SOURCE_DB_URL" -Fc -f "backup-origem-$(date +%Y%m%d-%H%M%S).dump"
aws s3 cp backup-origem-*.dump s3://<seu-bucket-backup>/
```

Guardar por 30 dias.

## Comunicação

Template de aviso ao usuário em caso de rollback:

> "Detectamos uma inconsistência durante uma manutenção programada e voltamos temporariamente para a infraestrutura anterior. Nenhum dado foi perdido. Se você criou algo entre HH:MM e HH:MM, pode ser que precise recadastrar."
