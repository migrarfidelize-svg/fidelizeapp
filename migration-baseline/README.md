# migration-baseline/

Skeletons SQL + `config.toml` para o projeto Supabase DESTINO.

**Não** aplicar no Lovable Cloud (ORIGEM). Estes arquivos são para você rodar no seu novo projeto Supabase criado em supabase.com.

Fluxo:
1. Criar projeto em supabase.com.
2. Rodar 0001–0002 e 0008–0010 já vêm prontos.
3. Preencher 0003–0007 e 0011 com output de `pg_dump` da ORIGEM (ver `scripts/export-database.sh` + `MIGRATION_GUIDE.md §3`).
4. Aplicar em ordem via `psql "$SUPABASE_DB_URL" -f migration-baseline/000X_*.sql` ou copiando o `config.toml` para `supabase/` e usando `supabase db push`.

`config.toml` deste diretório é um exemplo — o arquivo real vive em `supabase/config.toml` do seu clone local do repositório da CLI Supabase.
