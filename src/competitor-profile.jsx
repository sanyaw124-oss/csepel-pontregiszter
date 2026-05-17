// ═══════════════════════════════════════════════════════════════════
// COMPETITOR PROFILE — "Én vagyok!" oldal
// Modulok: 13 Avatar+név · 14 Hangulat-választó · 15 Szülinap · 
//          16 Csapattársak · 17 Klub identitás kártya
// 30+ RG-témájú avatar (Petra+Ori kérése!)
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { Loader, AlertCircle, Star } from 'lucide-react';
import { safeQuery } from './competitor-dashboard';

// 36 RG-TÉMÁJÚ AVATAR (Petra+Ori: "több emoji-avatar legyen választható" + "RG témájú")
const RG_AVATARS = [
  // RG-eszközök és sport (a klub szíve!)
  '🤸‍♀️', '🩰', '🎯', '🏆', '🏅', '🎖️', '🥇', '🥈', '🥉',
  // Virágok (RG ritmika hangulat)
  '🌸', '🌺', '🌷', '🌻', '🌹', '🪷', '🌼',
  // Cuki állatok
  '🦄', '🐱', '🐰', '🦋', '🐝', '🐧',
  // Csillogás és varázs
  '⭐', '🌟', '✨', '💫', '💎', '👑', '🎀', '💖',
  // Hangulat
  '🌈', '☀️', '🌙', '🔥', '🍓', '💪'
];

