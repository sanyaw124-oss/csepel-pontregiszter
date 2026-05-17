// ═══════════════════════════════════════════════════════════════════
// COMPETITOR TREASURE — "Kincsesládám" oldal
// 9. Legutóbbi érem kiemelve (LEGUTÓBB badge)
// 10. Minden érem külön kártyán + TÖBB SZERREL!
// 11. Top 8 ⭐
// 12. Statisztika alul (verseny / dobogós / Top 8)
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { Loader, AlertCircle, Trophy } from 'lucide-react';
import { safeQuery } from './competitor-dashboard';

// Helyezés → emoji
function placementEmoji(p) {
  if (p === 1) return '🥇';
  if (p === 2) return '🥈';
  if (p === 3) return '🥉';
  if (p >= 4 && p <= 8) return '⭐';
  return '·';
}

// Helyezés → háttérszín
function placementColor(p) {
  if (p === 1) return { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' };
  if (p === 2) return { bg: '#F3F4F6', border: '#9CA3AF', text: '#374151' };
  if (p === 3) return { bg: '#FED7AA', border: '#EA580C', text: '#9A3412' };
  if (p >= 4 && p <= 8) return { bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF' };
  return { bg: '#F3F4F6', border: '#9CA3AF', text: '#6B7280' };
}

export default function CompetitorTreasureView({ supabase, profile }) {
  const [competitor, setCompetitor] = useState(null);
  const [allResults, setAllResults] = useState([]); // minden eredmény, több szerrel
  const [stats, setStats] = useState({ versenyek: 0, dobogosok: 0, top8: 0 });
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
            .select('id, full_name, nickname')
            .eq('id', competitorId).maybeSingle()
        );
        if (compRes.data && mounted) setCompetitor(compRes.data);

        // EREDMÉNYEK: results-en NINCS competitor_id!
        // startlist_entries.competitor_id → results.startlist_entry_id
        const entriesRes = await safeQuery(() =>
          supabase.from('startlist_entries')
            .select(`
              id,
              competition_category_id,
              competition_categories(
                name,
                competition_day_id,
                competition_days(id, date, competitions(name))
              )
            `)
            .eq('competitor_id', competitorId)
        );
        
        let allRes = [];
        if (entriesRes.data && entriesRes.data.length > 0 && mounted) {
          const entryIds = entriesRes.data.map(e => e.id);
          const entryMap = {};
          entriesRes.data.forEach(e => { entryMap[e.id] = e; });
          
          const resultsRes = await safeQuery(() =>
            supabase.from('results')
              .select('startlist_entry_id, placement, score_total, apparatus, created_at, is_provisional')
              .in('startlist_entry_id', entryIds)
              .eq('is_provisional', false)
              .not('placement', 'is', null)
              .order('created_at', { ascending: false })
          );
          
          if (resultsRes.data) {
            allRes = resultsRes.data.map(r => {
              const entry = entryMap[r.startlist_entry_id];
              const cat = entry?.competition_categories;
              const day = cat?.competition_days;
              return {
                placement: r.placement,
                total: r.score_total,
                apparatus: r.apparatus,
                created_at: r.created_at,
                competition_day_id: cat?.competition_day_id,
                kategoria_neve: cat?.name,
                day_date: day?.date,
                competition_name: day?.competitions?.name || 'Verseny'
              };
            });
          }
        }

        if (mounted) {
          setAllResults(allRes);
          const uniqueDays = new Set(allRes.map(r => r.competition_day_id));
          setStats({
            versenyek: uniqueDays.size,
            dobogosok: allRes.filter(r => r.placement <= 3).length,
            top8: allRes.filter(r => r.placement >= 4 && r.placement <= 8).length
          });
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
    return <div className="max-w-md mx-auto py-8 text-center"><Loader className="w-8 h-8 animate-spin mx-auto text-amber-400" /></div>;
  }

  const greetingName = competitor?.nickname || competitor?.full_name?.split(' ').slice(-1)[0] || '';

  return (
    <div className="max-w-3xl mx-auto px-4 py-4" style={{
      background: 'linear-gradient(135deg, #FEF3C7 0%, #FCE4EC 100%)',
      borderRadius: '24px', minHeight: '500px'
    }}>
      <div className="text-center mb-4 pt-3">
        <div className="text-xl font-bold" style={{ color: '#BE123C' }}>★ Csepel SC RG ★</div>
        <div className="text-sm italic" style={{ color: '#EC4899', fontFamily: 'Caveat, cursive' }}>
          "Ügyesen, Okosan, Mosoly"
        </div>
      </div>

      <div className="text-center mb-5">
        <div className="text-2xl font-bold" style={{ color: '#92400E' }}>🏆 Kincsesládám</div>
        <div className="text-xs text-gray-500 mt-1">
          {greetingName ? `${greetingName} érmei` : 'Minden érmed itt csillog'}
        </div>
      </div>

      {!competitor && (
        <div className="rounded-2xl p-4 mb-4 bg-amber-50 border-2 border-amber-300 text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-amber-600 mb-2" />
          <div className="text-sm font-bold text-amber-900">Még nem találtunk hozzád versenyző profilt!</div>
        </div>
      )}

      {competitor && allResults.length === 0 && (
        <div className="rounded-2xl p-6 bg-white text-center">
          <div className="text-5xl mb-2">🎀</div>
          <div className="text-sm text-gray-600">Még nincs eredményed — de hamarosan jön!</div>
          <div className="text-xs text-gray-400 mt-2">Csak edz ügyesen, és minden érem ide kerül.</div>
        </div>
      )}

      {/* 9+10. MINDEN ÉREM KÜLÖN KÁRTYÁN, LEGUTÓBBI KIEMELVE */}
      {allResults.map((r, idx) => {
        const colors = placementColor(r.placement);
        const isRecent = idx === 0;
        const competitionName = r.competition_name || 'Verseny';
        const date = r.day_date;
        const apparatus = r.apparatus || r.kategoria_neve || '';

        return (
          <div key={idx} className="rounded-2xl p-3 mb-2 border-2 relative" style={{
            background: isRecent ? colors.bg : 'white',
            borderColor: colors.border,
            borderWidth: isRecent ? '3px' : '2px'
          }}>
            {isRecent && (
              <div style={{
                position: 'absolute', top: '-8px', left: '12px',
                background: colors.border, color: 'white',
                fontSize: '10px', padding: '3px 8px', borderRadius: '8px',
                fontWeight: 500
              }}>
                LEGUTÓBB
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="text-5xl">{placementEmoji(r.placement)}</div>
              <div className="flex-1">
                <div className="text-sm font-bold" style={{ color: colors.text }}>
                  {competitionName}
                </div>
                <div className="text-xs mt-0.5" style={{ color: colors.text }}>
                  {apparatus && <span>{apparatus} · </span>}
                  {date && <span>{new Date(date).toLocaleDateString('hu-HU')}</span>}
                </div>
                <div className="text-xs font-bold mt-1" style={{ color: colors.text }}>
                  {r.placement}. hely
                  {r.total && <span className="ml-2 font-normal">· {r.total} pont</span>}
                </div>
                {/* 11. TOP 8 BADGE */}
                {r.placement >= 4 && r.placement <= 8 && (
                  <div className="mt-1 inline-block px-2 py-0.5 rounded text-xs" style={{
                    background: '#DBEAFE', color: '#1E40AF'
                  }}>
                    Top 8 ⭐
                  </div>
                )}
                {isRecent && r.placement <= 3 && (
                  <div className="mt-1 inline-block px-2 py-0.5 rounded text-xs bg-white">
                    🌟 Király voltál!
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* 12. STATISZTIKA ALUL */}
      {allResults.length > 0 && (
        <div className="rounded-2xl p-4 mt-4 text-center" style={{
          background: 'linear-gradient(135deg, #C7D2FE, #DDD6FE)'
        }}>
          <div className="text-xs mb-2 font-bold" style={{ color: '#5B21B6' }}>📊 Eddigi statisztikád</div>
          <div className="flex justify-around text-xs" style={{ color: '#4C1D95' }}>
            <div>
              <strong style={{ fontSize: '24px' }}>{stats.versenyek}</strong>
              <br />verseny
            </div>
            <div>
              <strong style={{ fontSize: '24px' }}>{stats.dobogosok}</strong>
              <br />dobogós
            </div>
            <div>
              <strong style={{ fontSize: '24px' }}>{stats.top8}</strong>
              <br />Top 8
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
