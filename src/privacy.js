// ═══════════════════════════════════════════════════════════════════
// Pontszám-láthatóság (v0.9.49)
// Sándor 2026.10.03 (a gyerekek kérése): az eredményeknél ne csak a helyezés,
// hanem a pontszám is látsszon — DE:
//   - edző / admin / szülő-admin: mindenkiét látja
//   - versenyző: csak a sajátját
//   - szülő: csak a saját gyerekéét
// A helyezés mindenkinél látszik. A szülő verseny közbeni pontbeírása
// (segítő szerep) megmarad: a beíró lapon látja, amit beír.
// FIGYELEM: ez megjelenítési szabály; az adatbázis-szintű védelem (RLS) külön feladat.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';

const SEES_ALL_SCORES = ['admin', 'szulo_admin', 'vezetoedzo', 'edzo', 'segededzo'];

export const seesAllScores = (role) => SEES_ALL_SCORES.includes(role);

// Ki "saját" a bejelentkezett felhasználónak: a versenyző saját competitor_id-ja
// és a szülő gyerekei (parent_child_links). Edzőnél nem kell lekérdezni.
// Visszaad: { ready, isOwn(competitorId), ownIds }
export function useOwnCompetitors(supabase, role) {
  const all = seesAllScores(role);
  const [ownIds, setOwnIds] = useState(null);

  useEffect(() => {
    if (all || !supabase) return;
    let active = true;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) { if (active) setOwnIds(new Set()); return; }
        const [{ data: prof }, { data: links }] = await Promise.all([
          supabase.from('profiles').select('competitor_id').eq('id', uid).maybeSingle(),
          supabase.from('parent_child_links').select('competitor_id').eq('parent_user_id', uid)
        ]);
        const ids = new Set();
        if (prof?.competitor_id) ids.add(prof.competitor_id);
        (links || []).forEach(l => l.competitor_id && ids.add(l.competitor_id));
        if (active) setOwnIds(ids);
      } catch (err) {
        console.error('useOwnCompetitors:', err);
        if (active) setOwnIds(new Set());
      }
    })();
    return () => { active = false; };
  }, [supabase, all]);

  return {
    ready: all || ownIds !== null,
    ownIds: ownIds || new Set(),
    // betöltés alatt inkább rejtünk, mint mutatunk
    isOwn: (competitorId) => all || (!!competitorId && !!ownIds && ownIds.has(competitorId))
  };
}

// Csapatok összpontszáma a bemutatások pontjainak összegéből (EKCS-nél a
// competition_teams.score üres, a pont a startlista-sorok eredményeiben van).
// Visszaad: { team_id → összpont } (csak ahol van legalább egy pont)
export async function loadTeamScoreSums(supabase, teamIds) {
  const sums = {};
  if (!teamIds || teamIds.length === 0) return sums;
  const { data: entries } = await supabase
    .from('startlist_entries')
    .select('id, team_id')
    .in('team_id', teamIds);
  const entryTeam = {};
  (entries || []).forEach(e => { entryTeam[e.id] = e.team_id; });
  const entryIds = Object.keys(entryTeam);
  if (entryIds.length === 0) return sums;
  const { data: res } = await supabase
    .from('results')
    .select('startlist_entry_id, score_total')
    .in('startlist_entry_id', entryIds)
    .not('score_total', 'is', null);
  (res || []).forEach(r => {
    const t = entryTeam[r.startlist_entry_id];
    sums[t] = (sums[t] || 0) + (parseFloat(r.score_total) || 0);
  });
  return sums;
}
