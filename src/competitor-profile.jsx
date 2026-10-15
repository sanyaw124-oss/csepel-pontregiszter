// ═══════════════════════════════════════════════════════════════════
// COMPETITOR PROFILE — "Én vagyok!" oldal v0.9.41
// ═══════════════════════════════════════════════════════════════════
// JAVÍTÁSOK az SQL diagnosztika alapján (2026.05.18):
// - training_attendance: NINCS 'present' mező, NINCS 'session_date'
//   → training_sessions!inner(date) JOIN-nal (mint az admin.jsx 2320. sorban)
// - Csapat-érmek hozzáadva: competition_team_members → competition_teams
//   (mint a CompetitorYearlyStats admin.jsx 3497-3520. sor)
// - historical_results: VALÓS struktúra (year+JSONB)
// - Promise.all() párhuzamosan, gyors betöltés
// - Stabil safeQuery() minden lekérdezésen
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState, useMemo } from 'react';
import { Loader, AlertCircle } from 'lucide-react';
import { safeQuery } from './competitor-dashboard';
import { CompetitorProgressChart } from './progress-chart';
import { FriendsPanel } from './friends';
import { MusicPanel } from './music';
import { useAvatarUrl, uploadAvatar, AvatarImage, AVATAR_RULES_TEXT } from './avatar';
import { loadBadgeData } from './badges';

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
  amberDark: '#92400E', greenStreak: '#10B981', greenStreakBg: '#D1FAE5',
  goldMedal: '#FCD34D'
};

