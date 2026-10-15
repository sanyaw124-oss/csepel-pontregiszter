// ═══════════════════════════════════════════════════════════════════
// Legjobb barátnők + szülinapi köszöntés (v0.9.82) — Kata + Sándor 2026.10.15
//   - Barátnő: a gyerek legfeljebb 3 klubtársat jelöl. Csak a két gyerek és a
//     szüleik látják (más gyerek és az edző sem) — az adatbázis zárja el.
//   - Köszöntés: a szülinapos napján és utána 7 napig matrica + előre megírt
//     jókívánság; csak a két gyerek és a szüleik látják.
// Adatbázis: docs/sql/2026-10-15_v0.9.82_baratnok-szulinap.sql
// ═══════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from 'react';
import { Heart, X, Loader, Gift, Plus } from 'lucide-react';
import { formatCompetitorName, huSortByNickname } from './names';

const PINK = '#BE185D';

export const STICKERS = [
  { key: 'torta', emoji: '🎂', label: 'Torta' }, { key: 'lufi', emoji: '🎈', label: 'Lufi' },
  { key: 'ajandek', emoji: '🎁', label: 'Ajándék' }, { key: 'virag', emoji: '🌸', label: 'Virág' },
  { key: 'unikornis', emoji: '🦄', label: 'Unikornis' }, { key: 'csillag', emoji: '⭐', label: 'Csillag' },
  { key: 'masni', emoji: '🎀', label: 'Masni' }, { key: 'erem', emoji: '🏅', label: 'Érem' }
];
export const MESSAGES = [
  { key: 'm1', text: 'Boldog szülinapot! 🎉' },
  { key: 'm2', text: 'Sok-sok boldogságot kívánok!' },
  { key: 'm3', text: 'Isten éltessen sokáig!' },
  { key: 'm4', text: 'Legyen csodás napod!' },
  { key: 'm5', text: 'Sok sikert a versenyeken!' },
  { key: 'm6', text: 'Te vagy a legjobb csapattárs! 💖' },
  { key: 'm7', text: 'Szuper ügyes vagy, büszke vagyok rád!' },
  { key: 'm8', text: 'Boldog szülinapot, barátnőm! 🎂' }
];
const stickerOf = (k) => STICKERS.find(s => s.key === k) || STICKERS[0];
// v0.9.82: RG-s matricák (ChatGPT-vel rajzolva, public/stickers/<kulcs>.webp)
export function Sticker({ k, size = 56 }) {
  const st = stickerOf(k);
  return <img src={`/stickers/${st.key}.webp`} alt={st.label} width={size} height={size}
              className="select-none" draggable={false} style={{ width: size, height: size, objectFit: 'contain' }} />;
}
const messageOf = (k) => (MESSAGES.find(m => m.key === k) || MESSAGES[0]).text;

