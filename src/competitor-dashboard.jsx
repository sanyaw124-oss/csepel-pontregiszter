// ═══════════════════════════════════════════════════════════════════
// COMPETITOR DASHBOARD — Versenyzői ÁTTEKINTÉS oldal
// 8 modul Petra+Ori IGENJEI alapján
// v0.9.32 (2026.05.17)
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { Lock, Loader, AlertCircle } from 'lucide-react';

function getGreeting(name) {
  const hour = new Date().getHours();
  const displayName = name || 'csapattársam';
  if (hour < 10) return { text: `Jó reggelt ${displayName}!`, emoji: '🌅' };
  if (hour < 14) return { text: `Szia ${displayName}!`, emoji: '🌸' };
  if (hour < 18) return { text: `Szia ${displayName}, hogy vagy?`, emoji: '☀️' };
  if (hour < 22) return { text: `Jó estét ${displayName}!`, emoji: '🌙' };
  return { text: `Szia ${displayName}!`, emoji: '✨' };
}

// CSAK RG-S idézetek (Petra+Ori: ne táncos!)
const RG_QUOTES = [
  'A karika a kezed meghosszabbítása — érezd a ritmusát.',
  'Ügyesen, Okosan, Mosoly. ✨',
  'Egy verseny — egy lecke — egy fejlődés.',
  'A buzogány partner, nem ellenfél.',
  'A szalag mesél — te vagy a történet.',
  'Minden edzés egy lépés az álmaid felé.',
  'A labda úgy gurul, ahogy te akarod.',
  'A kötél nem ellenfél — partner.',
  'Soha ne add fel, ott kezdődik a varázs.',
  'Az RG nem sport — szenvedély.'
];

function getTodaysQuote() {
  return RG_QUOTES[new Date().getDate() % RG_QUOTES.length];
}

const safeQuery = async (queryFn) => {
  const delays = [0, 100, 300, 700];
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]));
    try {
      const result = await queryFn();
      if (!result.error) return result;
      if (result.error?.name === 'AbortError' || result.error?.message?.includes('Abort')) continue;
      return result;
    } catch (err) {
      if (err.name === 'AbortError' || err.message?.includes('Abort')) continue;
      throw err;
    }
  }
  return { data: null, error: { message: 'Lekérdezés sikertelen' } };
};

