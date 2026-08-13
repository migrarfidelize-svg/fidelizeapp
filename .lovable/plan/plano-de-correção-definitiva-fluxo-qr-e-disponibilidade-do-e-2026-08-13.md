# Plano de Correção Definitiva — Fluxo QR e Disponibilidade do Estabelecimento

O problema de "Estabelecimento indisponível" em estabelecimentos ativos ocorre devido a inconsistências na resolução de lookup e RLS em rotas públicas. A migração recente removeu a política `est_public_read` em favor de uma View, mas várias rotas e funções ainda consultam a tabela `establishments` diretamente via cliente público (sujeito a RLS) ou via `supabaseAdmin` sem validar o campo `active`.

## Diagnóstico
1.  **RLS vs. Tabela Direta**: `listPublicPromotionsBySlug` (usada pela rota `/e/$slug`) usa o cliente público na tabela `establishments`. Como a política pública foi removida, a query retorna `null` para qualquer usuário não autenticado, resultando em "indisponível".
2.  **Falta de Validação 'active'**: `getPublicReviewForm` e os redirecionadores de QR (`/api/public/r/qr/...` e `/api/public/r/t/...`) usam `supabaseAdmin` para contornar o RLS, mas não filtram/validam explicitamente se o estabelecimento está ativo antes de processar o redirecionamento ou carregar o formulário.
3.  **Fidelize Landing vs. Discovery**: O fluxo do QR aponta para caminhos que dependem de resoluções diferentes. Se uma resolução falha ou cai em um fallback incorreto, o usuário vê a tela de erro.

## Alterações Propostas

### 1. Núcleo de Resolução (Server-side)
- **`src/lib/promotions.functions.ts`**: Alterar `listPublicPromotionsBySlug` para usar `view_establishments` (que já filtra `active = true`) em vez da tabela protegida.
- **`src/lib/public-reviews.functions.ts`**: Atualizar `getPublicReviewForm` para validar `est.active` logo após o fetch inicial via `supabaseAdmin`.
- **`src/lib/qr-target.server.ts`**: Adicionar validação de `active` no `resolveQrTarget` ou garantir que o chamador valide.

### 2. Rotas de Redirecionamento (Webhooks/API)
- **`src/routes/api/public/r/qr/$slug/$dest.ts`**: Buscar o campo `active` e interromper com 404 se inativo.
- **`src/routes/api/public/r/t/$code.ts`**: Já possui validação de `tag.active`, mas deve garantir que o `establishments(active)` também seja verificado.

### 3. Melhoria na Experiência do Usuário (UI)
- **`src/routes/e.$slug.tsx`**: Diferenciar mensagens de "Não encontrado" (404 real) vs "Inativo".
- **`src/routes/cartao.$slug.tsx`**: Garantir que o loader use o novo padrão de busca segura.

## Plano Técnico
1.  **Ajustar `listPublicPromotionsBySlug`**: Trocar `.from("establishments")` por `.from("view_establishments")`.
2.  **Ajustar `getPublicReviewForm`**: Adicionar `active` no select e `if (!est.active) return null`.
3.  **Ajustar `resolveQrTarget`**: Adicionar parâmetro `active` e retornar erro específico se inativo.
4.  **Ajustar Redirects**: Garantir que buscam `active` via `supabaseAdmin` e validam antes do 302.
5.  **Testes**: Atualizar `src/lib/diagnostic_qr.test.ts` para cobrir o campo `active`.

A implementação preservará a compatibilidade com QRs antigos, pois a lógica de resolução de slug/code permanece intacta, apenas a camada de segurança e validação de disponibilidade será corrigida.
