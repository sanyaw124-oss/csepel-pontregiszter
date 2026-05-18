// ═══════════════════════════════════════════════════════════════════
// COMPETITOR TREASURE — "Kincsesládám" oldal v0.9.40
// ═══════════════════════════════════════════════════════════════════
// Sándor döntése (2026.05.18):
// 1. ÚJ FEJLÉC: serleg balra + alatta "Kincsesládám" felirat,
//    avatar+név középen, kategória+korosztály+életkor jobbra
// 2. SAJÁT ÉREMFALAD: 🥇🥈🥉 motivációs összesítő (ÖSSZES eredmény, nem csak idei)
// 3. LEGUTÓBB doboz: legfrissebb érmes eredmény kiemelve
// 4. Összes elért eredmény évenként (CompetitorYearlyStats az admin.jsx-ből)
// 5. Érmek nagyban (CompetitorHistoricalResults)
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { Loader, AlertCircle } from 'lucide-react';
import { safeQuery } from './competitor-dashboard';
import {
  CompetitorYearlyStats,
  CompetitorTeamResults,
  CompetitorHistoricalResults
} from './admin';

const COLORS = {
  purpleDeep: '#831843',
  pinkDark: '#BE185D',
  amber: '#F59E0B',
  amberDark: '#92400E',
  goldText: '#D97706',
  silverText: '#6B7280',
  bronzeText: '#B45309'
};