export default function CompetitorProfileView({ supabase, profile }) {
  const [competitor, setCompetitor] = useState(null);
  const [teammates, setTeammates] = useState([]);
  const [selectedAvatar, setSelectedAvatar] = useState('🦄');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
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
        if (compRes.data && mounted) {
          setCompetitor(compRes.data);
          if (compRes.data.avatar_emoji) setSelectedAvatar(compRes.data.avatar_emoji);

          // Csapattársak (ugyanaz a kategória)
          if (compRes.data.kategoria) {
            const teamRes = await safeQuery(() =>
              supabase.from('competitors')
                .select('id, full_name, nickname, avatar_emoji')
                .eq('kategoria', compRes.data.kategoria)
                .eq('is_active', true)
                .neq('id', competitorId)
                .limit(10)
            );
            if (teamRes.data && mounted) setTeammates(teamRes.data);
          }
        }
      } catch (err) {
        console.error('Profile load:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [supabase, profile?.competitor_id, profile?.id, profile?.full_name]);

  const saveAvatar = async (emoji) => {
    setSelectedAvatar(emoji);
    setShowAvatarPicker(false);  // bezárjuk a választót
    if (competitor?.id) {
      await supabase.from('competitors').update({ avatar_emoji: emoji }).eq('id', competitor.id);
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

  if (loading) {
    return <div className="max-w-md mx-auto py-8 text-center"><Loader className="w-8 h-8 animate-spin mx-auto text-pink-400" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-4" style={{
      background: 'linear-gradient(135deg, #FDF2F8 0%, #EDE9FE 100%)',
      borderRadius: '24px', minHeight: '500px'
    }}>
      <div className="text-center mb-4 pt-3">
        <div className="text-xl font-bold" style={{ color: '#BE123C' }}>★ Csepel SC RG ★</div>
        <div className="text-sm italic" style={{ color: '#EC4899', fontFamily: 'Caveat, cursive' }}>
          "Ügyesen, Okosan, Mosoly"
        </div>
      </div>

      <div className="text-center mb-5">
        <div className="text-2xl font-bold" style={{ color: '#831843' }}>⭐ Én vagyok!</div>
      </div>

      {!competitor && (
        <div className="rounded-2xl p-4 mb-4 bg-amber-50 border-2 border-amber-300 text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-amber-600 mb-2" />
          <div className="text-sm font-bold text-amber-900">Még nem találtunk hozzád versenyző profilt!</div>
          <div className="text-xs text-amber-800 mt-1">Szólj az admin-nak.</div>
        </div>
      )}

      {/* 13. NAGY AVATAR + NÉV + VÁLTÁS GOMB */}
      {competitor && (
        <div className="rounded-2xl p-5 mb-4 bg-white text-center border-2" style={{ borderColor: '#FBCFE8' }}>
          <div className="text-7xl mb-2">{selectedAvatar}</div>
          <div className="text-xl font-bold" style={{ color: '#831843' }}>
            {competitor.nickname ? `"${competitor.nickname}"` : competitor.full_name}
          </div>
          {competitor.nickname && (
            <div className="text-sm" style={{ color: '#BE185D' }}>{competitor.full_name}</div>
          )}
          <div className="text-xs text-gray-500 mt-1">
            {competitor.kategoria} · {competitor.korosztaly || 'Versenyző'}
            {competitor.birth_year ? ` · ${new Date().getFullYear() - competitor.birth_year} éves` : ''}
          </div>
          
          {/* Avatar változtatás gomb */}
          <button
            onClick={() => setShowAvatarPicker(!showAvatarPicker)}
            className="mt-3 px-4 py-2 rounded-full text-xs font-bold transition"
            style={{
              background: showAvatarPicker ? '#FCE4EC' : 'linear-gradient(135deg, #EC4899, #BE185D)',
              color: showAvatarPicker ? '#BE185D' : 'white',
              border: showAvatarPicker ? '2px solid #EC4899' : 'none'
            }}
          >
            {showAvatarPicker ? '✕ Bezár' : '🎨 Avatar változtatása'}
          </button>
        </div>
      )}

      {/* 14. HANGULAT-VÁLASZTÓ (36 avatar) — CSAK akkor ha showAvatarPicker */}
      {competitor && showAvatarPicker && (
        <div className="rounded-2xl p-4 mb-3 bg-white border-2" style={{ borderColor: '#FBCFE8' }}>
          <div className="text-xs text-gray-500 mb-3 text-center font-bold">
            VÁLASZD KI A KEDVENC AVATARODAT!
          </div>
          <div className="grid grid-cols-6 gap-1">
            {RG_AVATARS.map(emoji => (
              <button
                key={emoji}
                onClick={() => saveAvatar(emoji)}
                className={`text-2xl p-2 rounded-lg transition ${
                  selectedAvatar === emoji 
                    ? 'bg-pink-100 ring-2 ring-pink-500' 
                    : 'hover:bg-pink-50'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 15. SZÜLINAP COUNTDOWN */}
      {birthdayCountdown && (
        <div className="rounded-2xl p-4 mb-3 flex items-center gap-3" style={{
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

      {/* 16. CSAPATTÁRSAK CÍMKE-FELHŐ */}
      {teammates.length > 0 && (
        <div className="rounded-2xl p-4 mb-3 bg-white">
          <div className="text-xs text-gray-500 mb-2 font-bold">CSAPATTÁRSAIM 👯</div>
          <div className="flex gap-2 flex-wrap">
            {teammates.map(t => (
              <div key={t.id} className="px-3 py-1 rounded-full text-xs flex items-center gap-1" style={{
                background: '#FDF2F8', color: '#BE185D'
              }}>
                <span>{t.avatar_emoji || '🎀'}</span>
                <span>{t.nickname || t.full_name.split(' ').slice(-1)[0]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 17. KLUB IDENTITÁS KÁRTYA */}
      <div className="rounded-2xl p-4 text-center" style={{
        background: 'linear-gradient(135deg, #DDD6FE, #C7D2FE)'
      }}>
        <div className="text-3xl mb-1">⭐</div>
        <div className="text-sm font-bold" style={{ color: '#5B21B6' }}>Csepel SC RG ★ csapata</div>
        <div className="text-sm italic mt-1" style={{ color: '#BE185D', fontFamily: 'Caveat, cursive' }}>
          "Ügyesen, Okosan, Mosoly"
        </div>
      </div>

    </div>
  );
}