// Heti streak = utolsó folytonos hetek, amikor volt edzés
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
  const [selectedAvatar, setSelectedAvatar] = useState('🦄');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [trainingDates, setTrainingDates] = useState([]);
  const [competitionsThisYear, setCompetitionsThisYear] = useState(null);
  const [medalsThisYear, setMedalsThisYear] = useState(null);
  const [loading, setLoading] = useState(true);
  // v0.9.50: profilkép
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [photoRulesOk, setPhotoRulesOk] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState(null);
  const photo = useAvatarUrl(supabase, competitor, avatarVersion);

  // v0.9.66: „verseny idén” / „érem idén” ugyanabból a forrásból, mint a kitűzők és
  // az évösszefoglaló: lezárt versenyek (egyéni, összetett, csapat) + korábbi eredmények
  useEffect(() => {
    if (!competitor?.id) return undefined;
    let active = true;
    const y = String(new Date().getFullYear());
    loadBadgeData(supabase, competitor.id).then(d => {
      if (!active) return;
      const comps = d.comps.filter(c => c.date && c.date.startsWith(y));
      setCompetitionsThisYear(comps.length);
      setMedalsThisYear(comps.reduce((s, c) => s + (c.medals || []).length, 0));
    }).catch(() => {});
    return () => { active = false; };
  }, [supabase, competitor?.id]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        // 1) Competitor ID megkeresése
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

        // 2) Saját competitor
        const compRes = await safeQuery(() =>
          supabase.from('competitors')
            .select('id, full_name, nickname, kategoria, korosztaly, birth_year, birth_date, avatar_emoji, avatar_path')
            .eq('id', competitorId).maybeSingle()
        );
        if (!compRes.data || !mounted) { setLoading(false); return; }
        setCompetitor(compRes.data);
        if (compRes.data.avatar_emoji) setSelectedAvatar(compRes.data.avatar_emoji);

        const currentYear = new Date().getFullYear();
        const yearStart = `${currentYear}-01-01`;
        const yearEnd = `${currentYear}-12-31`;

        // ═══════ PÁRHUZAMOS LEKÉRDEZÉSEK ═══════
        // v0.9.77: a „verseny idén / érem idén” számot a loadBadgeData adja (lent, külön)
        const [trainingRes] = await Promise.all([
          // Edzések — JAVÍTVA: training_sessions!inner(date) JOIN
          safeQuery(() =>
            supabase.from('training_attendance')
              .select('id, training_sessions!inner(date)')
              .eq('competitor_id', competitorId)
              .gte('training_sessions.date', yearStart)
              .lte('training_sessions.date', yearEnd)
          )
        ]);

        if (!mounted) return;

        // Edzések (training_sessions.date a JOIN-ról)
        if (trainingRes?.data) {
          const dates = trainingRes.data
            .map(r => r.training_sessions?.date)
            .filter(Boolean);
          setTrainingDates(dates);
        }

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

  const onPhotoSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !competitor) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const path = await uploadAvatar(supabase, competitor, file);
      setCompetitor({ ...competitor, avatar_path: path });
      setAvatarVersion(v => v + 1);
      setShowPhotoUpload(false);
      setPhotoRulesOk(false);
    } catch (err) {
      console.error('Profilkép feltöltés:', err);
      setPhotoError('A feltöltés nem sikerült: ' + (err.message || 'ismeretlen hiba'));
    } finally {
      setPhotoBusy(false);
    }
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

      {/* 1. AVATAR + NÉV */}
      <div className="rounded-2xl p-5 bg-white text-center border-2" style={{ borderColor: '#FBCFE8' }}>
        <div className="mb-2 flex justify-center">
          <AvatarImage url={photo.url} emoji={selectedAvatar} size={112} />
        </div>
        {photo.rejected && (
          <div className="mb-3 rounded-xl p-3 text-sm text-left border-2" style={{ backgroundColor: '#FEF3C7', borderColor: '#F59E0B', color: '#92400E' }}>
            <div className="font-bold">A képed nem megfelelő, ezért az edző elrejtette.</div>
            <div className="text-xs mt-1">Tölts fel egy új, RG témájú képet — addig az avatarod látszik.</div>
          </div>
        )}
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
        <button
          onClick={() => { setShowPhotoUpload(!showPhotoUpload); setPhotoError(null); }}
          className="mt-3 ml-2 px-4 py-2 rounded-full text-xs font-bold transition"
          style={{
            background: showPhotoUpload ? '#EDE9FE' : 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
            color: showPhotoUpload ? '#5B21B6' : 'white',
            border: showPhotoUpload ? '2px solid #8B5CF6' : 'none'
          }}
        >
          {showPhotoUpload ? '✕ Bezár' : (photo.url ? '📷 Kép cseréje' : '📷 Profilkép feltöltése')}
        </button>

        {showPhotoUpload && (
          <div className="mt-3 rounded-xl p-3 text-left border-2" style={{ borderColor: '#C4B5FD', backgroundColor: '#F5F3FF' }}>
            <div className="text-sm font-bold" style={{ color: '#5B21B6' }}>Fontos!</div>
            <div className="text-xs mt-1 text-gray-700">{AVATAR_RULES_TEXT}</div>
            <div className="text-xs mt-1 text-gray-500">A képedet a klub minden bejelentkezett tagja látja.</div>
            <label className="flex items-start gap-2 mt-3 text-xs font-medium text-gray-800 cursor-pointer">
              <input type="checkbox" checked={photoRulesOk} onChange={e => setPhotoRulesOk(e.target.checked)} className="mt-0.5" />
              Elolvastam: RG témájú képet töltök fel magamról.
            </label>
            <label
              className={`mt-3 inline-block px-4 py-2 rounded-full text-xs font-bold text-white ${photoRulesOk && !photoBusy ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)' }}
            >
              {photoBusy ? 'Feltöltés…' : 'Kép kiválasztása'}
              <input type="file" accept="image/*" className="hidden" disabled={!photoRulesOk || photoBusy} onChange={onPhotoSelected} />
            </label>
            {photoError && <div className="text-xs text-red-600 mt-2">{photoError}</div>}
          </div>
        )}
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

      {/* 2. SZÜLINAP */}
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

      {/* 3. LEGJOBB BARÁTNŐK — v0.9.82: legfeljebb 3, csak ti ketten + a szülők látjátok */}
      <FriendsPanel supabase={supabase} competitorId={competitor.id} canWrite />

      {/* v0.9.83: gyakorlatzenék (az edző tölti fel) */}
      <MusicPanel supabase={supabase} competitorId={competitor.id} competitorName={competitor.full_name} userRole="versenyzo" />

      {/* 4. FEJLŐDÉSI GRAFIKON */}
      <CompetitorProgressChart supabase={supabase} competitorId={competitor.id} />

      {/* 5. VERSENYEK + ÉRMEK IDÉN */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4 text-center" style={{
          background: 'linear-gradient(135deg, #DBEAFE, #BFDBFE)'
        }}>
          <div className="text-3xl mb-1">🏆</div>
          <div className="text-3xl font-bold leading-none" style={{ color: '#1E40AF' }}>{competitionsThisYear ?? '…'}</div>
          <div className="text-xs mt-1" style={{ color: '#1E40AF' }}>verseny idén</div>
        </div>
        <div className="rounded-2xl p-4 text-center" style={{
          background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)'
        }}>
          <div className="text-3xl mb-1">🏅</div>
          <div className="text-3xl font-bold leading-none" style={{ color: COLORS.amberDark }}>{medalsThisYear ?? '…'}</div>
          <div className="text-xs mt-1" style={{ color: COLORS.amberDark }}>érem idén</div>
        </div>
      </div>
      <div className="text-[11px] text-gray-500 text-center -mt-2">Érem = minden 1–3. hely (egyéni szer, összetett, csapat); lezárt versenyekből és a korábbi eredményekből.</div>

      {/* 6. EDZÉSEIM IDÉN + CSILLAGOK */}
      <div className="rounded-2xl p-5 bg-white border-2" style={{ borderColor: '#FBCFE8' }}>
        <div className="text-sm font-bold mb-1" style={{ color: COLORS.amberDark }}>💪 Edzéseim idén</div>
        <div className="flex items-baseline gap-2 mb-3">
          <div className="text-4xl font-bold" style={{ color: '#1F2937' }}>{trainingDaysCount}</div>
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

      {/* 8. KLUB IDENTITÁS */}
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
