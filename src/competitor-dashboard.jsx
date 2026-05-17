// ═══════════════════════════════════════════════════════════════════
// COMPETITOR DASHBOARD — Versenyzői ÁTTEKINTÉS
// v0.9.35 (2026.05.17 este) — teljes szélesség, közös elemek a szülővel
// 
// Tartalom (Sándor jóváhagyott terve):
// - Saját üdvözlés napszak szerint ("Szia Ori! 🌸")
// - Saját rózsaszín-lila "Csak az enyém" blokk:
//   - Saját szülinap countdown
//   - Saját éremfal
//   - Edzéseim csillagok + streak
//   - Fejlődsz kis kártya
//   - Magamról kártya (RG idézet)
// - HERO doboz (mint szülőnek)
// - Klubtársak születésnapjai (BirthdayWidget mint szülőnek)
// - Klub üzenőfal hírek (UpcomingEventsWidget)
// - Klub áttekintés statisztika
// - Legutóbbi csepeli sikerek
// - Klub büszkesége slideshow
// - Helyezések táblázat
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { Loader, AlertCircle } from 'lucide-react';

// HELPER
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

// ─────────────────────────────────────────────────────────────────
// "SAJÁT" ÚN. SZEMÉLYES BLOKK — csak a versenyzőnek
// ─────────────────────────────────────────────────────────────────
function MySelfBlock({ supabase, profile }) {
  const [competitor, setCompetitor] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentResult, setRecentResult] = useState(null);
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

        // EREDMÉNYEK startlist_entries-en át
        const entriesRes = await safeQuery(() =>
          supabase.from('startlist_entries')
            .select(`
              id,
              competition_categories(
                competition_days(competitions(name))
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
              .select('startlist_entry_id, placement, score_total, created_at, is_provisional')
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
            setRecentResult({
              placement: topResult.placement,
              competitionName: topResult.entry?.competition_categories?.competition_days?.competitions?.name || 'verseny',
            });
          }

          if (allResults.length >= 2) {
            const [a, b] = allResults;
            if (a.score_total && b.score_total) {
              const diff = a.score_total - b.score_total;
              setProgressTrend({ diff: Math.round(diff * 100) / 100, positive: diff > 0 });
            }
          }
        }

        // EDZÉSEK
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
        console.error('MySelfBlock:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [supabase, profile?.competitor_id, profile?.id, profile?.full_name]);

  if (loading) {
    return <div className="py-4 text-center"><Loader className="w-6 h-6 animate-spin mx-auto text-pink-400" /></div>;
  }

  if (!competitor) {
    return (
      <div className="rounded-2xl p-4 mb-4 bg-amber-50 border-2 border-amber-300 text-center mx-auto w-full">
        <AlertCircle className="w-8 h-8 mx-auto text-amber-600 mb-2" />
        <div className="text-sm font-bold text-amber-900">Még nem találtunk hozzád versenyző profilt!</div>
        <div className="text-xs text-amber-800 mt-1">Szólj az admin-nak.</div>
      </div>
    );
  }

  const greetingName = competitor.nickname || competitor.full_name?.split(' ').slice(-1)[0] || 'csapattársam';
  const greeting = getGreeting(greetingName);
  const stars = '⭐'.repeat(Math.min(trainingCount, 50));

  // Szülinap countdown
  const birthdayCountdown = (() => {
    if (!competitor.birth_date) return null;
    const today = new Date();
    const birth = new Date(competitor.birth_date);
    const thisYearBirth = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
    if (thisYearBirth < today) thisYearBirth.setFullYear(today.getFullYear() + 1);
    const days = Math.ceil((thisYearBirth - today) / (1000 * 60 * 60 * 24));
    return { days, date: thisYearBirth };
  })();

  return (
    <div className="rounded-3xl p-4 mb-6 mx-auto w-full" style={{
      background: 'linear-gradient(135deg, #FCE4EC 0%, #EDE9FE 100%)'
    }}>
      {/* Üdvözlés napszak szerint */}
      <div className="text-center mb-4">
        <div className="text-2xl font-bold" style={{ color: '#BE185D' }}>
          {greeting.text} <span className="text-xl">{greeting.emoji}</span>
        </div>
      </div>

      {/* Saját éremfal */}
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

      {/* Saját szülinap countdown */}
      {birthdayCountdown && (
        <div className="rounded-2xl p-4 mb-3 flex items-center gap-3" style={{
          background: 'linear-gradient(135deg, #FEF3C7, #FED7AA)'
        }}>
          <div className="text-5xl">🎂</div>
          <div>
            <div className="text-sm font-bold" style={{ color: '#92400E' }}>Az én szülinapomig...</div>
            <div className="text-3xl font-bold leading-none" style={{ color: '#92400E' }}>
              {birthdayCountdown.days === 0 ? '🎉 MA! 🎉' : `${birthdayCountdown.days} nap!`}
            </div>
            {birthdayCountdown.days > 0 && (
              <div className="text-xs" style={{ color: '#B45309' }}>
                {birthdayCountdown.date.toLocaleDateString('hu-HU', { month: 'long', day: 'numeric' })} ✨
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edzéseim csillagok + streak */}
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

      {/* Fejlődsz kis kártya */}
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

      {/* Magamról kártya */}
      <div className="rounded-2xl p-4 text-center" style={{
        background: 'linear-gradient(135deg, #DDD6FE 0%, #C7D2FE 100%)'
      }}>
        <div className="text-3xl mb-1">{competitor.avatar_emoji || '🎀'}</div>
        <div className="text-sm font-bold" style={{ color: '#5B21B6' }}>
          {competitor.nickname ? `"${competitor.nickname}" ` : ''}{competitor.full_name}
        </div>
        <div className="text-xs" style={{ color: '#5B21B6' }}>
          {competitor.kategoria} · {competitor.korosztaly || 'Versenyző'}
          {competitor.birth_year ? ` · ${new Date().getFullYear() - competitor.birth_year} éves` : ''}
        </div>
        <div className="text-xs text-gray-600 mt-1">Csepel RG Klub ★ csapat tagja</div>
        <div className="text-xs italic mt-2" style={{ color: '#831843' }}>
          💭 "{getTodaysQuote()}"
        </div>
      </div>
    </div>
  );
}

export default MySelfBlock;
export { safeQuery, getGreeting };
