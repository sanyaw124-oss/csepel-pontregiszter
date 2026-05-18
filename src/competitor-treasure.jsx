// ═══════════════════════════════════════════════════════════════════
// COMPETITOR TREASURE — "Kincsesládám" oldal v0.9.41
// ═══════════════════════════════════════════════════════════════════
// JAVÍTÁSOK az SQL diagnosztika alapján (2026.05.18):
// - competition_team_members → competition_teams chain (csapat-érmek) 
// - historical_results JSONB struktúra (year, results JSONB)
// - Promise.all() gyors párhuzamos betöltés
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
        // 1) Competitor ID
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

        // ═══════ PÁRHUZAMOS ÉREM-LEKÉRDEZÉSEK ═══════
        const [indivRes, aaRes, histRes, teamMembersRes] = await Promise.all([
          // a) Egyéni érmek (results)
          safeQuery(() =>
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
          ),

          // b) Összetett érmek
          safeQuery(() =>
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
          ),

          // c) Historical eredmények (VALÓS struktúra: year, results JSONB)
          safeQuery(() =>
            supabase.from('historical_results')
              .select('id, year, competition_name, team_name, results')
              .eq('competitor_id', competitorId)
          ),

          // d) Csapat-tagság (a 2. lépésben competition_teams-ből vesszük a placement-et)
          safeQuery(() =>
            supabase.from('competition_team_members')
              .select('team_id')
              .eq('competitor_id', competitorId)
          )
        ]);

        // Csapat-érmek 2. lépés
        let teamResData = [];
        if (teamMembersRes?.data && teamMembersRes.data.length > 0) {
          const teamIds = teamMembersRes.data.map(m => m.team_id).filter(Boolean);
          if (teamIds.length > 0) {
            const teamsRes = await safeQuery(() =>
              supabase.from('competition_teams')
                .select(`
                  id, name, placement,
                  competition:competition_id (id, name, start_date)
                `)
                .in('id', teamIds)
                .in('placement', [1, 2, 3])
            );
            if (teamsRes?.data) teamResData = teamsRes.data;
          }
        }

        // ═══════ ÉRMEK ÖSSZEGZÉSE ═══════
        let gold = 0, silver = 0, bronze = 0;
        const allMedals = [];

        // Egyéni érmek
        if (indivRes?.data) {
          indivRes.data.forEach(r => {
            if (r.placement === 1) gold++;
            else if (r.placement === 2) silver++;
            else if (r.placement === 3) bronze++;
            const comp = r.startlist_entry?.competition_category?.competition_day?.competition;
            if (comp) {
              allMedals.push({
                placement: r.placement,
                apparatus: r.apparatus || 'Egyéni',
                name: comp.name,
                date: comp.start_date,
                source: 'individual'
              });
            }
          });
        }

        // Összetett érmek
        if (aaRes?.data) {
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

        // Csapat-érmek
        teamResData.forEach(t => {
          if (t.placement === 1) gold++;
          else if (t.placement === 2) silver++;
          else if (t.placement === 3) bronze++;
          allMedals.push({
            placement: t.placement,
            apparatus: `Csapat (${t.name || 'csapat'})`,
            name: t.competition?.name || 'Verseny',
            date: t.competition?.start_date,
            source: 'team'
          });
        });

        // Historical érmek (JSONB)
        if (histRes?.data) {
          histRes.data.forEach(h => {
            const results = h.results || {};
            const date = h.year ? `${h.year}-12-31` : null; // év végét vesszük dátumnak

            // Egyéni szerek
            ['karika', 'labda', 'buzogany', 'szalag', 'kotel', 'szabad'].forEach(a => {
              if (results[a]?.placement && results[a].placement >= 1 && results[a].placement <= 3) {
                const p = results[a].placement;
                if (p === 1) gold++; else if (p === 2) silver++; else if (p === 3) bronze++;
                const labels = { 
                  szabad: 'Szabad', karika: 'Karika', labda: 'Labda',
                  buzogany: 'Buzogány', szalag: 'Szalag', kotel: 'Kötél'
                };
                allMedals.push({
                  placement: p,
                  apparatus: labels[a],
                  name: h.competition_name,
                  date,
                  source: 'historical'
                });
              }
            });

            // Összetett
            if (results.osszetett?.placement && results.osszetett.placement >= 1 && results.osszetett.placement <= 3) {
              const p = results.osszetett.placement;
              if (p === 1) gold++; else if (p === 2) silver++; else if (p === 3) bronze++;
              allMedals.push({
                placement: p,
                apparatus: 'Összetett',
                name: h.competition_name,
                date,
                source: 'historical'
              });
            }

            // Csapat (historical)
            if (results.csapat?.placement && results.csapat.placement >= 1 && results.csapat.placement <= 3) {
              const p = results.csapat.placement;
              if (p === 1) gold++; else if (p === 2) silver++; else if (p === 3) bronze++;
              allMedals.push({
                placement: p,
                apparatus: `Csapat (${h.team_name || 'csapat'})`,
                name: h.competition_name,
                date,
                source: 'historical'
              });
            }
          });
        }

        // Legfrissebb érem
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

      {/* ─── ÚJ FEJLÉC: serleg+felirat balra | avatar+név középen | kategória jobbra ─── */}
      <div className="rounded-2xl p-4 flex items-center gap-3" style={{
        background: 'linear-gradient(135deg, #FEF3C7 0%, #FCE4EC 100%)'
      }}>
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

        <div className="text-right text-xs leading-relaxed flex-shrink-0" style={{ color: COLORS.amberDark }}>
          <div className="font-bold">{competitor.kategoria}</div>
          <div>{competitor.korosztaly || 'versenyző'}</div>
          {age && <div style={{ color: '#B45309' }}>{age} éves</div>}
        </div>
      </div>

      {/* ─── SAJÁT ÉREMFALAD ─── */}
      <div className="rounded-2xl p-5 bg-white border-2" style={{ borderColor: '#FBCFE8' }}>
        <div className="text-sm font-bold mb-4 text-center" style={{ color: COLORS.amberDark }}>
          🏅 Saját éremfalad
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="text-6xl mb-1">🥇</div>
            <div className="text-4xl font-bold leading-none" style={{ color: COLORS.goldText }}>
              {medalStats.gold}
            </div>
            <div className="text-xs mt-1 text-gray-600">arany</div>
          </div>
          <div className="text-center">
            <div className="text-6xl mb-1">🥈</div>
            <div className="text-4xl font-bold leading-none" style={{ color: COLORS.silverText }}>
              {medalStats.silver}
            </div>
            <div className="text-xs mt-1 text-gray-600">ezüst</div>
          </div>
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

      {/* ─── ÉVENKÉNTI ÖSSZESÍTŐ (admin.jsx komponensei) ─── */}
      <CompetitorYearlyStats
        supabase={supabase}
        competitorId={competitor.id}
        competitorName={competitor.full_name}
      />

      <CompetitorTeamResults
        supabase={supabase}
        competitorId={competitor.id}
      />

      <CompetitorHistoricalResults
        supabase={supabase}
        competitorId={competitor.id}
        userRole="versenyzo"
      />

    </div>
  );
}
