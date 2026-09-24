-- ---------------------------------------------------------------------------
-- GLOWA · showcase salon (development projects only)
--
-- Turns the business an account already owns into a fully furnished salon, so
-- the product can be judged the way a salon owner would see it: a real-looking
-- page, a team with faces, a service menu, eight weeks of history and two of
-- bookings ahead, reviews with replies, deposits in every state.
--
-- Usage (SQL editor or MCP, never production):
--
--   select set_config('glowa.showcase_email', '<account email>', false);
--   -- then run this file
--
-- How it writes matters as much as what it writes. The business, location,
-- team, services, appointments, growth link, campaign and review replies are
-- written *as the owner* - `role authenticated` with their JWT claims - so
-- they pass through exactly the RLS policies and triggers the app's server
-- actions hit: the CRM builds itself from the appointments, the booking
-- guard runs, the growth-link code is assigned by its trigger, a review reply
-- is stamped by the review edit guard. Only what no client may ever write -
-- reviews by other people, deposits and payment records - is written with
-- the service role, the way the payment path and customers would.
--
-- Everything invented is `is_demo = true` and the business is slugged `demo-`.
-- Demo appointments send no notifications (the outbox trigger skips them).
-- Photographs: `public/brand/showcase/`, generated - see docs/visual-assets.md.
--
-- Not re-runnable over itself: it stops if the showcase team already exists.
-- Remove with the block at the bottom of this file.
-- ---------------------------------------------------------------------------

do $showcase$
declare
  v_email text := current_setting('glowa.showcase_email', true);
  v_uid uuid;
  v_biz uuid;
  v_loc uuid;
  v_owner uuid;
  v_s1 uuid; v_s2 uuid; v_s3 uuid; v_s4 uuid;
  v_staff uuid[];
  v_svc uuid[] := '{}';
  v_id uuid;
  v_today date := (now() at time zone 'Europe/Sofia')::date;
  v_day integer;
  v_date date;
  v_dow integer;
  v_member integer;
  v_window record;
  v_minute integer;
  v_end_minute integer;
  v_occupancy numeric;
  v_pick record;
  v_starts timestamptz;
  v_ends timestamptz;
  v_status public.appointment_status;
  v_source public.appointment_source;
  v_client integer;
  v_roll numeric;
  v_names text[] := array[
    'Александра Николова', 'Виктория Георгиева', 'Габриела Тодорова',
    'Деница Илиева', 'Елена Маринова', 'Жана Попова', 'Златина Христова',
    'Ирина Стефанова', 'Йоана Димова', 'Калина Ангелова', 'Лора Василева',
    'Мирела Костова', 'Надя Петкова', 'Павлина Русева', 'Радост Колева',
    'Симона Янева', 'Теодора Иванова', 'Цветелина Бонева', 'Яна Михайлова',
    'Борислав Стоев', 'Георги Атанасов', 'Мартин Кирилов', 'Никола Цветков',
    'Петя Славова', 'Даниела Борисова', 'Весела Грозева'
  ];
  -- example.com is reserved (RFC 2606): nothing sent to it can reach anyone.
  v_emails text[] := array[
    'aleksandra.nikolova@example.com', 'viktoria.georgieva@example.com',
    'gabriela.todorova@example.com', 'denitsa.ilieva@example.com',
    'elena.marinova@example.com', null, 'zlatina.hristova@example.com',
    'irina.stefanova@example.com', 'yoana.dimova@example.com',
    'kalina.angelova@example.com', 'lora.vasileva@example.com', null,
    'nadya.petkova@example.com', 'pavlina.ruseva@example.com',
    'radost.koleva@example.com', 'simona.yaneva@example.com',
    'teodora.ivanova@example.com', 'tsvetelina.boneva@example.com',
    'yana.mihaylova@example.com', 'borislav.stoev@example.com', null,
    'martin.kirilov@example.com', 'nikola.tsvetkov@example.com',
    'petya.slavova@example.com', 'daniela.borisova@example.com', null
  ];
  v_comments text[] := array[
    'Най-добрият балеаж, който съм имала. Стилистката слуша какво искаш и после прави още по-хубаво.',
    'Уютно, спокойно и точно навреме. Излязох с коса като от реклама.',
    'Колористът е магьосник с цвета. Най-накрая тон, който не избледнява за седмица.',
    'Подстригването е прецизно, а сешоарът държа три дни. Връщам се със сигурност.',
    'Много приятна атмосфера и страхотно кафе. Екипът е изключително внимателен.',
    'Веждите ми никога не са изглеждали толкова естествено. Благодаря!',
    'Записах се онлайн за минута, получих напомняне и всичко беше точно.',
    'Кератинът промени косата ми. Мека, лъскава и лесна за оформяне.',
    'Професионалисти. Обясниха ми как да поддържам цвета у дома.',
    'Булчинската прическа издържа цяла нощ танци. Безупречно.',
    'Чисто, красиво място и хора, които обичат работата си.',
    'Малко чакане на входа, но резултатът си заслужаваше.',
    'Идеалното място за освежаване преди важна среща.',
    'Ламинирането на мигли е най-доброто решение за сутрините ми.',
    'Мъжко подстригване без излишни приказки и с отличен резултат.',
    'Обичам, че депозитът се връща автоматично, когато се наложи да отложа.',
    'Страхотен резултат, но бих искала по-ранни часове в събота.',
    'Всеки път излизам с усмивка. Препоръчвам на всички приятелки.'
  ];
  v_replies text[] := array[
    'Благодарим ти! Радваме се, че си доволна - до скоро!',
    'Много благодарим за милите думи. Чакаме те отново.',
    'Благодарим за отзива! Предадохме думите ти на екипа.',
    'Благодарим! Добавихме още съботни часове от следващия месец.'
  ];
  v_ratings integer[] := array[5,5,5,5,5,5,5,5,5,5,5,4,5,5,5,5,4,5];
