-- Pontregiszter v0.9.78b: Egyesület fül, Sándor kérései (2026.10.14):
--   - hivatalos adatok: hivatalos név, adószám, telefon (a cím, e-mail, honlap már megvan) — az
--     SZJA 1%-os felajánláshoz is ezekből áll össze a szöveg;
--   - szerepkörök bővítve (Alelnök, Elnökségi tag, Titkár + „Egyéb”, saját megnevezéssel);
--   - szerkeszteni CSAK az Admin és a Szülő-admin tud (a vezetőedző már nem); a többiek olvassák,
--     PDF-et készítenek és szöveget másolnak.
-- Futtatás: Supabase → SQL Editor → Run. Többször is lefuttatható; meglévő adatot nem töröl.

alter table public.club_info add column if not exists official_name text;
alter table public.club_info add column if not exists tax_number    text;
alter table public.club_info add column if not exists phone         text;

alter table public.club_people add column if not exists title_label text;   -- „Egyéb” szerepkör saját neve
alter table public.club_people drop constraint if exists club_people_title_check;
alter table public.club_people add constraint club_people_title_check check (title in
  ('elnok','alelnok','elnoksegi_tag','titkar','vezetoedzo','edzo','segededzo','egyeb'));

drop policy if exists club_info_write on public.club_info;
create policy club_info_write on public.club_info for update to authenticated
  using (current_user_role() = any (array['admin','szulo_admin']))
  with check (current_user_role() = any (array['admin','szulo_admin']));

drop policy if exists club_people_write on public.club_people;
create policy club_people_write on public.club_people for all to authenticated
  using (current_user_role() = any (array['admin','szulo_admin']))
  with check (current_user_role() = any (array['admin','szulo_admin']));
