# Guia de Migração 100% Independente — Fidelize

Este documento descreve o passo a passo para rodar o Fidelize **sem depender da Lovable**.

---

## Fase 1 — Migração de Dados (via extensão Chrome)

1. Baixe **fidelize-migrator.zip** em `/baixar-migrator`.
2. Descompacte e carregue em `chrome://extensions` → Modo desenvolvedor → **Carregar sem compactação**.
3. Crie uma conta em [supabase.com](https://supabase.com) e um novo projeto (grátis até 500MB).
4. Na extensão, informe URL + Service Role Key do novo projeto e execute os módulos:
   - Schema (tabelas, funções, policies)
   - Auth (usuários com hash preservado)
   - Storage (buckets + arquivos)
   - Data (todas as tabelas de negócio)

## Fase 2 — Independência de IA (JÁ APLICADO NO CÓDIGO)

O código agora detecta automaticamente qual provedor usar:

| Recurso | 1ª opção (independente) | Fallback |
|---|---|---|
| Chat "Fidê" | `GEMINI_API_KEY` (Google direto) | `LOVABLE_API_KEY` |
| Saudações de voz | `OPENAI_API_KEY` (OpenAI direto) | `LOVABLE_API_KEY` → Web Speech nativa |

### Como obter as chaves

- **Gemini (grátis, 15 req/min):** [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- **OpenAI (pago, opcional):** [platform.openai.com/api-keys](https://platform.openai.com/api-keys) — se não configurar, o sistema usa a Web Speech API nativa do navegador (100% grátis).

Basta setar as variáveis no `.env` da sua VPS — o código detecta e prioriza automaticamente.

## Fase 3 — Deploy em VPS

### 3.1 Requisitos

- Ubuntu 22.04+ / 4GB RAM
- Node 20+, PM2, Nginx, Certbot

### 3.2 Variáveis de ambiente (`.env`)

```bash
# Supabase (seu projeto novo)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# IA (100% independente)
GEMINI_API_KEY=AIzaSyxxxxx
OPENAI_API_KEY=sk-xxxxx   # opcional

# URLs
PUBLIC_APP_URL=https://seudominio.com
PUBLISHED_APP_URL=https://seudominio.com

# Push
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:voce@seudominio.com

# Pagamentos
MERCADOPAGO_ACCESS_TOKEN=...
MERCADOPAGO_WEBHOOK_SECRET=...
```

### 3.3 Build & start

```bash
git clone <seu-repo> fidelize && cd fidelize
npm ci
npm run build
pm2 start .output/server/index.mjs --name fidelize
pm2 save
```

### 3.4 Nginx + SSL

```nginx
server {
  server_name seudominio.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

```bash
certbot --nginx -d seudominio.com
```

### 3.5 Cron (Supabase → Database → Extensions → pg_cron)

```sql
select cron.schedule('mark-past-due', '0 3 * * *',
  $$select public.mark_past_due_subscriptions();$$);
```

---

## Diagnóstico Final

| Componente | Antes | Depois |
|---|---|---|
| Banco de dados | Lovable Cloud | Supabase próprio (self-hosted opcional) |
| Auth | Lovable Cloud | Supabase próprio |
| Storage | Lovable Cloud | Supabase próprio |
| IA Chat (Fidê) | Lovable Gateway | **Gemini direto** (fallback Lovable) |
| IA Voz | Lovable Gateway | **OpenAI direto** ou **Web Speech nativa** |
| E-mails | Lovable (Resend) | Resend próprio (chave direta) |
| Pagamentos | Já independente | Já independente ✅ |
| Hospedagem | Lovable | Sua VPS + Nginx + PM2 |

**Independência final: 100%** — nenhum runtime obrigatório da Lovable.