export default function CompetitorDashboard({ supabase, profile }) {
  const [competitor, setCompetitor] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentResult, setRecentResult] = useState(null);
  const [nextCompetition, setNextCompetition] = useState(null);
  const [trainingCount, setTrainingCount] = useState(0);
  const [weekStreak, setWeekStreak] = useState(0);
  const [progressTrend, setProgressTrend] = useState(null);
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
          if (fb.data?.id) {
            competitorId = fb.data.id;
            await supabase.from('profiles').update({ competitor_id: competitorId }).eq('id', profile.id);
          }
        }

        if (!competitorId) { if (mounted) setLoading(false); return; }

        const compRes = await safeQuery(() =>
          supabase.from('competitors')
            .select('id, full_name, nickname, kategoria, korosztaly, birth_year, birth_date, avatar_emoji')
            .eq('id', competitorId).maybeSingle()
        );
        if (compRes.data && mounted) setCompetitor(compRes.data);

        // EREDMÉNYEK: results-en NINCS competitor_id! 
        // Kapcsolat: startlist_entries.competitor_id → results.startlist_entry_id
        const entriesRes = await safeQuery(() =>
          supabase.from('startlist_entries')
            .select(`
              id, 
              competition_category_id,
              competition_categories(
                competition_day_id,
                competition_days(date, competitions(name))
              )
            `)
            .eq('competitor_id', competitorId)
        );
        
        let allResults = [];
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
            allResults = resultsRes.data.map(r => ({
              ...r,
              entry: entryMap[r.startlist_entry_id]
            }));
          }
        }

        if (mounted && allResults.length > 0) {
          const arany = allResults.filter(r => r.placement === 1).length;
          const ezust = allResults.filter(r => r.placement === 2).length;
          const bronz = allResults.filter(r => r.placement === 3).length;
          setStats({ arany, ezust, bronz, osszes: allResults.length });

          const topResult = allResults.find(r => r.placement <= 3);
          if (topResult) {
            const competitionName = topResult.entry?.competition_categories?.competition_days?.competitions?.name || 'verseny';
            setRecentResult({
              placement: topResult.placement,
              competitionName,
            });
          }

          if (allResults.length >= 2) {
            const lastTwo = allResults.slice(0, 2);
            if (lastTwo[0].score_total && lastTwo[1].score_total) {
              const diff = lastTwo[0].score_total - lastTwo[1].score_total;
              setProgressTrend({ diff: Math.round(diff * 100) / 100, positive: diff > 0 });
            }
          }
        }

        const today = new Date().toISOString().split('T')[0];
        const compsRes = await safeQuery(() =>
          supabase.from('competition_days')
            .select('date, competitions(name)')
            .gte('date', today)
            .order('date', { ascending: true })
            .limit(1)
        );
        if (compsRes.data?.[0] && mounted) {
          const day = compsRes.data[0];
          const daysUntil = Math.ceil((new Date(day.date) - new Date()) / (1000 * 60 * 60 * 24));
          setNextCompetition({
            name: day.competitions?.name || 'Verseny',
            daysUntil: Math.max(0, daysUntil)
          });
        }

        const yearStart = `${new Date().getFullYear()}-01-01`;
        const attendRes = await safeQuery(() =>
          supabase.from('training_attendance')
            .select('id, training_sessions!inner(date, session_type)')
            .eq('competitor_id', competitorId)
            .gte('training_sessions.date', yearStart)
        );
        if (attendRes.data && mounted) {
          const countable = attendRes.data.filter(a =>
            ['edzes', 'egesznapos'].includes(a.training_sessions?.session_type)
          );
          setTrainingCount(countable.length);

          const weekMap = {};
          countable.forEach(a => {
            if (a.training_sessions?.date) {
              const d = new Date(a.training_sessions.date);
              const year = d.getFullYear();
              const week = Math.ceil((((d - new Date(year, 0, 1)) / 86400000) + new Date(year, 0, 1).getDay() + 1) / 7);
              weekMap[`${year}-${week}`] = true;
            }
          });
          let streak = 0;
          const now = new Date();
          for (let i = 0; i < 52; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() - i * 7);
            const year = d.getFullYear();
            const week = Math.ceil((((d - new Date(year, 0, 1)) / 86400000) + new Date(year, 0, 1).getDay() + 1) / 7);
            if (weekMap[`${year}-${week}`]) streak++;
            else if (i > 0) break;
          }
          setWeekStreak(streak);
        }
      } catch (err) {
        console.error('CompetitorDashboard:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, [supabase, profile?.competitor_id, profile?.id, profile?.full_name]);

  if (loading) {
    return (
      <div className="max-w-md mx-auto py-8 text-center">
        <Loader className="w-8 h-8 animate-spin mx-auto text-pink-400" />
      </div>
    );
  }

  // BECENÉV PRIORITÁS!
  const greetingName = competitor?.nickname || competitor?.full_name?.split(' ').slice(-1)[0] || 'csapattársam';
  const greeting = getGreeting(greetingName);
  const stars = '⭐'.repeat(Math.min(trainingCount, 50));

  return (
    <div className="max-w-md mx-auto px-4 py-4" style={{
      background: 'linear-gradient(135deg, #FCE4EC 0%, #EDE9FE 100%)',
      borderRadius: '24px',
      minHeight: '500px'
    }}>
      <div className="text-center mb-4 pt-3">
        <div className="text-xl font-bold" style={{ color: '#BE123C' }}>★ Csepel SC RG ★</div>
        <div className="text-sm italic" style={{ color: '#EC4899', fontFamily: 'Caveat, cursive' }}>
          "Ügyesen, Okosan, Mosoly"
        </div>
      </div>

      {!competitor && (
        <div className="rounded-2xl p-4 mb-4 bg-amber-50 border-2 border-amber-300 text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-amber-600 mb-2" />
          <div className="text-sm font-bold text-amber-900 mb-1">
            Még nem találtunk hozzád versenyző profilt!
          </div>
          <div className="text-xs text-amber-800">
            Szólj az admin-nak, hogy kapcsolja össze a fiókodat.
          </div>
        </div>
      )}

      {/* 1. ÜDVÖZLÉS NAPSZAK SZERINT */}
      <div className="text-center mb-5">
        <div className="text-xs text-gray-500 mb-1">
          {new Date().toLocaleDateString('hu-HU', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        <div className="text-2xl font-bold" style={{ color: '#BE185D' }}>
          {greeting.text} <span className="text-xl">{greeting.emoji}</span>
        </div>
      </div>

      {/* 2. SORON KÖV. VERSENY COUNTDOWN */}
      {nextCompetition && (
        <div className="rounded-2xl p-4 mb-3 text-white text-center" style={{
          background: 'linear-gradient(135deg, #F59E0B 0%, #EC4899 100%)'
        }}>
          <div className="text-xs opacity-90 mb-1">SORON KÖVETKEZŐ VERSENY</div>
          <div className="text-lg font-bold mb-2">🏆 {nextCompetition.name}</div>
          <div className="text-4xl font-bold leading-none">{nextCompetition.daysUntil}</div>
          <div className="text-xs opacity-90 mt-1">
            {nextCompetition.daysUntil === 0 ? 'MA! ⏰' :
             nextCompetition.daysUntil === 1 ? 'holnap! ⏰' :
             'nap múlva ⏰'}
          </div>
        </div>
      )}

      {/* 3+4. ÉREMFAL + LEGUTÓBBI SIKER */}
      {stats && stats.osszes > 0 && (
        <div className="rounded-2xl p-4 mb-3 bg-white border-2" style={{ borderColor: '#FBCFE8' }}>
          <div className="text-center font-bold mb-3" style={{ color: '#BE185D' }}>🏅 Saját éremfalad</div>
          <div className="flex justify-around text-center">
            <div>
              <div className="text-4xl">🥇</div>
              <div className="text-2xl font-bold" style={{ color: '#D97706' }}>{stats.arany}</div>
              <div className="text-xs text-gray-500">arany</div>
            </div>
            <div>
              <div className="text-4xl">🥈</div>
              <div className="text-2xl font-bold text-gray-600">{stats.ezust}</div>
              <div className="text-xs text-gray-500">ezüst</div>
            </div>
            <div>
              <div className="text-4xl">🥉</div>
              <div className="text-2xl font-bold" style={{ color: '#B45309' }}>{stats.bronz}</div>
              <div className="text-xs text-gray-500">bronz</div>
            </div>
          </div>
          {recentResult && (
            <div className="rounded-xl p-3 mt-3 text-center text-xs" style={{
              background: '#FEF3C7', color: '#92400E'
            }}>
              🌟 Legutóbb: <strong>{recentResult.competitionName}</strong><br />
              <span className="text-xs">
                {recentResult.placement === 1 ? '🥇 1. hely' :
                 recentResult.placement === 2 ? '🥈 2. hely' : '🥉 3. hely'} — Király voltál!
              </span>
            </div>
          )}
        </div>
      )}

      {/* 5+6. EDZÉSEIM CSILLAGOK + HETI STREAK */}
      {trainingCount > 0 && (
        <div className="rounded-2xl p-4 mb-3 bg-white border-2" style={{ borderColor: '#FCD34D' }}>
          <div className="text-sm font-bold mb-2" style={{ color: '#92400E' }}>💪 Edzéseim idén</div>
          <div className="flex items-baseline gap-2 mb-3">
            <div className="text-4xl font-bold" style={{ color: '#92400E' }}>{trainingCount}</div>
            <div className="text-sm text-gray-500">edzésnap eddig 🎉</div>
          </div>
          <div className="text-base leading-relaxed break-all">
            {stars}
            {trainingCount > 50 && <span className="text-xs text-gray-500 ml-2">+ {trainingCount - 50}</span>}
          </div>
          {weekStreak >= 2 && (
            <div className="rounded-xl p-2 mt-3 text-center text-xs flex items-center justify-center gap-2" style={{
              background: '#FED7AA', color: '#9A3412'
            }}>
              <span className="text-lg">🔥</span>
              <span><strong>{weekStreak} hete</strong> sorban edzel — gyönyörű!</span>
            </div>
          )}
        </div>
      )}

      {/* 7. FEJLŐDSZ KIS KÁRTYA */}
      {progressTrend && progressTrend.positive && (
        <div className="rounded-2xl p-3 mb-3 bg-white border-2 flex items-center gap-3"
             style={{ borderColor: '#C7D2FE' }}>
          <div className="text-3xl">📈</div>
          <div className="flex-1">
            <div className="text-sm font-bold" style={{ color: '#3730A3' }}>
              Fejlődsz az utóbbi versenyek óta!
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              +{progressTrend.diff} pont az utolsó eredménnyel 🎯
            </div>
          </div>
        </div>
      )}

      {/* 8. MAGAMRÓL KÁRTYA */}
      {competitor && (
        <div className="rounded-2xl p-4 mb-3 text-center" style={{
          background: 'linear-gradient(135deg, #DDD6FE 0%, #C7D2FE 100%)'
        }}>
          <div className="text-3xl mb-1">🎀</div>
          <div className="text-sm font-bold" style={{ color: '#5B21B6' }}>
            {competitor.nickname ? `"${competitor.nickname}" ` : ''}{competitor.full_name}
          </div>
          <div className="text-xs" style={{ color: '#5B21B6' }}>
            {competitor.kategoria} · {competitor.korosztaly || 'Versenyző'}
            {competitor.birth_year ? ` · ${new Date().getFullYear() - competitor.birth_year} éves` : ''}
          </div>
          <div className="text-xs text-gray-600 mt-1">Csepel SC RG ★ csapat tagja</div>
        </div>
      )}

      {/* RG IDÉZET (csak RG-s!) */}
      <div className="rounded-2xl p-3 mb-3 text-center" style={{
        background: 'linear-gradient(135deg, #FCE7F3, #FBCFE8)'
      }}>
        <div className="text-2xl mb-1">💭</div>
        <div className="text-xs italic" style={{ color: '#831843' }}>"{getTodaysQuote()}"</div>
      </div>

    </div>
  );
}

export { safeQuery, getGreeting };
