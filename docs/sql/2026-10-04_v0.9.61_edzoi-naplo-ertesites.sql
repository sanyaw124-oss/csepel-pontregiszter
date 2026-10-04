-- Pontregiszter v0.9.61: értesítés a szülőnek az új edzői napló bejegyzésekről
-- Futtatás: Supabase → SQL Editor → beilleszt → Run. Többször is lefuttatható.
-- Új mező: mikor nézte meg a szülő utoljára az edzői naplót. A meglévő fiókoknál
-- a mostani időpont kerül bele, így a régi bejegyzések nem jelennek meg „újként”.
-- (A saját profilt a felhasználó a meglévő "users update own profile" szabállyal írhatja.)

alter table public.profiles add column if not exists coach_notes_seen_at timestamptz default now();
