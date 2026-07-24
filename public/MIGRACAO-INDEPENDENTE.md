# Guia de Migração 100% Independente — Fidelize

Este documento descreve o passo a passo completo para rodar o Fidelize **sem depender da Lovable**, incluindo VPS com Docker, Nginx, SSL automático e todos os cron jobs de retenção.

---

## Sumário

- [Fase 1 — Migração de Dados (extensão Chrome)](#fase-1--migração-de-dados-via-extensão-chrome)
- [Fase 2 — Independência de IA (já aplicada no código)](#fase-2--independência-de-ia-já-aplicado-no-código)
- [Fase 3 — Deploy em VPS (Docker + Nginx + SSL)](#fase-3--deploy-em-vps-docker--nginx--ssl)
- [Fase 4 — Cron Jobs (pg_cron)](#fase-4--cron-jobs-pg_cron)
- [Fase 5 — Google OAuth próprio](#fase-5--google-oauth-próprio-opcional)
- [Troubleshooting](#troubleshooting)
- [Diagnóstico Final](#diagnóstico-final)

---

## Fase 1 — Migração de Dados (via extensão Chrome)

1. Baixe **fidelize-migrator.zip** em `/baixar-migrator`.
2. Descompacte e carregue em `chrome://extensions` → Modo desenvolvedor → **Carregar sem compactação**.
3. Crie uma conta em [supabase.com](https://supabase.com) e um novo projeto (grátis até 500MB).
4. Na extensão, informe URL + Service Role Key do novo projeto e execute os módulos, **nesta ordem**:
   1. **Schema** (tabelas, funções, policies, triggers)
   2. **Auth** (usuários com hash bcrypt preservado)
   3. **Storage** (buckets: `logos`, `promotions`, `ticket-attachments`, `poster-print-orders`)
   4. **Data** (dados de negócio de todas as tabelas)
5. Ao final, valide no dashboard do Supabase:
   - Contagem de usuários em `auth.users`
   - Contagem em `public.customers`, `public.establishments`, `public.loyalty_cards`
   - Arquivos nos buckets

> **Dica:** rode a extensão em horário de baixo tráfego. A migração de auth preserva os hashes de senha, então nenhum cliente precisa redefinir senha.

---

## Fase 2 — Independência de IA (JÁ APLICADO NO CÓDIGO)

O código detecta automaticamente qual provedor usar:

| Recurso | 1ª opção (independente) | Fallback |
|---|---|---|
| Chat "Fidê" | `GEMINI_API_KEY` (Google direto) | `LOVABLE_API_KEY` |
| Saudações de voz | Web Speech API nativa | (nenhum — 100% browser) |

### Como obter as chaves

- **Gemini (grátis, 15 req/min):** [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

Basta setar a variável no `.env` da sua VPS — o código detecta e prioriza automaticamente.

---

## Fase 3 — Deploy em VPS (Docker + Nginx + SSL)

### 3.1 Requisitos

- Ubuntu 22.04+ com root ou sudo
- Mínimo **2 vCPU / 4GB RAM / 40GB SSD** (recomendado 4vCPU/8GB)
- Domínio apontado para o IP da VPS (registro A)
- Portas **80** e **443** liberadas no firewall

### 3.2 Instalação base

```bash
# Atualiza sistema
sudo apt update && sudo apt upgrade -y

# Docker + Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Utilitários
sudo apt install -y git nginx certbot python3-certbot-nginx ufw

# Firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

### 3.3 Estrutura do projeto

```
/opt/fidelize/
├── docker-compose.yml
├── .env.production
├── Dockerfile
└── (código clonado do git)
```

### 3.4 Variáveis de ambiente (`.env.production`)

```bash
# ────── Supabase (seu projeto novo) ──────
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
SUPABASE_DB_URL=postgresql://postgres:SENHA@db.xxxxx.supabase.co:5432/postgres

# ────── IA (independente) ──────
GEMINI_API_KEY=AIzaSyxxxxx

# ────── URLs ──────
PUBLIC_APP_URL=https://seudominio.com
PUBLISHED_APP_URL=https://seudominio.com
NODE_ENV=production

# ────── Push notifications ──────
VAPID_PUBLIC_KEY=BM...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:voce@seudominio.com

# ────── Pagamentos ──────
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
MERCADOPAGO_WEBHOOK_SECRET=whsec_...

# ────── Emails (Resend próprio) ──────
RESEND_API_KEY=re_...
```

> **Proteja o arquivo:** `chmod 600 /opt/fidelize/.env.production`

### 3.5 `Dockerfile`

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json bun.lockb* ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./
EXPOSE 3000
ENV HOST=0.0.0.0 PORT=3000
CMD ["node", ".output/server/index.mjs"]
```

### 3.6 `docker-compose.yml`

```yaml
services:
  fidelize:
    build: .
    container_name: fidelize
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    env_file: .env.production
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 3.7 Build e start

```bash
cd /opt/fidelize
git clone <SEU-REPO> .
docker compose up -d --build
docker compose logs -f fidelize   # acompanhe até "Listening on :3000"
```

### 3.8 Nginx + SSL (Certbot)

`/etc/nginx/sites-available/fidelize`:

```nginx
server {
    listen 80;
    server_name seudominio.com www.seudominio.com;

    client_max_body_size 20M;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_read_timeout 120s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/fidelize /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL automático (renova sozinho via systemd timer)
sudo certbot --nginx -d seudominio.com -d www.seudominio.com \
  --agree-tos -m voce@seudominio.com --redirect
```

### 3.9 Deploy contínuo

Script `deploy.sh` na raiz do projeto:

```bash
#!/bin/bash
set -e
cd /opt/fidelize
git pull origin main
docker compose up -d --build
docker system prune -f
echo "Deploy concluído em $(date)"
```

Torne executável: `chmod +x deploy.sh`

---

## Fase 4 — Cron Jobs (pg_cron)

Todo o script SQL está em [`docs/pg_cron-setup.sql`](./pg_cron-setup.sql).

**Como aplicar:**

1. Abra o **SQL Editor** do seu Supabase novo
2. Cole o conteúdo de `pg_cron-setup.sql`
3. Execute — todos os 6 jobs ficam ativos imediatamente

**Verificar jobs ativos:**
```sql
SELECT jobname, schedule, active FROM cron.job;
```

**Ver histórico de execuções:**
```sql
SELECT jobname, status, start_time, end_time
FROM cron.job_run_details
ORDER BY start_time DESC LIMIT 20;
```

---

## Fase 5 — Google OAuth próprio (opcional)

Se quiser botão "Entrar com Google" na sua VPS (o Fidelize também funciona só com WhatsApp/email):

1. Acesse [console.cloud.google.com](https://console.cloud.google.com) → **Novo projeto**
2. Menu → **APIs & Services → OAuth consent screen** → tipo **External** → publicar
3. **APIs & Services → Credentials → Create Credentials → OAuth Client ID**
   - Application type: **Web application**
   - Authorized redirect URIs:
     ```
     https://xxxxx.supabase.co/auth/v1/callback
     ```
4. Copie **Client ID** e **Client Secret**
5. No dashboard Supabase próprio: **Authentication → Providers → Google** → cole as credenciais e ative
6. No app, o `signInWithOAuth('google')` já funciona sem mudar código

---

## Troubleshooting

### Container reinicia em loop
```bash
docker compose logs fidelize --tail 100
```
Comum: variável de ambiente faltando. Verifique `.env.production`.

### 502 Bad Gateway no Nginx
- Confirme container rodando: `docker ps`
- Confirme porta: `curl http://127.0.0.1:3000`
- Confirme Nginx: `sudo nginx -t`

### Certbot falha
- Confirme DNS apontando pro IP correto: `dig seudominio.com`
- Confirme porta 80 aberta: `sudo ufw status`

### Push notifications não chegam
- Regere VAPID keys: `npx web-push generate-vapid-keys`
- Cole no `.env.production`, restart container
- Clientes precisam re-ativar notificações (chaves novas invalidam subscriptions antigas)

### Cron não executa
```sql
-- Verifique extensões
SELECT extname FROM pg_extension WHERE extname IN ('pg_cron','pg_net');

-- Verifique falhas recentes
SELECT * FROM cron.job_run_details
WHERE status = 'failed'
ORDER BY start_time DESC LIMIT 10;
```

### Emails não são enviados
- Confirme `RESEND_API_KEY` válido no `.env.production`
- Verifique domínio verificado em [resend.com/domains](https://resend.com/domains)
- Confira logs em `admin/emails` no painel

---

## Diagnóstico Final

| Componente | Antes | Depois |
|---|---|---|
| Banco de dados | Lovable Cloud | Supabase próprio |
| Auth | Lovable Cloud | Supabase próprio |
| Storage | Lovable Cloud | Supabase próprio |
| IA Chat (Fidê) | Lovable Gateway | **Gemini direto** (fallback Lovable) |
| IA Voz | Lovable Gateway | **Web Speech API nativa** (100% browser) |
| E-mails | Lovable (Resend) | Resend próprio |
| Pagamentos | Já independente | Já independente |
| Google OAuth | Lovable gerenciado | Google Cloud próprio (opcional) |
| Cron/Automação | Lovable | pg_cron no seu Supabase |
| Hospedagem | Lovable | VPS + Docker + Nginx |

**Independência final: 100%** — nenhum runtime obrigatório da Lovable.

**Custo estimado mensal:**
- VPS 4GB (Contabo/Hetzner): ~$6-10
- Supabase Pro (se ultrapassar free tier): $25
- Domínio: ~$10/ano
- Total: **$10-40/mês** para operação completa