begin
  if coalesce(v_email, '') = '' then
    raise exception 'Set glowa.showcase_email first';
  end if;

  select u.id into v_uid from auth.users u where lower(u.email) = lower(v_email);
  if v_uid is null then
    raise exception 'No account for %', v_email;
  end if;

  select m.business_id into v_biz
  from public.business_members m
  where m.profile_id = v_uid and m.role = 'owner' and m.status = 'active'
  order by m.created_at
  limit 1;

  if v_biz is not null and exists (
    select 1 from public.staff_profiles s
    where s.business_id = v_biz and s.avatar_url like '/brand/showcase/%'
  ) then
    raise notice 'Showcase already seeded for %; nothing to do.', v_email;
    return;
  end if;

  perform setseed(0.4242);

  -- ---- as the owner, through RLS ------------------------------------------
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated', 'email', v_email)::text,
    true
  );
  execute 'set local role authenticated';

  if v_biz is null then
    -- The onboarding endpoint itself.
    select (public.create_business(
      'Ivanov Atelier', 'hair_salon', 'София', null, null,
      'Europe/Sofia', 'EUR', 'bg'
    )).id into v_biz;
  end if;

  update public.businesses set
    name = 'Ivanov Atelier',
    category = 'hair_salon',
    short_pitch = jsonb_build_object(
      'bg', 'Цвят, форма и грижа в светло ателие в Лозенец.',
      'en', 'Colour, cut and care in a light-filled Lozenets atelier.',
      'ro', 'Culoare, tunsoare și îngrijire într-un atelier luminos din Lozenets.'
    ),
    description = jsonb_build_object(
      'bg', E'Ivanov Atelier е малко ателие за коса и красота с високи тавани, много светлина и екип, който обича детайла.\n\nСпециализираме се в естествени балеажи, прецизни подстригвания и грижа, която прави косата по-здрава с всяко посещение. Работим само с веган продукти и отделяме време да разберем какво всъщност искаш.',
      'en', E'Ivanov Atelier is a small hair and beauty atelier with high ceilings, a lot of light and a team that loves detail.\n\nWe specialise in natural balayage, precise cuts and care that leaves hair healthier with every visit. We use vegan products only and take the time to understand what you actually want.',
      'ro', E'Ivanov Atelier este un mic atelier de păr și frumusețe, cu tavane înalte, multă lumină și o echipă care iubește detaliile.\n\nNe specializăm în balayage natural, tunsori precise și îngrijire care face părul mai sănătos cu fiecare vizită. Folosim doar produse vegane și ne facem timp să înțelegem ce îți dorești cu adevărat.'
    ),
    cover_image_url = '/brand/showcase/showcase-cover.webp',
    gallery = jsonb_build_array(
      '/brand/showcase/showcase-gallery-1.webp', '/brand/showcase/showcase-gallery-2.webp',
      '/brand/showcase/showcase-gallery-4.webp', '/brand/showcase/showcase-gallery-6.webp',
      '/brand/showcase/showcase-gallery-3.webp', '/brand/showcase/showcase-gallery-5.webp'
    ),
    booking_policy = jsonb_build_object(
      'min_lead_minutes', 60, 'max_advance_days', 90,
      'cancellation_window_hours', 24, 'allow_customer_reschedule', true
    ),
    status = 'active'
  where id = v_biz;

  select l.id into v_loc from public.locations l
  where l.business_id = v_biz
  order by l.is_primary desc, l.created_at
  limit 1;

  update public.locations set
    name = 'Ivanov Atelier · Лозенец',
    address_line1 = 'ул. „Криволак“ 18',
    city = 'София',
    postal_code = '1164',
    latitude = 42.6760,
    longitude = 23.3226,
    is_primary = true
  where id = v_loc;

  delete from public.business_hours where location_id = v_loc;
  insert into public.business_hours (location_id, day_of_week, opens_at, closes_at)
  select v_loc, d, time '09:00', time '19:00' from generate_series(1, 5) d
  union all select v_loc, 6, time '10:00', time '16:00';

  -- ---- the team ------------------------------------------------------------
  select s.id into v_owner from public.staff_profiles s
  where s.business_id = v_biz and s.member_id is not null
  order by s.created_at
  limit 1;

  update public.staff_profiles set
    display_name = 'Иван Иванов',
    title = jsonb_build_object('bg', 'Основател · стилист', 'en', 'Founder · stylist', 'ro', 'Fondator · stilist'),
    bio = jsonb_build_object(
      'bg', 'Петнадесет години ножица в ръка. Отвори ателието, за да има място, където никой не бърза.',
      'en', 'Fifteen years with scissors in hand. Opened the atelier to have a place where nobody rushes.',
      'ro', 'Cincisprezece ani cu foarfeca în mână. A deschis atelierul pentru a avea un loc unde nimeni nu se grăbește.'
    ),
    color = '#D96C61',
    is_bookable = true,
    sort_order = 0
  where id = v_owner;

  insert into public.staff_profiles (business_id, display_name, title, bio, avatar_url, color, sort_order)
  values (
    v_biz, 'Мария Петрова',
    jsonb_build_object('bg', 'Старши стилист', 'en', 'Senior stylist', 'ro', 'Stilist senior'),
    jsonb_build_object('bg', 'Балеажи, които растат красиво.', 'en', 'Balayage that grows out beautifully.', 'ro', 'Balayage care crește frumos.'),
    '/brand/showcase/showcase-staff-1.webp', '#C8745F', 1
  ) returning id into v_s1;

  insert into public.staff_profiles (business_id, display_name, title, bio, avatar_url, color, sort_order)
  values (
    v_biz, 'Николай Димитров',
    jsonb_build_object('bg', 'Колорист', 'en', 'Colourist', 'ro', 'Colorist'),
    jsonb_build_object('bg', 'Тонове, които не избледняват.', 'en', 'Tones that do not fade.', 'ro', 'Nuanțe care nu se estompează.'),
    '/brand/showcase/showcase-staff-2.webp', '#4F7CA8', 2
  ) returning id into v_s2;

  insert into public.staff_profiles (business_id, display_name, title, bio, avatar_url, color, sort_order)
  values (
    v_biz, 'Ева Стоянова',
    jsonb_build_object('bg', 'Стилист', 'en', 'Stylist', 'ro', 'Stilist'),
    jsonb_build_object('bg', 'Къдрици, вълни и официални прически.', 'en', 'Curls, waves and occasion styling.', 'ro', 'Bucle, valuri și coafuri de ocazie.'),
    '/brand/showcase/showcase-staff-3.webp', '#8E6FB5', 3
  ) returning id into v_s3;

  insert into public.staff_profiles (business_id, display_name, title, bio, avatar_url, color, sort_order)
  values (
    v_biz, 'Десислава Колева',
    jsonb_build_object('bg', 'Вежди и мигли', 'en', 'Brows & lashes', 'ro', 'Sprâncene și gene'),
    jsonb_build_object('bg', 'Естествени вежди, никога нарисувани.', 'en', 'Natural brows, never drawn on.', 'ro', 'Sprâncene naturale, niciodată desenate.'),
    '/brand/showcase/showcase-staff-4.webp', '#5E9A78', 4
  ) returning id into v_s4;

  v_staff := array[v_owner, v_s1, v_s2, v_s3, v_s4];

  delete from public.staff_working_hours where staff_profile_id = any (v_staff);
  insert into public.staff_working_hours (staff_profile_id, location_id, day_of_week, starts_at, ends_at)
  select v_owner, v_loc, d, time '10:00', time '18:00' from generate_series(1, 5) d
  union all select v_s1, v_loc, d, time '09:00', time '17:00' from generate_series(2, 5) d
  union all select v_s1, v_loc, 6, time '10:00', time '16:00'
  union all select v_s2, v_loc, d, time '11:00', time '19:00' from generate_series(1, 5) d
  union all select v_s3, v_loc, d, time '09:00', time '15:00' from unnest(array[1, 3, 4, 5]) d
  union all select v_s3, v_loc, 6, time '10:00', time '16:00'
  union all select v_s4, v_loc, d, time '10:00', time '18:00' from generate_series(1, 5) d;

  -- ---- the service menu ----------------------------------------------------
  update public.services set is_active = false
  where business_id = v_biz and price_cents = 0;

  for v_pick in
    select * from (values
      (1, 'hair', 'Дамско подстригване и оформяне', 'Women''s cut & style', 'Tuns și coafat damă',
       'Консултация, измиване, подстригване и сешоар.', 'Consultation, wash, cut and blow-dry.', 'Consultație, spălat, tuns și uscat.',
       60, 4500, false, 0, 0, array[1, 2, 4]),
      (2, 'hair', 'Мъжко подстригване', 'Men''s cut', 'Tuns bărbați',
       'Подстригване с ножица и машинка, измиване и оформяне.', 'Scissor and clipper cut, wash and finish.', 'Tuns cu foarfeca și mașina, spălat și aranjat.',
       40, 2800, false, 0, 0, array[1, 4]),
      (3, 'hair', 'Балеаж', 'Balayage', 'Balayage',
       'Ръчно рисуван балеаж, тонер и сешоар. Включва консултация за цвета.', 'Hand-painted balayage, toner and blow-dry. Includes a colour consultation.', 'Balayage pictat manual, toner și uscat. Include consultație de culoare.',
       180, 18000, true, 4000, 15, array[2, 3]),
      (4, 'hair', 'Боядисване в един тон', 'Single-process colour', 'Vopsit într-o nuanță',
       'Цвят от корен до връх, грижа и сешоар.', 'Root-to-tip colour, treatment and blow-dry.', 'Culoare de la rădăcină la vârfuri, tratament și uscat.',
       120, 8500, true, 2000, 15, array[2, 3]),
      (5, 'hair', 'Тонер и гланц', 'Toner & gloss', 'Toner și luciu',
       'Освежава цвета и добавя блясък между посещенията.', 'Refreshes colour and adds shine between visits.', 'Împrospătează culoarea și adaugă luciu între vizite.',
       45, 3500, false, 0, 0, array[3]),
      (6, 'hair', 'Кератинова терапия', 'Keratin treatment', 'Tratament cu keratină',
       'Изглажда и подхранва за до три месеца.', 'Smooths and nourishes for up to three months.', 'Netezește și hrănește până la trei luni.',
       150, 14000, true, 3000, 0, array[2, 3]),
      (7, 'hair', 'Официална прическа', 'Occasion styling', 'Coafură de ocazie',
       'Прическа за бал, сватба или специален повод.', 'Styling for a ball, wedding or special occasion.', 'Coafură pentru bal, nuntă sau o ocazie specială.',
       75, 6500, false, 0, 0, array[2, 4]),
      (8, 'hair', 'Сешоар и вълни', 'Blow-dry & waves', 'Uscat și valuri',
       'Измиване и оформяне със сешоар или маша.', 'Wash and style with a blow-dry or tongs.', 'Spălat și aranjat cu foehn sau ondulator.',
       45, 3000, false, 0, 0, array[1, 2, 4]),
      (9, 'lashes_brows', 'Оформяне и ламиниране на вежди', 'Brow shaping & lamination', 'Pensat și laminare sprâncene',
       'Карта на веждите, оформяне, ламиниране и оцветяване.', 'Brow mapping, shaping, lamination and tint.', 'Cartografiere, pensat, laminare și vopsire.',
       50, 3800, false, 0, 0, array[5]),
      (10, 'lashes_brows', 'Ламиниране на мигли', 'Lash lift', 'Laminare gene',
       'Повдигане и оцветяване на естествените мигли.', 'Lift and tint of your natural lashes.', 'Ridicarea și vopsirea genelor naturale.',
       60, 4500, true, 1500, 0, array[5]),
      (11, 'hair', 'Булчински пакет', 'Bridal package', 'Pachet mireasă',
       'Проба и прическа в деня на сватбата.', 'Trial and styling on the wedding day.', 'Probă și coafură în ziua nunții.',
       180, 22000, true, 6000, 0, array[2, 5])
    ) as s(sort, cat, bg, en, ro, dbg, den, dro, minutes, cents, deposit, deposit_cents, buffer, members)
  loop
    insert into public.services (
      business_id, name, description, category, duration_minutes, buffer_after_minutes,
      price_cents, currency, requires_deposit, deposit_cents, is_active, sort_order
    )
    values (
      v_biz,
      jsonb_build_object('bg', v_pick.bg, 'en', v_pick.en, 'ro', v_pick.ro),
      jsonb_build_object('bg', v_pick.dbg, 'en', v_pick.den, 'ro', v_pick.dro),
      v_pick.cat::public.service_category, v_pick.minutes, v_pick.buffer,
      v_pick.cents, 'EUR', v_pick.deposit, v_pick.deposit_cents, true, v_pick.sort
    )
    returning id into v_id;

    v_svc := v_svc || v_id;

    insert into public.service_staff (service_id, staff_profile_id)
    select v_id, v_staff[m] from unnest(v_pick.members) m;
  end loop;

  -- ---- eight weeks behind, two ahead ---------------------------------------
  -- Each stylist's day is walked slot by slot; a visit starts where the last
  -- one ended, so no two overlap and the exclusion constraint never has to
  -- refuse one. Busier in the past than the future, as a real book is.
  for v_day in -56..14 loop
    v_date := v_today + v_day;
    v_dow := extract(dow from v_date)::integer;

    for v_member in 1..array_length(v_staff, 1) loop
      select w.starts_at, w.ends_at into v_window
      from public.staff_working_hours w
      where w.staff_profile_id = v_staff[v_member] and w.day_of_week = v_dow
      limit 1;
      continue when not found;

      v_minute := extract(hour from v_window.starts_at)::integer * 60
        + extract(minute from v_window.starts_at)::integer;
      v_end_minute := extract(hour from v_window.ends_at)::integer * 60
        + extract(minute from v_window.ends_at)::integer;
      v_occupancy := case
        when v_day < 0 then 0.74
        when v_day = 0 then 0.82
        else greatest(0.2, 0.7 - v_day * 0.035)
      end;

      while v_minute + 40 <= v_end_minute loop
        if random() >= v_occupancy then
          v_minute := v_minute + 30;
          continue;
        end if;

        select s.id, s.duration_minutes, s.buffer_after_minutes, s.price_cents, s.name
        into v_pick
        from public.services s
        join public.service_staff ss on ss.service_id = s.id
        where s.business_id = v_biz and s.is_active
          and ss.staff_profile_id = v_staff[v_member]
          and v_minute + s.duration_minutes <= v_end_minute
        order by random()
        limit 1;

        if v_pick.id is null then
          exit;
        end if;

        v_starts := (v_date + make_interval(mins => v_minute)) at time zone 'Europe/Sofia';
        v_ends := v_starts + make_interval(mins => v_pick.duration_minutes);
        v_client := 1 + floor(random() * array_length(v_names, 1))::integer;
        v_roll := random();

        if v_ends < now() then
          v_status := case when v_roll < 0.04 then 'no_show' when v_roll < 0.1 then 'cancelled' else 'completed' end;
        elsif v_starts < now() then
          v_status := 'confirmed';
        else
          v_status := case when v_roll < 0.2 then 'pending' when v_roll < 0.24 then 'cancelled' else 'confirmed' end;
        end if;

        v_roll := random();
        v_source := case when v_roll < 0.58 then 'customer_web' when v_roll < 0.88 then 'business_admin' else 'walk_in' end;

        begin
          insert into public.appointments (
            business_id, location_id, service_id, staff_profile_id,
            customer_name, customer_email,
            service_name_snapshot, price_cents, currency,
            starts_at, ends_at, status, source,
            cancelled_at, cancellation_reason, completed_at,
            is_demo, created_by
          )
          values (
            v_biz, v_loc, v_pick.id, v_staff[v_member],
            v_names[v_client], v_emails[v_client],
            v_pick.name, v_pick.price_cents, 'EUR',
            v_starts, v_ends, v_status, v_source,
            -- A cancellation happened before the visit and never in the future.
            case when v_status = 'cancelled'
              then least(now() - interval '1 hour', v_starts - interval '2 days') end,
            null,
            case when v_status = 'completed' then v_ends end,
            true, v_uid
          );
        exception when exclusion_violation then
          -- Someone was already in that chair (a booking made by hand before
          -- the showcase existed). Leave theirs alone and move on.
          null;
        end;

        v_minute := v_minute + v_pick.duration_minutes + v_pick.buffer_after_minutes
          + (case when random() < 0.3 then 15 else 0 end);
      end loop;
    end loop;
  end loop;

  -- A QR code for the salon's front window, created the way the growth page
  -- creates one: the short code comes from the trigger.
  insert into public.growth_links (business_id, kind, label, target, created_by)
  values
    (v_biz, 'qr', 'Витрина на входа', 'book', v_uid),
    (v_biz, 'qr', 'Визитка на рецепцията', 'book', v_uid);

  insert into public.marketing_campaigns (
    business_id, name, type, status, channel, audience, template, is_demo, created_by
  )
  values (
    v_biz, 'Есенна грижа за косата', 'win_back', 'draft', 'email',
    jsonb_build_object('last_visit_before_days', 45),
    jsonb_build_object(
      'subject', jsonb_build_object(
        'bg', 'Липсваш ни! Есенна грижа за косата те чака',
        'en', 'We miss you! Autumn hair care is waiting',
        'ro', 'Ne lipsești! Te așteaptă îngrijirea de toamnă a părului'
      ),
      'body', jsonb_build_object(
        'bg', 'След лятото косата има нужда от малко внимание. Запиши си час за кератин или тонер и гланц този месец.',
        'en', 'After summer your hair needs a little attention. Book keratin or a toner and gloss this month.',
        'ro', 'După vară, părul are nevoie de puțină atenție. Programează-te pentru keratină sau toner și luciu luna aceasta.'
      )
    ),
    true, v_uid
  );

  execute 'reset role';

  -- ---- what no client may write: deposits, payments, other people's reviews --
  perform set_config('app.trusted_write', 'on', true);

  -- Deposits where a real salon would have taken them: online bookings of
  -- the services that ask for one.
  update public.appointments a
  set deposit_cents = s.deposit_cents,
      deposit_status = case a.status
        when 'completed' then 'applied'
        when 'no_show' then 'retained'
        when 'cancelled' then 'refunded'
        when 'pending' then 'awaiting'
        else 'paid'
      end::public.deposit_status,
      payment_due_at = case when a.status = 'pending' then a.created_at + interval '32 minutes' end
  from public.services s
  where a.service_id = s.id
    and a.business_id = v_biz
    and a.is_demo
    and a.source = 'customer_web'
    and s.requires_deposit;

  -- An unpaid hold only makes sense for the next half hour; older pending
  -- demo bookings read as "waived" - the salon confirmed without waiting.
  update public.appointments
  set deposit_status = 'waived', payment_due_at = null
  where business_id = v_biz and is_demo and deposit_status = 'awaiting';

  insert into public.payment_records (
    business_id, appointment_id, kind, status, amount_cents, currency,
    provider, provider_reference, provider_payment_reference, is_demo, created_at
  )
  select a.business_id, a.id, 'deposit', 'succeeded', a.deposit_cents, a.currency,
         'stripe', 'demo_cs_' || replace(a.id::text, '-', ''), 'demo_pi_' || replace(a.id::text, '-', ''),
         true,
         -- Paid when booked: days before the visit, never after now.
         least(now() - interval '30 minutes',
               a.starts_at - make_interval(days => 2 + (random() * 12)::int, hours => (random() * 10)::int))
  from public.appointments a
  where a.business_id = v_biz and a.is_demo
    and a.deposit_status in ('paid', 'applied', 'retained', 'refunded');

  insert into public.payment_records (
    business_id, appointment_id, kind, status, amount_cents, currency,
    provider, provider_reference, related_payment_id, is_demo, created_at
  )
  select p.business_id, p.appointment_id, 'refund', 'succeeded', p.amount_cents, p.currency,
         'stripe', 'demo_re_' || replace(p.appointment_id::text, '-', ''), p.id, true,
         coalesce(a.cancelled_at + interval '5 minutes', p.created_at)
  from public.payment_records p
  join public.appointments a on a.id = p.appointment_id
  where p.business_id = v_biz and p.is_demo and p.kind = 'deposit'
    and a.deposit_status = 'refunded';

  -- Reviews from the visits that happened.
  insert into public.reviews (
    business_id, appointment_id, staff_profile_id, rating, comment, status, is_demo, created_at
  )
  select v_biz, picked.id, picked.staff_profile_id,
         v_ratings[picked.n], v_comments[picked.n], 'published', true,
         picked.ends_at + interval '5 hours'
  from (
    select a.id, a.staff_profile_id, a.ends_at,
           row_number() over (order by a.ends_at desc) as n
    from public.appointments a
    where a.business_id = v_biz and a.is_demo and a.status = 'completed'
      and a.ends_at < now() - interval '1 day'
    order by a.ends_at desc
    limit 18
  ) picked;

  update public.businesses
  set is_demo = true,
      slug = 'demo-ivanov-atelier'
  where id = v_biz
    and not exists (
      select 1 from public.businesses other
      where other.slug = 'demo-ivanov-atelier' and other.id <> v_biz
    );

  perform set_config('app.trusted_write', 'off', true);

  -- ---- the owner answers some of them, through the review edit guard -------
  execute 'set local role authenticated';

  update public.reviews r
  set business_response = v_replies[1 + (picked.n % array_length(v_replies, 1))]
  from (
    select id, row_number() over (order by created_at desc) as n
    from public.reviews
    where business_id = v_biz and is_demo
  ) picked
  where r.id = picked.id and picked.n % 2 = 1;

  execute 'reset role';

  raise notice 'Showcase seeded for % (business %)', v_email, v_biz;
end
$showcase$;

-- ---------------------------------------------------------------------------
-- Removal (run by hand; leaves the account and its business, strips the demo):
--
--   with b as (select id from public.businesses where slug = 'demo-ivanov-atelier')
--   delete from public.reviews where business_id in (select id from b) and is_demo;
--   ... payment_records, appointments, business_clients, marketing_campaigns
--   where is_demo; then staff_profiles where avatar_url like '/brand/showcase/%'.
-- ---------------------------------------------------------------------------
