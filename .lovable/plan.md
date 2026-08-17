# Redesign do Fluxo OTP Fidelize

Redesenhar a etapa de confirmação do OTP para uma experiência premium, moderna e sofisticada, mantendo a integridade funcional do backend.

## UI/UX & Design
- Substituir o input básico de 6 dígitos por 6 blocos individuais premium.
- Implementar estados visuais claros: Empty, Focused, Filled, Verifying, Success (Verde elegante), Error (Vermelho suave + Shake).
- Melhorar a hierarquia visual das informações (Telefone, Reenviar código, Alterar número).
- Criar um botão principal real com estados de carregamento e confirmação.

## Animações (Framer Motion)
- **Decifrando**: Animação 3D de rotação nos blocos com alternância rápida de números ao completar os 6 dígitos.
- **Transição de Sucesso**: Efeito sequencial em verde com ícone de check.
- **Feedback de Erro**: Animação de shake horizontal quando o código for inválido.

## Interatividade Inteligente
- Auto-advance e backspace entre os blocos.
- Suporte a "Colar" (paste) com extração automática de dígitos.
- Auto-submit após preenchimento total (manual ou por colagem).
- Otimização para teclados móveis (`inputMode="numeric"`, `one-time-code`).

## Detalhes Técnicos
- Utilizar `input-otp` para a lógica de entrada.
- Garantir acessibilidade (foco por teclado, ARIA labels).
- Preservar toda a lógica de autenticação e comunicação com o backend existente.

## Verificação
- Testar fluxo completo de digitação manual e colagem.
- Validar estados de erro (shake) e sucesso (animação verde).
- Conferir responsividade em dispositivos mobile (320px+).