// ─── Legjobb barátnők ───────────────────────────────────────────────
export function FriendsPanel({ supabase, competitorId, canWrite = false }) {
  const [data, setData] = useState(null);
  const [all, setAll] = useState([]);
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState('');
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const [mine, me] = await Promise.all([
      supabase.from('best_friends').select('to_competitor').eq('from_competitor', competitorId),
      supabase.from('best_friends').select('from_competitor').eq('to_competitor', competitorId)
    ]);
    if (mine.error || me.error) { setError((mine.error || me.error).message); setData({ mine: [], me: [] }); return; }
    setData({ mine: (mine.data || []).map(r => r.to_competitor), me: (me.data || []).map(r => r.from_competitor) });
  }, [supabase, competitorId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    supabase.from('competitors').select('id, full_name, nickname, avatar_emoji').eq('is_active', true).eq('is_club_member', true)
      .then(({ data: d }) => setAll([...(d || [])].sort(huSortByNickname)));
  }, [supabase]);

  const byId = Object.fromEntries(all.map(c => [c.id, c]));
  const name = (id) => (byId[id] ? formatCompetitorName(byId[id]) : '…');
  const add = async () => {
    if (!pick) return;
    setError(null);
    const { error: err } = await supabase.from('best_friends').insert({ from_competitor: competitorId, to_competitor: pick });
    if (err) setError(err.message.includes('Legfeljebb') ? 'Legfeljebb 3 legjobb barátnőt jelölhetsz.' : 'Nem sikerült: ' + err.message);
    setPick(''); setAdding(false); load();
  };
  const remove = async (id) => {
    if (!window.confirm(`Leveszed ${name(id)} jelölését?`)) return;
    await supabase.from('best_friends').delete().eq('from_competitor', competitorId).eq('to_competitor', id);
    load();
  };

  if (!data) return null;
  const candidates = all.filter(c => c.id !== competitorId && !data.mine.includes(c.id));
  const mutual = (id) => data.me.includes(id);

  return (
    <div className="rounded-xl border-2 p-4" style={{ borderColor: '#FBCFE8', backgroundColor: '#FFF7FB' }}>
      <div className="font-semibold flex items-center gap-2 mb-1" style={{ color: PINK }}><Heart className="w-5 h-5" /> Legjobb barátnők</div>
      <div className="text-xs text-gray-500 mb-3">Csak ti ketten és a szüleitek látjátok — más nem.</div>

      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{canWrite ? 'Akiket én jelöltem' : 'Akiket jelölt'} ({data.mine.length}/3)</div>
      {data.mine.length === 0 && <div className="text-sm text-gray-400 italic mb-2">Még senki.</div>}
      <div className="flex flex-wrap gap-2 mb-2">
        {data.mine.map(id => (
          <span key={id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold text-white shadow-sm" style={{ backgroundColor: PINK }}>
            💖 {name(id)}{mutual(id) && <span title="Ő is téged jelölt"> 🤝</span>}
            {canWrite && <button onClick={() => remove(id)} className="ml-1 rounded-full bg-white/30 hover:bg-white/50 p-0.5" title="Jelölés levétele"><X className="w-3.5 h-3.5" /></button>}
          </span>
        ))}
      </div>
      {canWrite && data.mine.length < 3 && (
        adding ? (
          <div className="flex gap-2 flex-wrap items-center mb-3">
            <select value={pick} onChange={e => setPick(e.target.value)} className="flex-1 min-w-[200px] text-sm px-2 py-2 border border-gray-300 rounded bg-white">
              <option value="">— válassz klubtársat —</option>
              {candidates.map(c => <option key={c.id} value={c.id}>{formatCompetitorName(c)}</option>)}
            </select>
            <button onClick={add} disabled={!pick} className="px-4 py-2 rounded-lg text-white text-sm font-semibold shadow-sm disabled:opacity-40" style={{ backgroundColor: PINK }}>Jelölöm</button>
            <button onClick={() => { setAdding(false); setPick(''); }} className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium">Mégse</button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="mb-3 px-4 py-2 rounded-lg text-white text-sm font-semibold flex items-center gap-1.5 shadow-sm" style={{ backgroundColor: PINK }}>
            <Plus className="w-4 h-4" /> Barátnő jelölése
          </button>
        )
      )}

      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 mt-1">{canWrite ? 'Akik engem jelöltek' : 'Akik őt jelölték'}</div>
      {data.me.length === 0 ? <div className="text-sm text-gray-400 italic">Még senki.</div> : (
        <div className="flex flex-wrap gap-2">
          {data.me.map(id => (
            <span key={id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border-2" style={{ borderColor: PINK, color: PINK, backgroundColor: 'white' }}>
              💗 {name(id)}
            </span>
          ))}
        </div>
      )}
      {error && <div className="text-xs text-red-600 mt-2">{error}</div>}
    </div>
  );
}

// ─── Köszöntő ablak (a szülinapos dobozból) ───────────────────────────
export function GreetDialog({ supabase, target, onClose, onSent }) {
  const [sticker, setSticker] = useState('torta');
  const [message, setMessage] = useState('m1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const send = async () => {
    setBusy(true); setError(null);
    const { error: err } = await supabase.rpc('send_birthday_greeting', { p_to: target.id, p_sticker: sticker, p_message: message });
    setBusy(false);
    if (err) setError(err.message); else { onSent(); onClose(); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <div className="text-lg font-bold" style={{ color: PINK }}>🎉 Köszöntöm: {target.name}</div>
          <button onClick={onClose} className="p-1 rounded border border-gray-300 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="text-sm font-semibold text-gray-700">Válassz matricát</div>
        <div className="grid grid-cols-4 gap-2">
          {STICKERS.map(s => (
            <button key={s.key} onClick={() => setSticker(s.key)} className="rounded-lg border-2 p-1 flex items-center justify-center"
                    style={{ borderColor: sticker === s.key ? PINK : '#E5E7EB', backgroundColor: sticker === s.key ? '#FDF2F8' : 'white' }}
                    title={s.label}><Sticker k={s.key} size={64} /></button>
          ))}
        </div>
        <div className="text-sm font-semibold text-gray-700">Válassz jókívánságot</div>
        <div className="space-y-1.5">
          {MESSAGES.map(m => (
            <button key={m.key} onClick={() => setMessage(m.key)} className="w-full text-left text-sm px-3 py-2 rounded-lg border-2"
                    style={{ borderColor: message === m.key ? PINK : '#E5E7EB', backgroundColor: message === m.key ? '#FDF2F8' : 'white', fontWeight: message === m.key ? 600 : 400 }}>
              {m.text}
            </button>
          ))}
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button onClick={send} disabled={busy} className="w-full py-3 rounded-lg text-white font-semibold flex items-center justify-center gap-2 shadow-md disabled:opacity-50" style={{ backgroundColor: PINK }}>
          {busy ? <Loader className="w-5 h-5 animate-spin" /> : <Gift className="w-5 h-5" />} Küldöm <Sticker k={sticker} size={28} />
        </button>
        <div className="text-xs text-gray-500 text-center">Csak ő és a szülei látják, és a te szüleid.</div>
      </div>
    </div>
  );
}

// ─── Kapott köszöntések ──────────────────────────────────────────────
// recentOnly: csak az elmúlt 30 nap (az Áttekintésen); különben minden év
export function GreetingsPanel({ supabase, competitorId, recentOnly = false, title }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    let active = true;
    (async () => {
      let q = supabase.from('birthday_greetings').select('id, from_competitor, bd_year, sticker, message, created_at')
        .eq('to_competitor', competitorId).order('created_at', { ascending: false });
      if (recentOnly) q = q.gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString());
      const { data } = await q;
      const ids = [...new Set((data || []).map(g => g.from_competitor))];
      let names = {};
      if (ids.length) {
        const { data: cs } = await supabase.from('competitors').select('id, full_name, nickname').in('id', ids);
        names = Object.fromEntries((cs || []).map(c => [c.id, formatCompetitorName(c)]));
      }
      if (active) setItems((data || []).map(g => ({ ...g, name: names[g.from_competitor] || 'Egy csapattárs' })));
    })();
    return () => { active = false; };
  }, [supabase, competitorId, recentOnly]);
  if (!items || items.length === 0) return null;
  const years = [...new Set(items.map(g => g.bd_year))];
  return (
    <div className="rounded-xl p-4 shadow-sm" style={{ background: 'linear-gradient(135deg, #FBCFE8 0%, #FEF3C7 60%, #BFDBFE 100%)', border: '2px solid #F472B6' }}>
      <div className="font-bold text-lg mb-2" style={{ color: '#831843' }}>{title || '🎂 Szülinapi köszöntések'}</div>
      {years.map(y => (
        <div key={y} className="mb-2">
          {years.length > 1 && <div className="text-xs font-semibold text-gray-600 mb-1">{y}</div>}
          <div className="grid sm:grid-cols-2 gap-2">
            {items.filter(g => g.bd_year === y).map(g => (
              <div key={g.id} className="bg-white/90 rounded-lg p-2.5 flex items-center gap-3 shadow-sm">
                <Sticker k={g.sticker} size={64} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{messageOf(g.message)}</div>
                  <div className="text-xs text-gray-600">— {g.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
