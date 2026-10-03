// ═══════════════════════════════════════════════════════════════════
// Pontszám-láthatóság az EREDMÉNYEKNÉL (v0.9.49)
// Sándor 2026.10.03 (a gyerekek kérése): a lezárt, jóváhagyott versenyek
// eredményeinél ne csak a helyezés, hanem a hozzá tartozó pont is látsszon:
//   - edző / admin / szülő-admin: mindenkiét
//   - versenyző: csak a sajátját;  szülő: csak a saját gyerekéét
// A helyezés mindenkinél látszik. Az ÉLŐ pontozásra (verseny közben) ez NEM
// vonatkozik: ott mindenki mindent lát.
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

// Csapatok bemutatásai és összpontszáma (EKCS-nél a competition_teams.score üres,
// a pont a startlista-sorok eredményeiben van: bemutatásonként D/A/E/P/Total).
// Visszaad: { team_id → { sum, perfs: [{ no, apparatus, d, a, e, p, db, da, total }] } }
export async function loadTeamPerformances(supabase, teamIds) {
  const out = {};
  if (!teamIds || teamIds.length === 0) return out;
  const { data: entries } = await supabase
    .from('startlist_entries')
    .select('id, team_id, performance_number, apparatus')
    .in('team_id', teamIds);
  const entryMap = {};
  (entries || []).forEach(e => { entryMap[e.id] = e; });
  const entryIds = Object.keys(entryMap);
  if (entryIds.length === 0) return out;
  const { data: res } = await supabase
    .from('results')
    .select('startlist_entry_id, apparatus, score_db, score_da, score_d, score_a, score_e, score_p, score_total')
    .in('startlist_entry_id', entryIds)
    .not('score_total', 'is', null);
  (res || []).forEach(r => {
    const e = entryMap[r.startlist_entry_id];
    const slot = (out[e.team_id] = out[e.team_id] || { sum: 0, perfs: [] });
    slot.sum += parseFloat(r.score_total) || 0;
    slot.perfs.push({
      no: e.performance_number, apparatus: r.apparatus || e.apparatus,
      db: r.score_db, da: r.score_da, d: r.score_d, a: r.score_a, e: r.score_e, p: r.score_p,
      total: r.score_total
    });
  });
  Object.values(out).forEach(s => s.perfs.sort((x, y) => (x.no || 0) - (y.no || 0)));
  return out;
}

// Csak az összpontszám: { team_id → összpont }
export async function loadTeamScoreSums(supabase, teamIds) {
  const perf = await loadTeamPerformances(supabase, teamIds);
  const sums = {};
  Object.entries(perf).forEach(([id, s]) => { sums[id] = s.sum; });
  return sums;
}

const APPARATUS_HU = { szabad: 'Szabad', karika: 'Karika', labda: 'Labda', buzogany: 'Buzogány', szalag: 'Szalag', kotel: 'Kötél' };
// 'karika+labda' → 'Karika + Labda'
export const apparatusLabel = (v) => (v ? String(v).split('+').map(s => APPARATUS_HU[s.trim()] || s.trim()).join(' + ') : '');
