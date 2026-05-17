// ═══════════════════════════════════════════════════════════════════
// COMPETITOR TREASURE — "Kincsesládám" oldal
// v0.9.36: a működő admin.jsx komponenseket használja
// (CompetitorYearlyStats, CompetitorTeamResults, CompetitorHistoricalResults)
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { Loader, AlertCircle } from 'lucide-react';
import { safeQuery } from './competitor-dashboard';
import { 
  CompetitorYearlyStats, 
  CompetitorTeamResults, 
  CompetitorHistoricalResults 
} from './admin';

export default function CompetitorTreasureView({ supabase, profile }) {
  const [competitor, setCompetitor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        let competitorId = profile?.competitor_id;
        if (!competitorId && profile?.full_name) {
          const fb = await safeQuery(() =>
            supabase.from('competitors').select('id')
              .eq('full_name', profile.full_name).limit(1).maybeSingle()
          );
          if (fb.data?.id) competitorId = fb.data.id;
        }
        if (!competitorId) { if (mounted) setLoading(false); return; }

        const compRes = await safeQuery(() =>
          supabase.from('competitors')
            .select('id, full_name, nickname, kategoria, korosztaly, avatar_emoji')
            .eq('id', competitorId).maybeSingle()
        );
        if (compRes.data && mounted) setCompetitor(compRes.data);
      } catch (err) {
        console.error('Treasure:', err);
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

  const greetingName = competitor.nickname || competitor.full_name?.split(' ').slice(-1)[0] || '';

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Fejléc */}
      <div className="rounded-2xl p-5 text-center" style={{
        background: 'linear-gradient(135deg, #FEF3C7 0%, #FCE4EC 100%)'
      }}>
        <div className="text-4xl mb-2">{competitor.avatar_emoji || '🏆'}</div>
        <div className="text-2xl font-bold" style={{ color: '#92400E' }}>
          🏆 Kincsesládám
        </div>
        <div className="text-sm text-gray-600 mt-1">
          {greetingName ? `${greetingName} érmei és sikerei` : 'Minden érmed itt csillog'}
        </div>
      </div>

      {/* Évvégi statisztika - ÉVENKÉNTI érem összesítés */}
      <CompetitorYearlyStats 
        supabase={supabase} 
        competitorId={competitor.id} 
        competitorName={competitor.full_name} 
      />

      {/* Csapat-eredmények */}
      <CompetitorTeamResults 
        supabase={supabase} 
        competitorId={competitor.id} 
      />

      {/* Korábbi eredmények */}
      <CompetitorHistoricalResults 
        supabase={supabase} 
        competitorId={competitor.id} 
        userRole="versenyzo" 
      />
    </div>
  );
}
