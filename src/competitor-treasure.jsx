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
import { BadgesPanel, loadBadgeData } from './badges';
import { CompetitorStatsPanel } from './stats';
import { EvaluationsView } from './evaluation';
import { StoriesPanel } from './stories';
import { FriendsPanel, GreetingsPanel } from './friends';

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

        // v0.9.77: az érmeket ugyanaz az egységes számolás adja, mint a Profil és az
        // Eredmény-összesítő: minden 1–3. hely (egyéni szer, összetett, csapat), csak
        // lezárt versenyekből + a korábbi eredményekből
        const badgeData = await loadBadgeData(supabase, competitorId);
        let gold = 0, silver = 0, bronze = 0;
        const allMedals = [];
        badgeData.comps.forEach(c => (c.items || []).forEach(it => {
          if (it.placement < 1 || it.placement > 3) return;
          if (it.placement === 1) gold++; else if (it.placement === 2) silver++; else bronze++;
          allMedals.push({ placement: it.placement, apparatus: it.label, name: c.name, date: c.date });
        }));

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
        <div className="text-[11px] text-gray-500 text-center mt-3">Érem = minden 1–3. hely (egyéni szer, összetett, csapat); minden év, lezárt versenyekből és a korábbi eredményekből.</div>

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

      {/* ─── v0.9.64: KITŰZŐK + RÓLAM ─── */}
      <EvaluationsView supabase={supabase} competitorId={competitor.id} title="Edzőm értékelése" />
      <BadgesPanel supabase={supabase} competitorId={competitor.id} title="Kitűzőim" />
      <StoriesPanel supabase={supabase} competitorId={competitor.id} canWrite />
      {/* v0.9.82: legjobb barátnők (csak ti ketten + a szülők látjátok) és a kapott köszöntések */}
      <div className="my-3 space-y-3">
        <FriendsPanel supabase={supabase} competitorId={competitor.id} canWrite />
        <GreetingsPanel supabase={supabase} competitorId={competitor.id} />
      </div>
      <CompetitorStatsPanel supabase={supabase} competitorId={competitor.id} />

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
