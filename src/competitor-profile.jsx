// ═══════════════════════════════════════════════════════════════════
// COMPETITOR PROFILE — "Én vagyok!" oldal v0.9.40
// ═══════════════════════════════════════════════════════════════════
// Sándor döntései (2026.05.18):
// 1. Nagy avatar + név + avatar-választó (megmarad)
// 2. Szülinap-countdown (megmarad)
// 3. Legjobb barátnő — EGYIRÁNYÚ, 1 választás (új DB mező: best_friend_competitor_id)
// 4. Fejlődési grafikon (importálva)
// 5. Versenyek idén + Edzéseim idén számláló (csak éven belüli versenyek)
// 6. Edzés-csillagok (1 edzésnap = 1 sárga csillag, 10/sor)
// 7. Heti streak motiváló doboz külön (🔥)
// 8. Érmes (1-3.) eredmények idén
// 9. Klub identitás kártya (Csepel RG Klub)
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState, useMemo } from 'react';
import { Loader, AlertCircle, X, Search } from 'lucide-react';
import { safeQuery } from './competitor-dashboard';
import { CompetitorProgressChart } from './progress-chart';

const RG_AVATARS = [
  '🤸‍♀️', '🩰', '🎯', '🏆', '🏅', '🎖️', '🥇', '🥈', '🥉',
  '🌸', '🌺', '🌷', '🌻', '🌹', '🪷', '🌼',
  '🦄', '🐱', '🐰', '🦋', '🐝', '🐧',
  '⭐', '🌟', '✨', '💫', '💎', '👑', '🎀', '💖',
  '🌈', '☀️', '🌙', '🔥', '🍓', '💪'
];

const COLORS = {
  pink: '#EC4899', pinkDark: '#BE185D', pinkBg: '#FDF2F8',
  purpleDeep: '#831843', redCsepel: '#BE123C',
  amber: '#F59E0B', amberDark: '#92400E', amberBg: '#FEF3C7',
  greenStreak: '#10B981', greenStreakBg: '#D1FAE5',
  goldMedal: '#FCD34D'
};

// Heti streak = utolsó folytonos hetek (hétfő-vasárnap), amikor volt edzés
function calculateWeeklyStreak(trainingDates) {
  if (!trainingDates || trainingDates.length === 0) return 0;
  const dates = Array.from(new Set(trainingDates.map(d => d.split('T')[0])))
    .map(d => new Date(d)).sort((a, b) => b - a);
  if (dates.length === 0) return 0;

  const getMonday = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  };

  const weeksWithTraining = new Set(dates.map(d => getMonday(d)));
  let streak = 0;
  const today = new Date();
  let currentMonday = new Date(getMonday(today));

  while (weeksWithTraining.has(currentMonday.toISOString().split('T')[0])) {
    streak++;
    currentMonday.setDate(currentMonday.getDate() - 7);
  }

  if (streak === 0) {
    currentMonday = new Date(getMonday(today));
    currentMonday.setDate(currentMonday.getDate() - 7);
    while (weeksWithTraining.has(currentMonday.toISOString().split('T')[0])) {
      streak++;
      currentMonday.setDate(currentMonday.getDate() - 7);
    }
  }
  return streak;
}

