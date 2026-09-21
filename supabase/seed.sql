-- ---------------------------------------------------------------------------
-- GLOWA demo content
--
-- Every row here is marked `is_demo = true` and every business slug starts
-- with `demo-`, so demo data can be filtered out of any production query with
-- one predicate and deleted with one statement. These salons are invented:
-- nothing in this file is a real customer, and no traction, revenue or review
-- count anywhere in the product may be derived from it.
--
-- Re-runnable: every insert is keyed on a fixed UUID with `on conflict do nothing`.
-- Remove with:  delete from public.businesses where is_demo;
-- ---------------------------------------------------------------------------

insert into public.businesses (
  id, slug, name, description, short_pitch, category, currency, timezone,
  default_locale, status, is_demo, google_review_url
) values
  (
    '11111111-1111-4111-8111-111111111101',
    'demo-hair-lab-sofia',
    'Hair Lab Sofia',
    jsonb_build_object(
      'bg', 'Студио за коса в центъра на София с фокус върху цвят, грижа и прецизно подстригване.',
      'en', 'A hair studio in central Sofia focused on colour, care and precise cutting.',
      'ro', 'Un studio de coafură în centrul Sofiei, axat pe culoare, îngrijire și tunsori precise.'
    ),
    jsonb_build_object('bg', 'Цвят и грижа за косата', 'en', 'Colour and hair care', 'ro', 'Culoare și îngrijirea părului'),
    'hair_salon', 'BGN', 'Europe/Sofia', 'bg', 'active', true, null
  ),
  (
    '11111111-1111-4111-8111-111111111102',
    'demo-black-scissors',
    'Black Scissors Barbershop',
    jsonb_build_object(
      'bg', 'Класически барбършоп с модерно отношение. Подстригване, брада и гореща кърпа.',
      'en', 'A classic barbershop with a modern attitude. Cuts, beards and hot towels.',
      'ro', 'O frizerie clasică cu o atitudine modernă. Tunsori, barbă și prosop cald.'
    ),
    jsonb_build_object('bg', 'Барбършоп в София', 'en', 'Barbershop in Sofia', 'ro', 'Frizerie în Sofia'),
    'barbershop', 'BGN', 'Europe/Sofia', 'bg', 'active', true, null
  ),
  (
    '11111111-1111-4111-8111-111111111103',
    'demo-bloom-nails',
    'Bloom Nails & More',
    jsonb_build_object(
      'bg', 'Нокти, дизайн и грижа в спокойна атмосфера в Пловдив.',
      'en', 'Nails, design and care in a calm Plovdiv studio.',
      'ro', 'Unghii, design și îngrijire într-un studio liniștit din Plovdiv.'
    ),
    jsonb_build_object('bg', 'Ноктопластика и дизайн', 'en', 'Nail art and care', 'ro', 'Manichiură și design'),
    'nail_studio', 'BGN', 'Europe/Sofia', 'bg', 'active', true, null
  )
on conflict (id) do nothing;

insert into public.locations (
  id, business_id, name, address_line1, city, postal_code, country_code,
  timezone, is_primary, is_active
) values
  ('11111111-1111-4111-8111-111111111201', '11111111-1111-4111-8111-111111111101',
   'Hair Lab · Център', 'ул. Гурко 24', 'София', '1000', 'BG', 'Europe/Sofia', true, true),
  ('11111111-1111-4111-8111-111111111202', '11111111-1111-4111-8111-111111111102',
   'Black Scissors · Лозенец', 'бул. Черни връх 41', 'София', '1407', 'BG', 'Europe/Sofia', true, true),
  ('11111111-1111-4111-8111-111111111203', '11111111-1111-4111-8111-111111111103',
   'Bloom Nails · Кършияка', 'ул. Пловдив 12', 'Пловдив', '4003', 'BG', 'Europe/Sofia', true, true)
on conflict (id) do nothing;

-- Tuesday to Saturday, 09:00-19:00 (Saturday to 17:00).
insert into public.business_hours (location_id, day_of_week, opens_at, closes_at)
select l.id, d.day_of_week, d.opens_at, d.closes_at
from public.locations l
cross join (values
  (2, time '09:00', time '19:00'),
  (3, time '09:00', time '19:00'),
  (4, time '09:00', time '19:00'),
  (5, time '09:00', time '19:00'),
  (6, time '09:00', time '17:00')
) as d(day_of_week, opens_at, closes_at)
where l.id in (
  '11111111-1111-4111-8111-111111111201',
  '11111111-1111-4111-8111-111111111202',
  '11111111-1111-4111-8111-111111111203'
)
and not exists (
  select 1 from public.business_hours bh
  where bh.location_id = l.id and bh.day_of_week = d.day_of_week
);

