#!/usr/bin/env bash
# Exporta schema + dados da ORIGEM.
# Uso:  SOURCE_DB_URL=postgres://... ./scripts/export-database.sh
set -euo pipefail

: "${SOURCE_DB_URL:?SOURCE_DB_URL não definido}"

OUT_DIR="dumps"
mkdir -p "$OUT_DIR"

# Proteção: recusar se URL apontar para localhost sem confirmação
if [[ "$SOURCE_DB_URL" != *"supabase.co"* && "${I_KNOW:-}" != "yes" ]]; then
  echo "SOURCE_DB_URL não parece Supabase. Rode com I_KNOW=yes para prosseguir." >&2
  exit 1
fi

echo "[1/3] schema.sql"
pg_dump "$SOURCE_DB_URL" \
  --schema=public --schema=storage \
  --schema-only --no-owner --no-privileges \
  -f "$OUT_DIR/schema.sql"

echo "[2/3] data.sql (public, sem audit_logs)"
pg_dump "$SOURCE_DB_URL" \
  --schema=public --data-only \
  --disable-triggers \
  --exclude-table-data='public.audit_logs' \
  -f "$OUT_DIR/data.sql"

echo "[3/3] cron.sql"
psql "$SOURCE_DB_URL" -Atc \
  "SELECT format('SELECT cron.schedule(%L, %L, %L);', jobname, schedule, command) FROM cron.job;" \
  > "$OUT_DIR/cron.sql"

echo "OK. Artefatos em $OUT_DIR/"
ls -lh "$OUT_DIR"
