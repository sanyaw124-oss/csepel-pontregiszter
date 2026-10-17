// ═══════════════════════════════════════════════════════════════════
// Számolt helyezés mentése lezáráskor (v0.9.49)
// Sándor 2026.10.03: ahol nincs kézi helyezés, oda lezáráskor a pontból számolt
// helyezés kerül — a gyerekek eredményei a mentett helyezésből dolgoznak.
// A kézi helyezés mindig elsőbbséget kap (ha valaki kimarad, a számolt rossz).
//
// Jelölés: results.calculated_rank = a beírt számolt helyezés. Ha
// placement === calculated_rank, a sor "automatikus"; minden más nem üres
// placement KÉZI. Újranyitáskor csak az automatikusakat töröljük.
// Rangsor: kategória + szer csoportonként, Total → E → D → A
// (ugyanaz, mint a Csepeli fül v0.9.39-es számítása).
// ═══════════════════════════════════════════════════════════════════

const num = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

const isAuto = (r) => r.calculated_rank !== null && r.calculated_rank !== undefined
  && r.placement === r.calculated_rank;

async function loadRows(supabase, categoryIds) {
  if (!categoryIds || categoryIds.length === 0) return [];
  const { data: entries, error: eErr } = await supabase
    .from('startlist_entries')
    .select('id, competition_category_id, apparatus, did_not_start, team_id, is_exhibition')
    .in('competition_category_id', categoryIds);
  if (eErr) throw eErr;
  const entryMap = {};
  (entries || []).forEach(e => { entryMap[e.id] = e; });
  const ids = Object.keys(entryMap);
  if (ids.length === 0) return [];
  const { data: res, error: rErr } = await supabase
    .from('results')
    .select('id, startlist_entry_id, score_total, score_e, score_d, score_a, placement, calculated_rank')
    .in('startlist_entry_id', ids);
  if (rErr) throw rErr;
  return (res || []).map(r => ({ ...r, _entry: entryMap[r.startlist_entry_id] }));
}

// Lezáráskor: a kézi helyezés nélküli sorokba a számolt helyezés
export async function fillAutoPlacements(supabase, categoryIds) {
  const rows = await loadRows(supabase, categoryIds);
  const groups = {};
  // v0.9.50: a „nem indult” sor nem kap helyezést
  // v1.3.0: csapatsor (EKCS) és bemutató sem kap egyéni helyezést
  rows.filter(r => r.score_total !== null && r.score_total !== undefined && !r._entry.did_not_start
    && !r._entry.team_id && !r._entry.is_exhibition).forEach(r => {
    const key = `${r._entry.competition_category_id}__${r._entry.apparatus || '__none__'}`;
    (groups[key] = groups[key] || []).push(r);
  });
  const calc = {};
  Object.values(groups).forEach(arr => {
    arr.sort((a, b) => {
      if (Math.abs(num(b.score_total) - num(a.score_total)) > 0.0005) return num(b.score_total) - num(a.score_total);
      if (Math.abs(num(b.score_e) - num(a.score_e)) > 0.0005) return num(b.score_e) - num(a.score_e);
      if (Math.abs(num(b.score_d) - num(a.score_d)) > 0.0005) return num(b.score_d) - num(a.score_d);
      return num(b.score_a) - num(a.score_a);
    });
    arr.forEach((r, i) => { calc[r.id] = i + 1; });
  });

  for (const r of rows) {
    const manual = r.placement !== null && r.placement !== undefined && !isAuto(r);
    if (manual) continue;
    const target = calc[r.id] ?? null;
    if (r.placement !== target || r.calculated_rank !== target) {
      const { error } = await supabase.from('results')
        .update({ placement: target, calculated_rank: target })
        .eq('id', r.id);
      if (error) throw error;
    }
  }
}

// Újranyitáskor: csak az automatikusan beírt helyezések törlése (a kézi marad)
export async function clearAutoPlacements(supabase, categoryIds) {
  const rows = await loadRows(supabase, categoryIds);
  for (const r of rows.filter(isAuto)) {
    const { error } = await supabase.from('results')
      .update({ placement: null, calculated_rank: null })
      .eq('id', r.id);
    if (error) throw error;
  }
}

// ─── v1.3.0: EKCS csapathelyezés ─────────────────────────────────────
// A csapat helyezése = a bemutatásai összpontszáma a kategórián belül (mint a pontozóban).
// Lezáráskor ott, ahol nincs kézi helyezés (competition_teams.placement üres), a számolt kerül be;
// újranyitáskor csak az törlődik, ami a számolttal egyezik (a kézi marad).
async function teamRanks(supabase, categoryIds) {
  const rows = await loadRows(supabase, categoryIds);
  const sum = {}; const cat = {};
  rows.filter(r => r._entry.team_id && !r._entry.did_not_start && !r._entry.is_exhibition
    && r.score_total !== null && r.score_total !== undefined).forEach(r => {
    sum[r._entry.team_id] = (sum[r._entry.team_id] || 0) + num(r.score_total);
    cat[r._entry.team_id] = r._entry.competition_category_id;
  });
  const byCat = {};
  Object.keys(sum).forEach(t => { (byCat[cat[t]] = byCat[cat[t]] || []).push(t); });
  const rank = {};
  Object.values(byCat).forEach(ts => ts.sort((a, b) => sum[b] - sum[a]).forEach((t, i) => { rank[t] = i + 1; }));
  return rank;
}
export async function fillTeamPlacements(supabase, categoryIds) {
  const rank = await teamRanks(supabase, categoryIds);
  const ids = Object.keys(rank);
  if (ids.length === 0) return;
  const { data: teams, error } = await supabase.from('competition_teams').select('id, placement').in('id', ids);
  if (error) throw error;
  for (const t of teams || []) {
    if (t.placement === null || t.placement === undefined) {
      const { error: uErr } = await supabase.from('competition_teams').update({ placement: rank[t.id] }).eq('id', t.id);
      if (uErr) throw uErr;
    }
  }
}
export async function clearTeamPlacements(supabase, categoryIds) {
  const rank = await teamRanks(supabase, categoryIds);
  const ids = Object.keys(rank);
  if (ids.length === 0) return;
  const { data: teams, error } = await supabase.from('competition_teams').select('id, placement').in('id', ids);
  if (error) throw error;
  for (const t of teams || []) {
    if (t.placement !== null && t.placement === rank[t.id]) {
      const { error: uErr } = await supabase.from('competition_teams').update({ placement: null }).eq('id', t.id);
      if (uErr) throw uErr;
    }
  }
}

// A pontozó lap kézi mezőjébe ne a számolt (automatikus) érték kerüljön
export const manualPlacementOf = (r) => (r && !isAuto(r) ? (r.placement ?? '') : '');