export default function CompetitorTreasureView({ supabase, profile }) {
  const [competitor, setCompetitor] = useState(null);
  const [medalStats, setMedalStats] = useState({ gold: 0, silver: 0, bronze: 0 });
  const [lastMedal, setLastMedal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        // 1) competitorId megkeresése
        let competitorId = profile?.competitor_id;
        if (!competitorId && profile?.full_name) {
          const fb = await safeQuery(() =>
            supabase.from('competitors').select('id')
              .eq('full_name', profile.full_name).limit(1).maybeSingle()
          );
          if (fb.data?.id) competitorId = fb.data.id;
        }
        if (!competitorId) { if (mounted) setLoading(false); return; }

        // 2) Saját competitor
        const compRes = await safeQuery(() =>
          supabase.from('competitors')
            .select('id, full_name, nickname, kategoria, korosztaly, avatar_emoji, birth_year')
            .eq('id', competitorId).maybeSingle()
        );
        if (compRes.data && mounted) setCompetitor(compRes.data);

        // 3) ÖSSZES érmes eredmény (egyéni + összetett + csapat + historical)
        // a) Egyéni érmek
        const indivRes = await safeQuery(() =>
          supabase.from('results')
            .select(`
              placement, apparatus,
              startlist_entry:startlist_entries!inner(
                competitor_id,
                competition_category:competition_categories!inner(
                  competition_day:competition_days!inner(
                    competition:competitions!inner(id, name, start_date)
                  )
                )
              )
            `)
            .eq('startlist_entry.competitor_id', competitorId)
            .in('placement', [1, 2, 3])
            .not('placement', 'is', null)
        );

        // b) Összetett érmek
        const aaRes = await safeQuery(() =>
          supabase.from('all_around_results')
            .select(`
              placement,
              competition_category:competition_categories!inner(
                competition_day:competition_days!inner(
                  competition:competitions!inner(id, name, start_date)
                )
              )
            `)
            .eq('competitor_id', competitorId)
            .in('placement', [1, 2, 3])
            .not('placement', 'is', null)
        );

        // c) Historical érmek
        const histRes = await safeQuery(() =>
          supabase.from('historical_results')
            .select('placement, apparatus, competition_name, competition_date')
            .eq('competitor_id', competitorId)
            .in('placement', [1, 2, 3])
            .not('placement', 'is', null)
        );

        // Összes érem összegyűjtése + legfrissebb keresése
        let gold = 0, silver = 0, bronze = 0;
        let allMedals = [];

        if (indivRes.data) {
          indivRes.data.forEach(r => {
            if (r.placement === 1) gold++;
            else if (r.placement === 2) silver++;
            else if (r.placement === 3) bronze++;
            const comp = r.startlist_entry?.competition_category?.competition_day?.competition;
            if (comp) {
              allMedals.push({
                placement: r.placement,
                apparatus: r.apparatus,
                name: comp.name,
                date: comp.start_date,
                source: 'individual'
              });
            }
          });
        }
        if (aaRes.data) {
          aaRes.data.forEach(r => {
            if (r.placement === 1) gold++;
            else if (r.placement === 2) silver++;
            else if (r.placement === 3) bronze++;
            const comp = r.competition_category?.competition_day?.competition;
            if (comp) {
              allMedals.push({
                placement: r.placement,
                apparatus: 'Összetett',
                name: comp.name,
                date: comp.start_date,
                source: 'all_around'
              });
            }
          });
        }
        if (histRes.data) {
          histRes.data.forEach(r => {
            if (r.placement === 1) gold++;
            else if (r.placement === 2) silver++;
            else if (r.placement === 3) bronze++;
            allMedals.push({
              placement: r.placement,
              apparatus: r.apparatus || 'Eredmény',
              name: r.competition_name,
              date: r.competition_date,
              source: 'historical'
            });
          });
        }

        // Legfrissebb érem (date csökkenő szerint)
        allMedals.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const newest = allMedals[0] || null;

        if (mounted) {
          setMedalStats({ gold, silver, bronze });
          setLastMedal(newest);
        }

      } catch (err) {
        console.error('Treasure load:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [supabase, profile?.competitor_id, profile?.id, profile?.full_name]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-8 text-center">
        <Loader className="w-8 h-8 animate-spin mx-auto text-amber-400" />
      </div>
    );
  }

  if (!competitor) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-4">
        <div className="rounded-2xl p-4 bg-amber-50 border-2 border-amber-300 text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-amber-600 mb-2" />
          <div className="text-sm font-bold text-amber-900">
            Még nem találtunk hozzád versenyző profilt!
          </div>
        </div>
      </div>
    );
  }

  const age = competitor.birth_year ? new Date().getFullYear() - competitor.birth_year : null;
  const totalMedals = medalStats.gold + medalStats.silver + medalStats.bronze;

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">

      {/* ─── ÚJ FEJLÉC: serleg balra + felirat, avatar középen, kategória jobbra ─── */}
      <div className="rounded-2xl p-4 flex items-center gap-3" style={{
        background: 'linear-gradient(135deg, #FEF3C7 0%, #FCE4EC 100%)'
      }}>
        {/* Bal: nagy serleg + felirat */}
        <div className="flex flex-col items-center justify-center flex-shrink-0 min-w-[64px]">
          <div className="text-5xl leading-none">🏆</div>
          <div className="text-xs mt-1 font-medium text-center" style={{
            color: COLORS.amberDark,
            fontFamily: 'Caveat, cursive',
            fontSize: '16px'
          }}>
            Kincses-<br/>ládám
          </div>
        </div>

        {/* Közép: avatar + név */}
        <div className="flex-1 min-w-0 text-center">
          <div className="text-5xl leading-none mb-1">{competitor.avatar_emoji || '🦄'}</div>
          <div className="text-base font-bold leading-tight" style={{ color: COLORS.amberDark }}>
            {competitor.nickname
              ? `"${competitor.nickname}"`
              : competitor.full_name?.split(' ').slice(-1)[0]}
          </div>
          {competitor.nickname && (
            <div className="text-xs text-gray-600 truncate">{competitor.full_name}</div>
          )}
        </div>

        {/* Jobb: kategória adatok */}
        <div className="text-right text-xs leading-relaxed flex-shrink-0" style={{ color: COLORS.amberDark }}>
          <div className="font-bold">{competitor.kategoria}</div>
          <div>{competitor.korosztaly || 'versenyző'}</div>
          {age && <div style={{ color: '#B45309' }}>{age} éves</div>}
        </div>
      </div>

      {/* ─── SAJÁT ÉREMFALAD — 🥇🥈🥉 ─── */}
      <div className="rounded-2xl p-5 bg-white border-2" style={{ borderColor: '#FBCFE8' }}>
        <div className="text-sm font-bold mb-4 text-center" style={{ color: COLORS.amberDark }}>
          🏅 Saját éremfalad
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* ARANY */}
          <div className="text-center">
            <div className="text-6xl mb-1">🥇</div>
            <div className="text-4xl font-bold leading-none" style={{ color: COLORS.goldText }}>
              {medalStats.gold}
            </div>
            <div className="text-xs mt-1 text-gray-600">arany</div>
          </div>
          {/* EZÜST */}
          <div className="text-center">
            <div className="text-6xl mb-1">🥈</div>
            <div className="text-4xl font-bold leading-none" style={{ color: COLORS.silverText }}>
              {medalStats.silver}
            </div>
            <div className="text-xs mt-1 text-gray-600">ezüst</div>
          </div>
          {/* BRONZ */}
          <div className="text-center">
            <div className="text-6xl mb-1">🥉</div>
            <div className="text-4xl font-bold leading-none" style={{ color: COLORS.bronzeText }}>
              {medalStats.bronze}
            </div>
            <div className="text-xs mt-1 text-gray-600">bronz</div>
          </div>
        </div>

        {totalMedals === 0 && (
          <div className="text-center text-xs text-gray-500 italic mt-4">
            Az első érmed még előtted áll! 💪
          </div>
        )}

        {/* LEGUTÓBB doboz */}
        {lastMedal && (
          <div className="mt-4 rounded-xl p-3 text-center" style={{ background: '#FEF3C7' }}>
            <div className="text-xs" style={{ color: COLORS.amberDark }}>
              ✨ Legutóbb: <span className="font-bold">{lastMedal.name}</span>
            </div>
            <div className="text-xs text-gray-600 mt-0.5">
              {lastMedal.placement}. hely — {lastMedal.apparatus}
            </div>
          </div>
        )}
      </div>

      {/* ─── ÖSSZES ELÉRT EREDMÉNY ÉVENKÉNT (a meglévő admin komponens) ─── */}
      <CompetitorYearlyStats
        supabase={supabase}
        competitorId={competitor.id}
        competitorName={competitor.full_name}
      />

      {/* ─── CSAPAT-EREDMÉNYEK ─── */}
      <CompetitorTeamResults
        supabase={supabase}
        competitorId={competitor.id}
      />

      {/* ─── ÖSSZES ÉRMES EREDMÉNY (NAGYBAN) ─── */}
      <CompetitorHistoricalResults
        supabase={supabase}
        competitorId={competitor.id}
        userRole="versenyzo"
      />

    </div>
  );
}