export default function CompetitorProfileView({ supabase, profile }) {
  const [competitor, setCompetitor] = useState(null);
  const [allCompetitors, setAllCompetitors] = useState([]);
  const [bestFriend, setBestFriend] = useState(null);
  const [selectedAvatar, setSelectedAvatar] = useState('🦄');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const [trainingDates, setTrainingDates] = useState([]);
  const [competitionsThisYear, setCompetitionsThisYear] = useState(0);
  const [medalsThisYear, setMedalsThisYear] = useState([]);
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
            .select('id, full_name, nickname, kategoria, korosztaly, birth_year, birth_date, avatar_emoji, best_friend_competitor_id')
            .eq('id', competitorId).maybeSingle()
        );
        if (!compRes.data || !mounted) { setLoading(false); return; }
        setCompetitor(compRes.data);
        if (compRes.data.avatar_emoji) setSelectedAvatar(compRes.data.avatar_emoji);

        if (compRes.data.best_friend_competitor_id) {
          const friendRes = await safeQuery(() =>
            supabase.from('competitors')
              .select('id, full_name, nickname, avatar_emoji, kategoria')
              .eq('id', compRes.data.best_friend_competitor_id).maybeSingle()
          );
          if (friendRes.data && mounted) setBestFriend(friendRes.data);
        }

        const allRes = await safeQuery(() =>
          supabase.from('competitors')
            .select('id, full_name, nickname, avatar_emoji, kategoria')
            .eq('is_active', true).neq('id', competitorId)
        );
        if (allRes.data && mounted) {
          const sorted = allRes.data.sort((a, b) => {
            const aKey = (a.nickname || a.full_name || '').trim();
            const bKey = (b.nickname || b.full_name || '').trim();
            return aKey.localeCompare(bKey, 'hu', { sensitivity: 'base' });
          });
          setAllCompetitors(sorted);
        }

        const currentYear = new Date().getFullYear();
        const yearStart = `${currentYear}-01-01`;
        const yearEnd = `${currentYear}-12-31`;

        const attRes = await safeQuery(() =>
          supabase.from('training_attendance')
            .select('session_date')
            .eq('competitor_id', competitorId)
            .gte('session_date', yearStart).lte('session_date', yearEnd)
            .eq('present', true)
        );
        if (attRes.data && mounted) {
          setTrainingDates(attRes.data.map(r => r.session_date));
        }

        // Versenyek idén — startlist_entries → comp.start_date check
        const compsRes = await safeQuery(() =>
          supabase.from('startlist_entries')
            .select(`
              competition_category:competition_categories!inner(
                competition_day:competition_days!inner(
                  competition:competitions!inner(id, start_date)
                )
              )
            `)
            .eq('competitor_id', competitorId)
        );
        if (compsRes.data && mounted) {
          const uniqueIds = new Set();
          compsRes.data.forEach(e => {
            const c = e.competition_category?.competition_day?.competition;
            if (c && c.start_date >= yearStart && c.start_date <= yearEnd) uniqueIds.add(c.id);
          });
          setCompetitionsThisYear(uniqueIds.size);
        }

        // Egyéni érmek
        const indivMedalsRes = await safeQuery(() =>
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
        const medalsList = [];
        if (indivMedalsRes.data) {
          indivMedalsRes.data.forEach(r => {
            const comp = r.startlist_entry?.competition_category?.competition_day?.competition;
            if (comp && comp.start_date >= yearStart && comp.start_date <= yearEnd) {
              medalsList.push({
                type: 'individual',
                placement: r.placement,
                apparatus: r.apparatus,
                competitionName: comp.name,
                competitionDate: comp.start_date,
                key: `i-${comp.id}-${r.apparatus}`
              });
            }
          });
        }
        // Összetett érmek
        const aaMedalsRes = await safeQuery(() =>
          supabase.from('all_around_results')
            .select(`
              placement, competitor_id,
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
        if (aaMedalsRes.data) {
          aaMedalsRes.data.forEach(r => {
            const comp = r.competition_category?.competition_day?.competition;
            if (comp && comp.start_date >= yearStart && comp.start_date <= yearEnd) {
              medalsList.push({
                type: 'all_around',
                placement: r.placement,
                apparatus: 'Összetett',
                competitionName: comp.name,
                competitionDate: comp.start_date,
                key: `a-${comp.id}`
              });
            }
          });
        }
        medalsList.sort((a, b) => (b.competitionDate || '').localeCompare(a.competitionDate || ''));
        if (mounted) setMedalsThisYear(medalsList);

      } catch (err) {
        console.error('CompetitorProfile load:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [supabase, profile?.competitor_id, profile?.id, profile?.full_name]);

  const saveAvatar = async (emoji) => {
    setSelectedAvatar(emoji);
    setShowAvatarPicker(false);
    if (competitor?.id) {
      await supabase.from('competitors').update({ avatar_emoji: emoji }).eq('id', competitor.id);
    }
  };

  const saveBestFriend = async (friend) => {
    if (!competitor?.id) return;
    const friendId = friend?.id || null;
    await supabase.from('competitors').update({ best_friend_competitor_id: friendId }).eq('id', competitor.id);
    setBestFriend(friend);
    setShowFriendPicker(false);
    setFriendSearch('');
  };

  const birthdayCountdown = useMemo(() => {
    if (!competitor?.birth_date) return null;
    const today = new Date();
    const birth = new Date(competitor.birth_date);
    const thisYearBirth = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
    if (thisYearBirth < today) thisYearBirth.setFullYear(today.getFullYear() + 1);
    const days = Math.ceil((thisYearBirth - today) / (1000 * 60 * 60 * 24));
    return { days, date: thisYearBirth };
  }, [competitor?.birth_date]);

  const weeklyStreak = useMemo(() => calculateWeeklyStreak(trainingDates), [trainingDates]);

  const trainingDaysCount = useMemo(() => {
    return new Set(trainingDates.map(d => d.split('T')[0])).size;
  }, [trainingDates]);

  const filteredFriends = useMemo(() => {
    if (!friendSearch) return allCompetitors;
    const q = friendSearch.toLowerCase().trim();
    return allCompetitors.filter(c =>
      (c.nickname || '').toLowerCase().includes(q) ||
      (c.full_name || '').toLowerCase().includes(q)
    );
  }, [friendSearch, allCompetitors]);

  if (loading) {
    return (
      <div className="max-w-md mx-auto py-8 text-center">
        <Loader className="w-8 h-8 animate-spin mx-auto text-pink-400" />
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
          <div className="text-xs text-amber-800 mt-1">Szólj az admin-nak.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 space-y-3" style={{
      background: 'linear-gradient(135deg, #FDF2F8 0%, #EDE9FE 100%)',
      borderRadius: '24px', minHeight: '500px'
    }}>
      <div className="text-center mb-2 pt-3">
        <div className="text-xl font-bold" style={{ color: COLORS.redCsepel }}>★ Csepel RG Klub ★</div>
        <div className="text-sm italic" style={{ color: COLORS.pink, fontFamily: 'Caveat, cursive' }}>
          "Ügyesen, Okosan, Mosoly"
        </div>
      </div>

      <div className="text-center mb-3">
        <div className="text-2xl font-bold" style={{ color: COLORS.purpleDeep }}>⭐ Én vagyok!</div>
      </div>

      {/* 1. NAGY AVATAR + NÉV */}
      <div className="rounded-2xl p-5 bg-white text-center border-2" style={{ borderColor: '#FBCFE8' }}>
        <div className="text-7xl mb-2">{selectedAvatar}</div>
        <div className="text-xl font-bold" style={{ color: COLORS.purpleDeep }}>
          {competitor.nickname ? `"${competitor.nickname}"` : competitor.full_name}
        </div>
        {competitor.nickname && (
          <div className="text-sm" style={{ color: COLORS.pinkDark }}>{competitor.full_name}</div>
        )}
        <div className="text-xs text-gray-500 mt-1">
          {competitor.kategoria} · {competitor.korosztaly || 'Versenyző'}
          {competitor.birth_year ? ` · ${new Date().getFullYear() - competitor.birth_year} éves` : ''}
        </div>

        <button
          onClick={() => setShowAvatarPicker(!showAvatarPicker)}
          className="mt-3 px-4 py-2 rounded-full text-xs font-bold transition"
          style={{
            background: showAvatarPicker ? '#FCE4EC' : 'linear-gradient(135deg, #EC4899, #BE185D)',
            color: showAvatarPicker ? COLORS.pinkDark : 'white',
            border: showAvatarPicker ? '2px solid #EC4899' : 'none'
          }}
        >
          {showAvatarPicker ? '✕ Bezár' : '🎨 Avatar változtatása'}
        </button>
      </div>

      {showAvatarPicker && (
        <div className="rounded-2xl p-4 bg-white border-2" style={{ borderColor: '#FBCFE8' }}>
          <div className="text-xs text-gray-500 mb-3 text-center font-bold">
            VÁLASZD KI A KEDVENC AVATARODAT!
          </div>
          <div className="grid grid-cols-6 gap-1">
            {RG_AVATARS.map(emoji => (
              <button
                key={emoji}
                onClick={() => saveAvatar(emoji)}
                className={`text-2xl p-2 rounded-lg transition ${
                  selectedAvatar === emoji ? 'bg-pink-100 ring-2 ring-pink-500' : 'hover:bg-pink-50'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. SZÜLINAP COUNTDOWN */}
      {birthdayCountdown && (
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{
          background: 'linear-gradient(135deg, #FEF3C7, #FED7AA)'
        }}>
          <div className="text-5xl">🎂</div>
          <div>
            <div className="text-sm font-bold" style={{ color: COLORS.amberDark }}>Szülinapomig...</div>
            <div className="text-3xl font-bold leading-none" style={{ color: COLORS.amberDark }}>
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

      {/* 3. LEGJOBB BARÁTNŐ */}
      <div className="rounded-2xl p-4 bg-white border-2" style={{ borderColor: '#FBCFE8' }}>
        <div className="text-xs font-bold mb-2" style={{ color: COLORS.pinkDark }}>
          💖 LEGJOBB BARÁTNŐM
        </div>

        {bestFriend ? (
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: COLORS.pinkBg }}>
            <div className="text-4xl">{bestFriend.avatar_emoji || '🎀'}</div>
            <div className="flex-1">
              <div className="font-bold" style={{ color: COLORS.purpleDeep }}>
                {bestFriend.nickname || bestFriend.full_name?.split(' ').slice(-1)[0]}
              </div>
              {bestFriend.nickname && (
                <div className="text-xs text-gray-500">{bestFriend.full_name}</div>
              )}
              <div className="text-xs" style={{ color: COLORS.pinkDark }}>{bestFriend.kategoria}</div>
            </div>
            <button
              onClick={() => setShowFriendPicker(true)}
              className="px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: '#FCE4EC', color: COLORS.pinkDark }}
            >
              Csere
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowFriendPicker(true)}
            className="w-full p-3 rounded-xl border-2 border-dashed text-sm font-medium transition"
            style={{ borderColor: '#F9A8D4', color: COLORS.pinkDark }}
          >
            💕 Válassz egy legjobb barátnőt!
          </button>
        )}
      </div>

      {showFriendPicker && (
        <div className="rounded-2xl p-4 bg-white border-2" style={{ borderColor: COLORS.pink }}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold" style={{ color: COLORS.pinkDark }}>
              Ki a legjobb barátnőd?
            </div>
            <button onClick={() => { setShowFriendPicker(false); setFriendSearch(''); }}>
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="relative mb-3">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              value={friendSearch}
              onChange={(e) => setFriendSearch(e.target.value)}
              placeholder="Keresés név vagy becenév szerint..."
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg"
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1">
            {bestFriend && (
              <button
                onClick={() => saveBestFriend(null)}
                className="w-full text-left px-3 py-2 rounded-lg text-xs italic text-gray-500 hover:bg-gray-50"
              >
                ✕ Eltávolítom a választást
              </button>
            )}
            {filteredFriends.length === 0 ? (
              <div className="text-center text-xs text-gray-500 py-4">Nincs találat.</div>
            ) : (
              filteredFriends.map(c => (
                <button
                  key={c.id}
                  onClick={() => saveBestFriend(c)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-pink-50 transition text-left"
                >
                  <div className="text-2xl">{c.avatar_emoji || '🎀'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate" style={{ color: COLORS.purpleDeep }}>
                      {c.nickname || c.full_name?.split(' ').slice(-1)[0]}
                    </div>
                    {c.nickname && (
                      <div className="text-xs text-gray-500 truncate">{c.full_name}</div>
                    )}
                  </div>
                  <div className="text-xs" style={{ color: COLORS.pinkDark }}>{c.kategoria}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* 4. FEJLŐDÉSI GRAFIKON */}
      <CompetitorProgressChart supabase={supabase} competitorId={competitor.id} />

      {/* 5. VERSENYEK + ÉRMEK IDÉN */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4 text-center" style={{
          background: 'linear-gradient(135deg, #DBEAFE, #BFDBFE)'
        }}>
          <div className="text-3xl mb-1">🏆</div>
          <div className="text-3xl font-bold leading-none" style={{ color: '#1E40AF' }}>
            {competitionsThisYear}
          </div>
          <div className="text-xs mt-1" style={{ color: '#1E40AF' }}>
            verseny idén
          </div>
        </div>
        <div className="rounded-2xl p-4 text-center" style={{
          background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)'
        }}>
          <div className="text-3xl mb-1">🏅</div>
          <div className="text-3xl font-bold leading-none" style={{ color: COLORS.amberDark }}>
            {medalsThisYear.length}
          </div>
          <div className="text-xs mt-1" style={{ color: COLORS.amberDark }}>
            érem idén
          </div>
        </div>
      </div>

      {/* 6. EDZÉSEIM IDÉN + CSILLAGOK */}
      <div className="rounded-2xl p-5 bg-white border-2" style={{ borderColor: '#FBCFE8' }}>
        <div className="text-sm font-bold mb-1" style={{ color: COLORS.amberDark }}>
          💪 Edzéseim idén
        </div>
        <div className="flex items-baseline gap-2 mb-3">
          <div className="text-4xl font-bold" style={{ color: '#1F2937' }}>
            {trainingDaysCount}
          </div>
          <div className="text-sm text-gray-600">edzésnap eddig 🎉</div>
        </div>

        {trainingDaysCount > 0 ? (
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: trainingDaysCount }).map((_, idx) => (
              <span key={idx} className="text-2xl" style={{ color: COLORS.goldMedal }}>★</span>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-500 italic">
            Az első csillag még előtted áll — gyere edzésre! ✨
          </div>
        )}
      </div>

      {/* 7. HETI STREAK */}
      {weeklyStreak > 0 && (
        <div className="rounded-2xl p-4 text-center border-2" style={{
          background: COLORS.greenStreakBg,
          borderColor: COLORS.greenStreak
        }}>
          <div className="text-2xl mb-1">🔥</div>
          <div className="text-sm font-bold" style={{ color: '#047857' }}>
            {weeklyStreak === 1
              ? 'Ezen a héten edzettél — gyönyörű!'
              : `Most ${weeklyStreak} hete sorban edzel — gyönyörű!`}
          </div>
        </div>
      )}

      {/* 8. ÉRMES EREDMÉNYEK IDÉN */}
      {medalsThisYear.length > 0 && (
        <div className="rounded-2xl p-4 bg-white border-2" style={{ borderColor: '#FBCFE8' }}>
          <div className="text-sm font-bold mb-3" style={{ color: COLORS.amberDark }}>
            🏅 Idei érmeim
          </div>
          <div className="space-y-2">
            {medalsThisYear.map(m => {
              const emoji = m.placement === 1 ? '🥇' : m.placement === 2 ? '🥈' : '🥉';
              return (
                <div key={m.key} className="flex items-center gap-3 p-2 rounded-lg" style={{
                  background: m.placement === 1 ? '#FEF3C7' : m.placement === 2 ? '#F3F4F6' : '#FFEDD5'
                }}>
                  <div className="text-3xl">{emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold" style={{ color: COLORS.purpleDeep }}>
                      {m.placement}. hely — {m.apparatus}
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      {m.competitionName} · {m.competitionDate}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 9. KLUB IDENTITÁS KÁRTYA */}
      <div className="rounded-2xl p-4 text-center" style={{
        background: 'linear-gradient(135deg, #DDD6FE, #C7D2FE)'
      }}>
        <div className="text-3xl mb-1">⭐</div>
        <div className="text-sm font-bold" style={{ color: '#5B21B6' }}>Csepel RG Klub ★ csapata</div>
        <div className="text-sm italic mt-1" style={{ color: COLORS.pinkDark, fontFamily: 'Caveat, cursive' }}>
          "Ügyesen, Okosan, Mosoly"
        </div>
      </div>

    </div>
  );
}
