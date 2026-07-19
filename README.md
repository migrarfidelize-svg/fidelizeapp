# Fidelize

SaaS de cartão fidelidade digital para pequenos e médios negócios. Stack:
TanStack Start (React 19, Vite 7) + Tailwind v4 + Lovable Cloud (Supabase).

## Desenvolvimento

```bash
bun install
cp .env.example .env    # preencha os valores de dev
bun run dev             # http://localhost:8080
bun run build           # build de produção
bun run test            # vitest
bun run test:e2e        # playwright
```

## Variáveis de ambiente

Todas as variáveis são carregadas de `.env` (dev) ou dos **Secrets do painel Lovable**
(prod). O arquivo [`.env.example`](./.env.example) lista os nomes suportados.

### Públicas (browser + servidor)

Prefixadas com `VITE_*` para ficarem disponíveis via `import.meta.env`.
Só coloque aqui valores **publishable/anon** — nada sensível.

| Nome | Descrição |
| --- | --- |
| `VITE_SUPABASE_URL` / `SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY` | Chave publishable |
| `VITE_SUPABASE_PROJECT_ID` / `SUPABASE_PROJECT_ID` | ID do projeto |
| `PUBLIC_APP_URL` (ou `APP_URL` / `VITE_APP_URL`) | URL pública da aplicação, usada em links de e-mail, redirects e webhooks. Consultada por `getPublicAppUrl()` em `src/lib/app-url.ts` |

### Secrets de runtime (apenas servidor)

Configuradas pelo painel Lovable (Backend → Secrets). **Nunca commitar valores reais**
e nunca prefixar com `VITE_` — ficariam expostas ao browser.

| Nome | Uso |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Cliente admin (bypassa RLS). Gerenciada pela plataforma |
| `LOVABLE_API_KEY` | AI Gateway e conectores. Gerenciada pela plataforma |
| `RESEND_API_KEY` | E-mails transacionais |
| `MERCADOPAGO_ACCESS_TOKEN` | Assinaturas / cobranças |
| `MERCADOPAGO_WEBHOOK_SECRET` | Verificação HMAC do webhook Mercado Pago |
| `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`, `APPLE_PASS_CERT_PEM`, `APPLE_PASS_KEY_PEM`, `APPLE_WWDR_PEM` | Assinatura de `.pkpass` (Apple Wallet) |
| `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON` | Google Wallet |
| `SENTRY_DSN` | Observabilidade opcional |

### Regras

1. `.env` está em `.gitignore` — nunca faça commit dele.
2. URLs específicas do ambiente (domínio de preview, produção) **não** ficam no código:
   use `getPublicAppUrl()` para construir links absolutos.
3. Chaves de terceiros (Resend, Mercado Pago, Apple, Google) são lidas com
   `process.env.NOME` **dentro do handler** de uma server function — nunca em
   escopo de módulo, pois seriam avaliadas no bundle do cliente.
4. Publishable/anon do Supabase são seguras no bundle. Service role, tokens de
   provedores e certificados **nunca** podem ser lidos no cliente.
