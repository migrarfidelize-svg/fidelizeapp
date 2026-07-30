insert into public.establishments (slug, name, segment, plan, city, state, created_by, phone, whatsapp, description)
values ('fidelize-testes','Fidelize Testes','restaurante','pro','Salvador','BA','c7fd0e83-424e-40ec-8c28-48d4998e58a0','7130000000','5571990000000','Estabelecimento de testes internos.')
on conflict (slug) do nothing;

insert into public.establishment_members (establishment_id, user_id, role, active, display_name)
select e.id, 'c7fd0e83-424e-40ec-8c28-48d4998e58a0', 'owner', true, 'Admin Teste'
from public.establishments e where e.slug='fidelize-testes'
on conflict do nothing;