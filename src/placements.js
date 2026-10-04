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
    .select('id, competition_category_id, apparatus, did_not_start')
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
  rows.filter(r => r.score_total !== null && r.score_total !== undefined && !r._entry.did_not_start).forEach(r => {
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

// A pontozó lap kézi mezőjébe ne a számolt (automatikus) érték kerüljön
export const manualPlacementOf = (r) => (r && !isAuto(r) ? (r.placement ?? '') : '');
