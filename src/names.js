// ═══════════════════════════════════════════════════════════════════
// Versenyző-nevek — EGY helyen (v0.9.49)
// Sándor 2026.10.03 döntése: a becenév mindenhol ELÖL áll,
//   pl. "Ági" Tóth Petra — az edző becenév szerint keres,
//   ezért a listák is becenév szerint rendeződnek (huSortByNickname).
// ═══════════════════════════════════════════════════════════════════

// Teljes név becenévvel elöl: "Ági" Tóth Petra  (becenév nélkül: Tóth Petra)
export function formatCompetitorName(c) {
  if (!c) return '';
  const full = (c.full_name || '').trim();
  const nick = (c.nickname || '').trim();
  if (!nick) return full;
  return full ? `"${nick}" ${full}` : `"${nick}"`;
}

// Rövid alak szűk helyre (chipek, listák): "Ági" Tóth  (becenév nélkül: Tóth Petra)
export function formatCompetitorShortName(c) {
  if (!c) return '';
  const full = (c.full_name || '').trim();
  const nick = (c.nickname || '').trim();
  if (!nick) return full;
  const surname = full.split(' ')[0];
  return surname ? `"${nick}" ${surname}` : `"${nick}"`;
}

// Magyar abc-rendezés: becenév szerint, ha van; különben a teljes név szerint
export const HU_COLLATOR = new Intl.Collator('hu', { sensitivity: 'base', numeric: true });

export const huSortByNickname = (a, b) => {
  const aKey = (a?.nickname || a?.full_name || '').trim();
  const bKey = (b?.nickname || b?.full_name || '').trim();
  return HU_COLLATOR.compare(aKey, bKey);
};
