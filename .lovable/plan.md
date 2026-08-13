# Plano de Auditoria e Correção: Resolução de QR, Estabelecimento e Carteira

O objetivo deste plano é garantir que o fluxo de acesso via QR Code (Discovery, Landing de Cadastro e Carteira) diferencie corretamente os estados de erro (Não Encontrado vs. Inativo vs. Erro de Banco) e que a persistência do `establishment_id` seja mantida em todas as etapas de criação de clientes e cartões, evitando a mensagem "Estabelecimento indisponível" para negócios ativos.

## 1. Auditoria e Correção das Server Functions

### listPublicPromotionsBySlug (src/lib/promotions.functions.ts)
*   **Correção:** Capturar o `error` da query `maybeSingle()`.
*   **Diferenciação:**
    *   Se `error`: Logar no servidor e lançar `DATABASE_ERROR`.
    *   Se `!est`: Retornar status `NOT_FOUND`.
    *   Se `!est.active`: Retornar status `INACTIVE`.

### getEstablishmentBySlug (src/lib/loyalty.functions.ts)
*   **Correção:** Remover o filtro `active = true` da query SQL inicial para permitir a diferenciação no servidor.
*   **Lógica de Retorno:**
    *   Se `error`: Lançar erro de banco.
    *   Se `!est`: Lançar `NOT_FOUND`.
    *   Se `!est.active`: Lançar `INACTIVE`.

## 2. Unificação da UI de Erro (src/routes/e.$slug.tsx)

*   **Implementação:** Criar componentes de estado distintos para cada erro retornado pelo loader.
*   **Estados:**
    *   **NOT_FOUND:** "Estabelecimento não encontrado" (404).
    *   **INACTIVE:** "Estabelecimento indisponível - Este estabelecimento não está mais ativo na Fidelize."
    *   **DATABASE_ERROR:** "Não foi possível carregar o estabelecimento no momento."

## 3. Correção do Fluxo /cartao/:slug (src/routes/cartao.$slug.tsx)

*   **Diagnóstico:** O erro ocorre no `beforeLoad` ou no `loader` ao tentar resolver o estabelecimento ou vincular a conta logada.
*   **Correção:**
    *   Garantir que `attachEstablishmentBySlug` e `getEstablishmentBySlug` usem as novas Server Functions com diferenciação de erro.
    *   No `beforeLoad`, capturar especificamente `AttachEstablishmentError` e redirecionar com a mensagem correta via `sessionStorage`.

## 4. Integridade da Carteira (src/lib/my-wallet.functions.ts)

*   **Auditoria:** Verificar se `findOrphanByPhone` e `createCustomer` estão sempre escopados ao `establishment_id` resolvido.
*   **Garantia:** Impedir buscas globais por telefone/email que possam misturar clientes de diferentes estabelecimentos (multi-tenant).

## 5. Testes Automatizados (Novo arquivo: src/lib/crm/__tests__/qr-resolution-audit.test.ts)

Implementar testes para os 15 cenários exigidos:
1.  `active=true` em `/cartao/:slug` deve prosseguir.
2.  `active=false` deve mostrar `INACTIVE`.
3.  Slug inexistente deve mostrar `NOT_FOUND`.
4.  Erro de banco deve mostrar `DATABASE_ERROR`.
5.  ... (demais cenários de cliente novo/existente, redirecionamentos e mobile).

---

## Detalhes Técnicos (Para o Desenvolvedor)

*   **View Pública:** A view `public.view_establishments` é `SECURITY INVOKER` (padrão) e tem `GRANT SELECT` para `anon`. No entanto, como as Server Functions rodam com `supabaseAdmin` (Service Role), elas ignoram as políticas de RLS e a view, acessando diretamente a tabela base para poderem diferenciar o estado `active = false`.
*   **Tratamento de Erros:** Usar códigos de erro padronizados no retorno das Server Functions para que a UI possa reagir sem depender de strings de mensagem.
*   **Idempotência:** Manter o uso do `idempotency_key` no `attachEstablishmentCore` para evitar duplicidade em cliques rápidos ou reloads.
