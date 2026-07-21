# Testes RLS — Fidelize

Suite de segurança que verifica isolamento entre os três perfis:

| Perfil | Pode | Não pode |
|--------|------|----------|
| **customer** | Ler os próprios `customers`, cartões e carimbos | Ler outros clientes, inserir stamps, ler `establishment_members`, ler `profiles_account_type_backup` |
| **staff** (funcionário) | Ler clientes/carimbos do próprio estabelecimento, adicionar carimbos | Ler dados de outro estabelecimento, alterar `establishments` |
| **owner** (dono) | Tudo do próprio estabelecimento + configurações | Enxergar qualquer dado (clientes, membros, campanhas) de outro estabelecimento |

## Executar

```bash
export SUPABASE_URL=https://<seu-projeto>.supabase.co
export SUPABASE_ANON_KEY=sb_publishable_...
export SUPABASE_SERVICE_ROLE_KEY=sb_secret_...   # apenas em CI/local; NUNCA no cliente

bunx vitest run tests/rls/rls-matrix.spec.ts
```

Sem as três variáveis definidas, a suite é automaticamente pulada (`describe.skip`).

## O que o suite cobre

- Cria 4 usuários efêmeros (ownerA, staffA, ownerB, customer) + 2 estabelecimentos.
- Faz **login real** com cada perfil (via `signInWithPassword`) — ou seja, executa as queries **com o JWT do usuário**, exercitando as políticas RLS de verdade.
- Cada `it()` afirma uma garantia da matriz acima.
- No `afterAll`, remove todos os artefatos criados.

## Migração relacionada

A migração `2026-07-21_ambiguous_users` normaliza usuários históricos que ainda ficavam presos em `/app` depois do novo guard, com:

- **Backup** em `public.profiles_account_type_backup` (RLS: apenas super_admin lê).
- **Rollback** documentado no rodapé da própria migração.
- **Trilha** em `audit_logs` (`action = 'migration.normalize_account_type'`).
