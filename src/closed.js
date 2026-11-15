// v1.14.2: one rule for "this competition is closed" (lezárt), shared by the competition list,
// the home page hero and the 30-day calendar widget.
// Closed = the competition itself is finalized, or it has categories and every one of them is finalized.

// Supabase select fragment that brings what isCompetitionClosed needs.
export const CLOSED_SELECT = 'is_finalized, days:competition_days(categories:competition_categories(is_finalized))';

export function isCompetitionClosed(c) {
  if (!c) return false;
  if (c.is_finalized) return true;
  const cats = (c.days || []).flatMap(d => d.categories || []);
  return cats.length > 0 && cats.every(k => k.is_finalized);
}
