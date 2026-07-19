#!/usr/bin/env bash
# Importa schema + dados no DESTINO.
# Uso:  SUPABASE_DB_URL=postgres://... ./scripts/import-database.sh
set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL não definido}"

if [[ "${DRY_RUN:-}" == "1" ]]; then
  echo "[DRY RUN] mostraria comandos e sairia."
  exit 0
fi

# Proteção anti-produção acidental
if [[ "$SUPABASE_DB_URL" == *"lovable"* ]]; then
  echo "SUPABASE_DB_URL parece ORIGEM (Lovable). Abortando." >&2
  exit 2
fi

echo "[1/3] aplicando schema via supabase CLI"
# Alternativa: psql "$SUPABASE_DB_URL" -f dumps/schema.sql
supabase db push

echo "[2/3] aplicando data-only com replication_role=replica"
psql "$SUPABASE_DB_URL" <<'SQL'
SET session_replication_role = replica;
\i dumps/data.sql
SET session_replication_role = origin;
SQL

echo "[3/3] cron"
psql "$SUPABASE_DB_URL" -f dumps/cron.sql

echo "OK. Rode scripts/validate-migration.ts em seguida."
