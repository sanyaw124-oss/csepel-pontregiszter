// ═══════════════════════════════════════════════════════════════════
// COMPETITOR DASHBOARD — Versenyzői Áttekintés oldal
// Vidám, ösztönző, RG-témájú
// Petra & Ori válaszai alapján tervezve (v0.9.29)
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import {
  Star, Trophy, Award, Heart, Flame, TrendingUp, Calendar,
  Cake, Users, MessageCircle, Sparkles, Sun, Moon
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────
// 30+ RG-TÉMÁJÚ AVATAR
// ─────────────────────────────────────────────────────────────────
const RG_AVATARS = [
  // RG-eszközök és sport
  '🤸‍♀️', '🩰', '🎯', '🏆', '🏅', '🎖️', '🥇', '🥈', '🥉',
  // Virágok (RG ritmika hangulat)
  '🌸', '🌺', '🌷', '🌻', '🌹', '🪷', '🌼', '💐',
  // Cuki állatok
  '🦄', '🐱', '🐶', '🐰', '🦋', '🐝', '🐧', '🦊',
  // Csillogás és varázs
  '⭐', '🌟', '✨', '💫', '💎', '👑', '🎀', '💖',
  // Hangulat és időjárás
  '🌈', '☀️', '🌙', '🔥', '🍓', '💪'
];

// Napszak szerinti üdvözlések
function getGreeting(nickname) {
  const hour = new Date().getHours();
  const name = nickname || 'csillagom';
  if (hour < 10) return { text: `Jó reggelt ${name}!`, emoji: '🌅' };
  if (hour < 14) return { text: `Szia ${name}!`, emoji: '🌸' };
  if (hour < 18) return { text: `Szia ${name}, hogy vagy?`, emoji: '☀️' };
  if (hour < 22) return { text: `Jó estét ${name}!`, emoji: '🌙' };
  return { text: `Szia ${name}!`, emoji: '✨' };
}

// Motiváló idézetek (RG-s, nem táncos!)
const RG_QUOTES = [
  { text: 'A karika egy körforgás — minden mozdulat számít.', author: 'RG bölcsesség' },
  { text: 'Ügyesen, okosan, mosoly.', author: 'Csepel SC RG' },
  { text: 'Aki kitart, az ér célba.', author: '' },
  { text: 'Minden edzés egy lépés az álmaid felé.', author: '' },
  { text: 'A buzogány a kezed meghosszabbítása — érezd!', author: '' },
  { text: 'A szalag mesél — te vagy a történet.', author: '' },
  { text: 'A labda mintha élne — érezd a ritmusát.', author: '' },
  { text: 'A kötél nem ellenfél — partner.', author: '' },
  { text: 'Soha ne add fel, ha kicsit nehéz — a varázs ott kezdődik.', author: '' },
  { text: 'Egy verseny — egy lecke — egy fejlődés.', author: '' }
];

function getTodaysQuote() {
  // A nap napjától függően változik
  const day = new Date().getDate();
  return RG_QUOTES[day % RG_QUOTES.length];
}

// ─────────────────────────────────────────────────────────────────
// FŐ KOMPONENS
// ─────────────────────────────────────────────────────────────────

export default function CompetitorDashboard({ supabase, profile, setActiveView }) {
  const [competitor, setCompetitor] = useState(null);    // a versenyző saját adatai
  const [stats, setStats] = useState(null);              // érem statisztika
  const [recentResult, setRecentResult] = useState(null); // legutóbbi eredmény
  const [nextCompetition, setNextCompetition] = useState(null); // soron köv. verseny
  const [trainingCount, setTrainingCount] = useState(0); // edzés szám idén
  const [weekStreak, setWeekStreak] = useState(0);       // heti streak
  const [teammates, setTeammates] = useState([]);        // csapattársak
  const [recentEvents, setRecentEvents] = useState([]);  // klub üzenőfal hírek
  const [progressTrend, setProgressTrend] = useState(null); // fejlődési kis kártya
  const [selectedAvatar, setSelectedAvatar] = useState('🦄'); // választott avatar
  const [loading, setLoading] = useState(true);

  // Versenyző saját adatainak betöltése
  useEffect(() => {
    let mounted = true;
    
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

    const load = async () => {
      try {
        if (!profile?.competitor_id) {
          // Nincs hozzárendelt versenyző profil — csak az alap üdvözlés látszik
          if (mounted) setLoading(false);
          return;
        }

        // 1. Versenyző saját adatai
        const compRes = await safeQuery(() =>
          supabase
            .from('competitors')
            .select('id, full_name, nickname, kategoria, korosztaly, birth_year, birth_date, avatar_emoji')
            .eq('id', profile.competitor_id)
            .maybeSingle()
        );
        if (compRes.data && mounted) {
          setCompetitor(compRes.data);
          if (compRes.data.avatar_emoji) setSelectedAvatar(compRes.data.avatar_emoji);
        }

        // 2. Érem statisztika (results táblából csak véglegesített, dobogós)
        const resultsRes = await safeQuery(() =>
          supabase
            .from('results')
            .select('placement, competition_day_id, kategoria_id, total, created_at')
            .eq('competitor_id', profile.competitor_id)
            .eq('is_finalized', true)
            .not('placement', 'is', null)
            .order('created_at', { ascending: false })
        );
        if (resultsRes.data && mounted) {
          const arany = resultsRes.data.filter(r => r.placement === 1).length;
          const ezust = resultsRes.data.filter(r => r.placement === 2).length;
          const bronz = resultsRes.data.filter(r => r.placement === 3).length;
          const top8 = resultsRes.data.filter(r => r.placement >= 4 && r.placement <= 8).length;
          setStats({ arany, ezust, bronz, top8, osszes: resultsRes.data.length });
          
          // Legutóbbi dobogós eredmény (ha van)
          const topResult = resultsRes.data.find(r => r.placement <= 3);
          if (topResult) {
            // Verseny neve lekérdezése
            const dayRes = await safeQuery(() =>
              supabase
                .from('competition_days')
                .select('date, competition_id, competitions(name)')
                .eq('id', topResult.competition_day_id)
                .maybeSingle()
            );
            setRecentResult({
              ...topResult,
              competitionName: dayRes.data?.competitions?.name || 'verseny',
              date: dayRes.data?.date
            });
          }
        }

        // 3. Soron következő verseny (mai dátum után)
        const today = new Date().toISOString().split('T')[0];
        const compsRes = await safeQuery(() =>
          supabase
            .from('competition_days')
            .select('date, competition_id, competitions(name)')
            .gte('date', today)
            .order('date', { ascending: true })
            .limit(1)
        );
        if (compsRes.data?.[0] && mounted) {
          const day = compsRes.data[0];
          const daysUntil = Math.ceil((new Date(day.date) - new Date()) / (1000 * 60 * 60 * 24));
          setNextCompetition({
            name: day.competitions?.name || 'Verseny',
            date: day.date,
            daysUntil: Math.max(0, daysUntil)
          });
        }

        // 4. Edzés szám idén
        const yearStart = `${new Date().getFullYear()}-01-01`;
        const attendRes = await safeQuery(() =>
          supabase
            .from('training_attendance')
            .select('id, session_id, training_sessions!inner(date, session_type)')
            .eq('competitor_id', profile.competitor_id)
            .gte('training_sessions.date', yearStart)
        );
        if (attendRes.data && mounted) {
          // Edzés + egésznapos típusok számolása
          const countableTypes = ['edzes', 'egesznapos'];
          const trainings = attendRes.data.filter(a => 
            countableTypes.includes(a.training_sessions?.session_type)
          );
          setTrainingCount(trainings.length);

          // Heti streak számolása (utolsó X hét, amikor min. 1 edzés volt)
          const weekMap = {};
          trainings.forEach(a => {
            if (a.training_sessions?.date) {
              const d = new Date(a.training_sessions.date);
              const year = d.getFullYear();
              const week = Math.ceil((((d - new Date(year, 0, 1)) / 86400000) + new Date(year, 0, 1).getDay() + 1) / 7);
              weekMap[`${year}-${week}`] = true;
            }
          });
          // Visszafelé számoljuk hány hete megszakítatlanul
          let streak = 0;
          const now = new Date();
          for (let i = 0; i < 52; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() - i * 7);
            const year = d.getFullYear();
            const week = Math.ceil((((d - new Date(year, 0, 1)) / 86400000) + new Date(year, 0, 1).getDay() + 1) / 7);
            if (weekMap[`${year}-${week}`]) streak++;
            else if (i > 0) break; // jelenlegi héten lehet még nincs, de visszamenőleg ha hiányzik break
          }
          setWeekStreak(streak);
        }

        // 5. Csapattársak — same kategória és aktív
        if (compRes.data?.kategoria) {
          const teamRes = await safeQuery(() =>
            supabase
              .from('competitors')
              .select('id, full_name, nickname, avatar_emoji')
              .eq('kategoria', compRes.data.kategoria)
              .eq('is_active', true)
              .neq('id', profile.competitor_id)
              .limit(10)
          );
          if (teamRes.data && mounted) setTeammates(teamRes.data);
        }

        // 6. Klub üzenőfal hírek (legutóbbi 3)
        const eventsRes = await safeQuery(() =>
          supabase
            .from('events')
            .select('id, title, event_type, event_date, description')
            .order('event_date', { ascending: false })
            .limit(3)
        );
        if (eventsRes.data && mounted) setRecentEvents(eventsRes.data);

        // 7. Fejlődési trend (utolsó 2 véglegesített eredmény össze-hasonlítása)
        if (resultsRes.data && resultsRes.data.length >= 2) {
          const lastTwo = resultsRes.data.slice(0, 2);
          if (lastTwo[0].total && lastTwo[1].total) {
            const diff = lastTwo[0].total - lastTwo[1].total;
            setProgressTrend({ diff: Math.round(diff * 100) / 100, positive: diff > 0 });
          }
        }
      } catch (err) {
        console.error('CompetitorDashboard load error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, [supabase, profile?.competitor_id]);

  // Avatar mentés
  const saveAvatar = async (emoji) => {
    setSelectedAvatar(emoji);
    if (profile?.competitor_id) {
      await supabase
        .from('competitors')
        .update({ avatar_emoji: emoji })
        .eq('id', profile.competitor_id);
    }
  };

  // Szülinap countdown
  const birthdayCountdown = (() => {
    if (!competitor?.birth_date) return null;
    const today = new Date();
    const birth = new Date(competitor.birth_date);
    const thisYearBirth = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
    if (thisYearBirth < today) thisYearBirth.setFullYear(today.getFullYear() + 1);
    const days = Math.ceil((thisYearBirth - today) / (1000 * 60 * 60 * 24));
    return { days, date: thisYearBirth };
  })();

  // Csillag tábla a edzésszámhoz (max 50 csillag)
  const stars = '⭐'.repeat(Math.min(trainingCount, 50));

  const greeting = getGreeting(competitor?.nickname);
  const quote = getTodaysQuote();

  if (loading) {
    return (
      <div className="max-w-md mx-auto py-8 text-center">
        <div className="text-6xl mb-4">🌸</div>
        <div className="text-gray-500">Töltődik...</div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6" style={{
      background: 'linear-gradient(135deg, #FCE4EC 0%, #EDE9FE 100%)',
      borderRadius: '24px',
      minHeight: 'calc(100vh - 200px)'
    }}>
      
      {/* CSEPEL SC RG LOGÓ + SZLOGEN — FIX TETEJÉN */}
      <div className="text-center mb-4 pt-4">
        <div className="text-xl font-bold" style={{ color: '#BE123C' }}>
          ★ Csepel SC RG ★
        </div>
        <div className="text-sm italic" style={{ color: '#EC4899', fontFamily: 'Caveat, cursive' }}>
          "Ügyesen, Okosan, Mosoly"
        </div>
      </div>

      {/* 1. ÜDVÖZLÉS NAPSZAK SZERINT */}
      <div className="text-center mb-6">
        <div className="text-xs text-gray-500 mb-1">
          {new Date().toLocaleDateString('hu-HU', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        <div className="text-2xl font-bold" style={{ color: '#BE185D' }}>
          {greeting.text} <span className="text-xl">{greeting.emoji}</span>
        </div>
      </div>

      {/* 2. SORON KÖVETKEZŐ VERSENY COUNTDOWN */}
      {nextCompetition && (
        <div className="rounded-2xl p-4 mb-4 text-white text-center" style={{
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
      {stats && (
        <div className="rounded-2xl p-4 mb-4 bg-white border-2" style={{ borderColor: '#FBCFE8' }}>
          <div className="text-center font-bold mb-3" style={{ color: '#BE185D' }}>
            🏅 Saját éremfalad
          </div>
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
            {stats.top8 > 0 && (
              <div>
                <div className="text-4xl">⭐</div>
                <div className="text-2xl font-bold text-blue-600">{stats.top8}</div>
                <div className="text-xs text-gray-500">Top 8</div>
              </div>
            )}
          </div>
          {recentResult && (
            <div className="rounded-xl p-3 mt-3 text-center text-xs" style={{
              background: '#FEF3C7',
              color: '#92400E'
            }}>
              🌟 Legutóbb: <strong>{recentResult.competitionName}</strong>
              <br />
              <span className="text-xs">
                {recentResult.placement === 1 ? '🥇 1. hely' : 
                 recentResult.placement === 2 ? '🥈 2. hely' : 
                 '🥉 3. hely'} — Király voltál!
              </span>
            </div>
          )}
        </div>
      )}

      {/* 5+6. EDZÉSEIM CSILLAGOK + HETI STREAK */}
      <div className="rounded-2xl p-4 mb-4 bg-white border-2" style={{ borderColor: '#FCD34D' }}>
        <div className="text-sm font-bold mb-2" style={{ color: '#92400E' }}>
          💪 Edzéseim idén
        </div>
        <div className="flex items-baseline gap-2 mb-3">
          <div className="text-4xl font-bold" style={{ color: '#92400E' }}>{trainingCount}</div>
          <div className="text-sm text-gray-500">edzésnap eddig 🎉</div>
        </div>
        {trainingCount > 0 && (
          <div className="text-base leading-relaxed break-all">
            {stars}
            {trainingCount > 50 && (
              <span className="text-xs text-gray-500 ml-2">+ {trainingCount - 50} ⭐</span>
            )}
          </div>
        )}
        {weekStreak >= 2 && (
          <div className="rounded-xl p-2 mt-3 text-center text-xs flex items-center justify-center gap-2" style={{
            background: '#FED7AA',
            color: '#9A3412'
          }}>
            <span className="text-lg">🔥</span>
            <span><strong>{weekStreak} hete</strong> sorban edzel — gyönyörű!</span>
          </div>
        )}
      </div>

      {/* 7. FEJLŐDSZ — KIS KÁRTYA */}
      {progressTrend && progressTrend.positive && (
        <div className="rounded-2xl p-3 mb-4 bg-white border-2 flex items-center gap-3 cursor-pointer" 
             style={{ borderColor: '#C7D2FE' }}
             onClick={() => setActiveView && setActiveView('profile')}>
          <div className="text-3xl">📈</div>
          <div className="flex-1">
            <div className="text-sm font-bold" style={{ color: '#3730A3' }}>
              Fejlődsz az utóbbi versenyek óta!
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              +{progressTrend.diff} pont az utolsó eredménnyel 🎯
            </div>
          </div>
          <div className="text-2xl text-indigo-500">›</div>
        </div>
      )}

      {/* 9. LEGUTÓBBI ÉREM KIEMELVE (ha még nem mutattuk legutóbbi siker-ként) */}
      {/* Az éremfal-ban már megvan */}

      {/* 10. SZÜLINAP COUNTDOWN */}
      {birthdayCountdown && (
        <div className="rounded-2xl p-4 mb-4 flex items-center gap-3" style={{
          background: 'linear-gradient(135deg, #FEF3C7, #FED7AA)'
        }}>
          <div className="text-5xl">🎂</div>
          <div>
            <div className="text-sm font-bold" style={{ color: '#92400E' }}>Szülinapomig...</div>
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

      {/* 11. CSAPATTÁRSAK CÍMKE-FELHŐ */}
      {teammates.length > 0 && (
        <div className="rounded-2xl p-4 mb-4 bg-white">
          <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
            CSAPATTÁRSAIM 👯
          </div>
          <div className="flex gap-2 flex-wrap">
            {teammates.slice(0, 6).map(t => (
              <div key={t.id} className="px-3 py-1 rounded-full text-xs" style={{
                background: '#FDF2F8',
                color: '#BE185D'
              }}>
                <span className="mr-1">{t.avatar_emoji || '🎀'}</span>
                {t.nickname || t.full_name.split(' ')[1] || t.full_name}
              </div>
            ))}
            {teammates.length > 6 && (
              <div className="px-3 py-1 rounded-full text-xs" style={{
                background: '#FDF2F8',
                color: '#BE185D'
              }}>
                + {teammates.length - 6} másik
              </div>
            )}
          </div>
        </div>
      )}

      {/* 13. KLUB ÜZENŐFAL HÍREK */}
      {recentEvents.length > 0 && (
        <div className="rounded-2xl p-4 mb-4 bg-white border-2" style={{ borderColor: '#BFDBFE' }}>
          <div className="text-sm font-bold mb-2 flex items-center gap-1" style={{ color: '#1E40AF' }}>
            <MessageCircle className="w-4 h-4" />
            Klub hírek
          </div>
          <div className="space-y-2">
            {recentEvents.map(e => (
              <div key={e.id} className="text-xs">
                <span className="font-bold text-gray-700">
                  {new Date(e.event_date).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })}:
                </span>
                <span className="ml-1 text-gray-600">{e.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 12. MOTIVÁLÓ IDÉZET (RG-S, NEM TÁNCOS!) */}
      <div className="rounded-2xl p-4 mb-4 text-center" style={{
        background: 'linear-gradient(135deg, #FCE7F3, #FBCFE8)'
      }}>
        <div className="text-3xl mb-2">💭</div>
        <div className="text-sm italic" style={{ color: '#831843' }}>
          "{quote.text}"
        </div>
        {quote.author && (
          <div className="text-xs text-gray-500 mt-1">— {quote.author}</div>
        )}
      </div>

      {/* 8. MAGAMRÓL KÁRTYA + AVATAR */}
      {competitor && (
        <div className="rounded-2xl p-4 mb-4 text-center" style={{
          background: 'linear-gradient(135deg, #DDD6FE 0%, #C7D2FE 100%)'
        }}>
          <div className="text-6xl mb-2">{selectedAvatar}</div>
          <div className="text-sm font-bold mb-1" style={{ color: '#5B21B6' }}>
            {competitor.nickname ? `"${competitor.nickname}"` : ''} {competitor.full_name}
          </div>
          <div className="text-xs" style={{ color: '#5B21B6' }}>
            {competitor.kategoria} · {competitor.korosztaly || 'Versenyző'} · {
              competitor.birth_year ? `${new Date().getFullYear() - competitor.birth_year} éves` : ''
            }
          </div>
          <div className="text-xs text-gray-500 mt-1">Csepel SC RG ★ csapata</div>
          
          {/* Avatar választó */}
          <div className="mt-3 p-3 bg-white bg-opacity-50 rounded-xl">
            <div className="text-xs text-gray-600 mb-2">VÁLASZD A KEDVENC AVATAROD!</div>
            <div className="flex gap-1 flex-wrap justify-center">
              {RG_AVATARS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => saveAvatar(emoji)}
                  className={`text-2xl p-1 rounded-lg transition ${
                    selectedAvatar === emoji 
                      ? 'bg-pink-200 ring-2 ring-pink-500' 
                      : 'hover:bg-pink-50'
                  }`}
                  style={{ minWidth: '36px' }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 23. EDZÉS RÖGZÍTÉS GOMB — KÉSŐBB JÖN JELZÉS */}
      <div className="rounded-2xl p-3 mb-4 bg-gray-50 border border-gray-200 text-center">
        <div className="text-xs text-gray-500">
          ⏳ Hamarosan: <strong>Edzés rögzítés gomb</strong> — ha az edző jóváhagyja!
        </div>
      </div>

    </div>
  );
}
