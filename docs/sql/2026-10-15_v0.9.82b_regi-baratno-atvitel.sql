-- Pontregiszter v0.9.82b: a régi „Legjobb barátnőm” (competitors.best_friend_competitor_id, egy fő,
-- MINDENKI számára olvasható volt) átvitele az új, védett best_friends táblába, majd a régi mező ürítése.
-- Előbb a v0.9.82-es SQL-nek lefutva kell lennie. Többször is lefuttatható.

insert into public.best_friends (from_competitor, to_competitor)
select c.id, c.best_friend_competitor_id
from public.competitors c
join public.competitors f on f.id = c.best_friend_competitor_id
where c.best_friend_competitor_id is not null
  and c.best_friend_competitor_id <> c.id
on conflict do nothing;

update public.competitors set best_friend_competitor_id = null
where best_friend_competitor_id is not null;

select count(*) as atvitt_jelolesek from public.best_friends;
