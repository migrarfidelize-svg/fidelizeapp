update public.landing_content
set data = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(data, '{copy,badge}', '"1 plataforma · 13 ferramentas de retenção, vendas e entrega"'::jsonb, true),
      '{copy,titlePrefix}', '"Fidelize, venda e entregue no"'::jsonb, true),
    '{copy,titleHighlight}', '"mesmo painel"'::jsonb, true),
  '{copy,subtitle}', '"Cartão fidelidade, cardápio em stories, catálogo, pedidos, entregas rastreadas com entregador, WhatsApp, avaliações, CRM e campanhas. Tudo conectado — sem app, sem cartão de papel, sem dez assinaturas."'::jsonb, true),
    updated_at = now()
where key = 'hero';