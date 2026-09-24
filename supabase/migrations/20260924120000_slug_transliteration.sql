-- ---------------------------------------------------------------------------
-- GLOWA · slugs for Cyrillic and Romanian names
--
-- `app.next_free_slug` kept `[a-z0-9]` and threw everything else away. A
-- Bulgarian salon is named in Cyrillic, so "Студио Петров" reduced to nothing,
-- fell under the three-character floor and came out as `salon-fa5cc3` - a
-- random address for the one link a salon prints on its cards and posters.
-- Found by onboarding a salon with a Bulgarian name, not by reading the code.
--
-- Bulgarian uses the official Streamlined System (the one on Bulgarian
-- passports and road signs: щ -> sht, ъ -> a, ю -> yu). Romanian diacritics
-- fold to their base letter, both the comma-below and the legacy cedilla
-- forms of ș and ț, because both still appear in real input.
--
-- Only new slugs change. Existing businesses keep theirs: a slug is a public
-- URL, and rewriting it would break every link and QR code already printed.
-- ---------------------------------------------------------------------------

create or replace function app.transliterate_slug(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(
    -- Multi-letter sounds first; `translate` maps one character to one.
    replace(replace(replace(replace(replace(replace(replace(
      lower(coalesce(p_value, '')),
      'щ', 'sht'), 'ж', 'zh'), 'ц', 'ts'), 'ч', 'ch'), 'ш', 'sh'),
      'ю', 'yu'), 'я', 'ya'),
    'абвгдезийклмнопрстуфхъьăâîșşțţáàäéèëíìïóòöúùüç',
    'abvgdeziyklmnoprstufhayaaisstt' || 'aaaeeeiiiooouuuc'
  );
$$;

create or replace function app.next_free_slug(p_base text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_candidate text;
  v_suffix integer := 1;
begin
  v_base := regexp_replace(app.transliterate_slug(p_base), '[^a-z0-9]+', '-', 'g');
  v_base := btrim(v_base, '-');
  if length(v_base) < 3 then
    v_base := 'salon-' || substr(md5(random()::text), 1, 6);
  end if;
  v_base := btrim(left(v_base, 48), '-');
  -- `demo-` marks invented showcase content across the product. A real salon
  -- called "Демо" or "Demo Studio" must not inherit that label.
  if v_base = 'demo' or v_base like 'demo-%' then
    v_base := 'salon-' || v_base;
  end if;

  v_candidate := v_base;
  while exists (select 1 from public.businesses b where b.slug = v_candidate) loop
    v_suffix := v_suffix + 1;
    v_candidate := v_base || '-' || v_suffix;
    if v_suffix > 200 then
      v_candidate := v_base || '-' || substr(md5(random()::text), 1, 6);
      exit;
    end if;
  end loop;

  return v_candidate;
end;
$$;

revoke execute on function app.transliterate_slug(text) from public;
grant execute on function app.transliterate_slug(text) to authenticated;

revoke execute on function app.next_free_slug(text) from public;
grant execute on function app.next_free_slug(text) to authenticated;
