// ═══════════════════════════════════════════════════════════════════
// Előkészítős gyerekek (v1.14.0), Sándor 2026.11.06.
//   - competitors.status = 'elokeszitos' | 'versenyzo'
//   - az előkészítős gyerek és szülője a felületen kevesebbet lát (csak a
//     felületen rejtjük el, az adatbázis jogai nem változnak)
//   - a szülő akkor lát „előkészítős nézetet”, ha MINDEN gyereke előkészítős
//   - SQL: docs/sql/2026-11-06_v1.14.0_elokeszitos.sql
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';

export const PRESCHOOL = 'elokeszitos';
export const isPreschool = (c) => c?.status === PRESCHOOL;
// a nem-edzői nézetekből kimaradnak (barátnő-, startlista-, csapat-, statisztika-választók)
export const notPreschool = (c) => c?.status !== PRESCHOOL;

// Igaz, ha a bejelentkezett gyerek / szülő előkészítős nézetet kap (null: még tölt)
export function usePreschoolMode(supabase, profile) {
  const [limited, setLimited] = useState(null);
  const role = profile?.role;
  const id = profile?.id;
  const competitorId = profile?.competitor_id;
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (role === 'versenyzo' && competitorId) {
          const { data } = await supabase.from('competitors').select('status').eq('id', competitorId).maybeSingle();
          if (active) setLimited(isPreschool(data));
        } else if (role === 'szulo' && id) {
          const { data: links } = await supabase.from('parent_child_links').select('competitor_id').eq('parent_user_id', id);
          const ids = (links || []).map(l => l.competitor_id);
          if (ids.length === 0) { if (active) setLimited(false); return; }
          const { data: kids } = await supabase.from('competitors').select('status').in('id', ids);
          if (active) setLimited((kids || []).length > 0 && (kids || []).every(isPreschool));
        } else if (active) {
          setLimited(false);
        }
      } catch (err) {
        console.error('usePreschoolMode:', err);
        if (active) setLimited(false);
      }
    })();
    return () => { active = false; };
  }, [supabase, role, id, competitorId]);
  return limited;
}

// Tájékoztató sáv az előkészítős nézet tetején
export function PreschoolBanner({ role }) {
  const parent = role !== 'versenyzo';
  return (
    <div className="mb-4 rounded-xl border-2 p-3 text-sm leading-relaxed"
         style={{ borderColor: '#93C5FD', backgroundColor: '#EFF6FF', color: '#1E3A8A' }}>
      <b>Előkészítős nézet:</b>{' '}
      {parent
        ? 'most gyermeked adatait és a klub legfontosabb híreit látod. Ha versenyző lesz, a Pontregiszter sokkal többet mutat: eredményeket, pontokat, versenyzőtársakat, barátnőket és még sok mást.'
        : 'most a saját adataidat és a klub legfontosabb híreit látod. Ha versenyző leszel, a Pontregiszter sokkal többet mutat: eredményeket, pontokat, versenyzőtársakat, barátnőket és még sok mást.'}
    </div>
  );
}

// Címke a listákba
export function PreschoolTag() {
  return (
    <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold"
          style={{ backgroundColor: '#DBEAFE', color: '#1E3A8A' }}>előkészítős</span>
  );
}
