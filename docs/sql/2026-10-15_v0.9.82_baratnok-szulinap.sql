-- Pontregiszter v0.9.82: legjobb barátnők + szülinapi köszöntés (Kata + Sándor, 2026.10.15)
--   Barátnő: a gyerek legfeljebb 3 klubtársat jelölhet. A jelölést CSAK a két gyerek és a szüleik látják
--            (más gyerek és az edző sem). A gyerek látja, kiket jelölt ő, és kik jelölték őt.
--   Köszöntés: a csapattárs a szülinapos napján és utána 7 napig küldhet matricát + előre megírt
--            jókívánságot (szabad szöveg nincs). Csak a két gyerek és a szüleik látják.
-- Jelölni és köszönteni csak a gyerek tud (a saját fiókjából).
-- Futtatás: Supabase → SQL Editor → Run. Többször is lefuttatható; meglévő adatot nem módosít.

grant execute on function public.my_competitor_id() to authenticated;

-- ─── Legjobb barátnők ───────────────────────────────────────────────
create table if not exists public.best_friends (
  from_competitor uuid not null references public.competitors(id) on delete cascade,
  to_competitor   uuid not null references public.competitors(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (from_competitor, to_competitor),
  check (from_competitor <> to_competitor)
);
create index if not exists best_friends_to_idx on public.best_friends (to_competitor);

-- legfeljebb 3 jelölés gyerekenként
create or replace function public.best_friends_limit() returns trigger
language plpgsql security definer set search_path = public as $f$
begin
  if (select count(*) from best_friends where from_competitor = new.from_competitor) >= 3 then
    raise exception 'Legfeljebb 3 legjobb barátnőt jelölhetsz.';
  end if;
  return new;
end $f$;
drop trigger if exists best_friends_limit on public.best_friends;
create trigger best_friends_limit before insert on public.best_friends
  for each row execute function public.best_friends_limit();

alter table public.best_friends enable row level security;
drop policy if exists best_friends_read on public.best_friends;
create policy best_friends_read on public.best_friends for select to authenticated
  using (from_competitor = public.my_competitor_id() or to_competitor = public.my_competitor_id()
         or public.is_parent_of(from_competitor) or public.is_parent_of(to_competitor));
drop policy if exists best_friends_insert on public.best_friends;
create policy best_friends_insert on public.best_friends for insert to authenticated
  with check (from_competitor = public.my_competitor_id());
drop policy if exists best_friends_delete on public.best_friends;
create policy best_friends_delete on public.best_friends for delete to authenticated
  using (from_competitor = public.my_competitor_id());
grant select, insert, delete on public.best_friends to authenticated;
revoke all on public.best_friends from anon;

-- ─── Szülinapi köszöntés ────────────────────────────────────────────
create table if not exists public.birthday_greetings (
  id              uuid primary key default gen_random_uuid(),
  to_competitor   uuid not null references public.competitors(id) on delete cascade,
  from_competitor uuid not null references public.competitors(id) on delete cascade,
  bd_year         int  not null,                 -- melyik év szülinapjára
  sticker         text not null check (sticker in ('torta','lufi','ajandek','virag','unikornis','csillag','masni','erem')),
  message         text not null check (message in ('m1','m2','m3','m4','m5','m6','m7','m8')),
  created_at      timestamptz not null default now(),
  unique (to_competitor, from_competitor, bd_year),
  check (to_competitor <> from_competitor)
);
create index if not exists birthday_greetings_to_idx on public.birthday_greetings (to_competitor);

alter table public.birthday_greetings enable row level security;
drop policy if exists birthday_greetings_read on public.birthday_greetings;
create policy birthday_greetings_read on public.birthday_greetings for select to authenticated
  using (from_competitor = public.my_competitor_id() or to_competitor = public.my_competitor_id()
         or public.is_parent_of(from_competitor) or public.is_parent_of(to_competitor));
grant select on public.birthday_greetings to authenticated;
revoke all on public.birthday_greetings from anon;
-- írni csak az alábbi függvényen át lehet (ellenőrzi a szülinap-ablakot)

create or replace function public.send_birthday_greeting(p_to uuid, p_sticker text, p_message text) returns void
language plpgsql security definer set search_path = public as $f$
declare
  v_from  uuid := public.my_competitor_id();
  v_today date := (now() at time zone 'Europe/Budapest')::date;
  v_birth date;
  v_bd    date;
  v_y     int;
begin
  if v_from is null then raise exception 'Köszönteni csak versenyzői fiókból lehet.'; end if;
  if v_from = p_to then raise exception 'Saját magadat nem köszöntheted.'; end if;
  select birth_date into v_birth from competitors where id = p_to and is_active;
  if v_birth is null then raise exception 'Ismeretlen születésnap.'; end if;
  -- az idei vagy a tavalyi szülinap (év eleji késői köszöntéshez)
  foreach v_y in array array[extract(year from v_today)::int, extract(year from v_today)::int - 1] loop
    v_bd := make_date(v_y, extract(month from v_birth)::int,
              case when extract(month from v_birth) = 2 and extract(day from v_birth) = 29
                        and not (v_y % 4 = 0 and (v_y % 100 <> 0 or v_y % 400 = 0))
                   then 28 else extract(day from v_birth)::int end);
    if v_today - v_bd between 0 and 7 then
      insert into birthday_greetings (to_competitor, from_competitor, bd_year, sticker, message)
      values (p_to, v_from, v_y, p_sticker, p_message)
      on conflict (to_competitor, from_competitor, bd_year)
      do update set sticker = excluded.sticker, message = excluded.message, created_at = now();
      return;
    end if;
  end loop;
  raise exception 'Köszönteni a szülinap napján és utána 7 napig lehet.';
end $f$;
revoke all on function public.send_birthday_greeting(uuid, text, text) from public, anon;
grant execute on function public.send_birthday_greeting(uuid, text, text) to authenticated;