insert into public.staff_profiles (
  id, business_id, display_name, title, color, is_bookable, sort_order
) values
  ('11111111-1111-4111-8111-111111111301', '11111111-1111-4111-8111-111111111101', 'Ники',
   jsonb_build_object('bg', 'Колорист', 'en', 'Colourist', 'ro', 'Colorist'), '#D96C61', true, 1),
  ('11111111-1111-4111-8111-111111111302', '11111111-1111-4111-8111-111111111101', 'Мария',
   jsonb_build_object('bg', 'Стилист', 'en', 'Stylist', 'ro', 'Stilist'), '#A9B6A6', true, 2),
  ('11111111-1111-4111-8111-111111111303', '11111111-1111-4111-8111-111111111102', 'Георги',
   jsonb_build_object('bg', 'Барбър', 'en', 'Barber', 'ro', 'Frizer'), '#0F1212', true, 1),
  ('11111111-1111-4111-8111-111111111304', '11111111-1111-4111-8111-111111111103', 'Елена',
   jsonb_build_object('bg', 'Маникюрист', 'en', 'Nail artist', 'ro', 'Tehnician unghii'), '#EAC2BB', true, 1)
on conflict (id) do nothing;

insert into public.staff_working_hours (staff_profile_id, location_id, day_of_week, starts_at, ends_at)
select s.id, l.id, d.day_of_week, time '09:00', time '18:00'
from public.staff_profiles s
join public.locations l on l.business_id = s.business_id and l.is_primary
cross join (values (2), (3), (4), (5), (6)) as d(day_of_week)
where s.business_id in (
  '11111111-1111-4111-8111-111111111101',
  '11111111-1111-4111-8111-111111111102',
  '11111111-1111-4111-8111-111111111103'
)
and not exists (
  select 1 from public.staff_working_hours swh
  where swh.staff_profile_id = s.id and swh.day_of_week = d.day_of_week
);

insert into public.services (
  id, business_id, name, description, category, duration_minutes,
  price_cents, currency, is_active, sort_order
) values
  ('11111111-1111-4111-8111-111111111401', '11111111-1111-4111-8111-111111111101',
   jsonb_build_object('bg', 'Подстригване и оформяне', 'en', 'Cut and finish', 'ro', 'Tuns și styling'),
   jsonb_build_object('bg', 'Консултация, измиване, подстригване и сешоар.', 'en', 'Consultation, wash, cut and blow-dry.', 'ro', 'Consultație, spălat, tuns și coafat.'),
   'hair', 60, 6000, 'BGN', true, 1),
  ('11111111-1111-4111-8111-111111111402', '11111111-1111-4111-8111-111111111101',
   jsonb_build_object('bg', 'Боядисване на корени', 'en', 'Root colour', 'ro', 'Vopsit rădăcini'),
   jsonb_build_object('bg', 'Освежаване на цвета при корените.', 'en', 'Refreshing the colour at the roots.', 'ro', 'Împrospătarea culorii la rădăcini.'),
   'hair', 90, 9000, 'BGN', true, 2),
  ('11111111-1111-4111-8111-111111111403', '11111111-1111-4111-8111-111111111102',
   jsonb_build_object('bg', 'Мъжко подстригване', 'en', 'Men''s haircut', 'ro', 'Tuns bărbați'),
   jsonb_build_object('bg', 'Машинка, ножица и финално оформяне.', 'en', 'Clipper, scissor work and finish.', 'ro', 'Mașină, foarfecă și finisaj.'),
   'barber', 45, 4000, 'BGN', true, 1),
  ('11111111-1111-4111-8111-111111111404', '11111111-1111-4111-8111-111111111102',
   jsonb_build_object('bg', 'Брада с гореща кърпа', 'en', 'Beard with hot towel', 'ro', 'Barbă cu prosop cald'),
   jsonb_build_object('bg', 'Оформяне на брада, гореща кърпа и балсам.', 'en', 'Beard shaping, hot towel and balm.', 'ro', 'Conturarea bărbii, prosop cald și balsam.'),
   'barber', 30, 3000, 'BGN', true, 2),
  ('11111111-1111-4111-8111-111111111405', '11111111-1111-4111-8111-111111111103',
   jsonb_build_object('bg', 'Маникюр с гел лак', 'en', 'Gel manicure', 'ro', 'Manichiură cu gel'),
   jsonb_build_object('bg', 'Подготовка, гел лак и грижа за кожичките.', 'en', 'Prep, gel polish and cuticle care.', 'ro', 'Pregătire, oja gel și îngrijirea cuticulelor.'),
   'nails', 75, 5500, 'BGN', true, 1)
on conflict (id) do nothing;

insert into public.service_staff (service_id, staff_profile_id)
select s.id, sp.id
from public.services s
join public.staff_profiles sp on sp.business_id = s.business_id
where s.id in (
  '11111111-1111-4111-8111-111111111401',
  '11111111-1111-4111-8111-111111111402',
  '11111111-1111-4111-8111-111111111403',
  '11111111-1111-4111-8111-111111111404',
  '11111111-1111-4111-8111-111111111405'
)
on conflict do nothing;
