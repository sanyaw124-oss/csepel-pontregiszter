// ═══════════════════════════════════════════════════════════════════
// Kabala-szavazás az Áttekintés oldalon (v1.11.0), Sándor 2026.11.01.
//   - jelölteket képpel az Admin / Szülő-admin / Vezetőedző / Edző kezel
//   - fiókonként egy szavazat, utólag nem módosítható (az adatbázis kényszeríti)
//   - eredmény csak a saját szavazat után vagy lezárás után; hogy ki mire
//     szavazott, senki nem látja
//   - ha az SQL még nem futott le, a doboz egyszerűen nem jelenik meg
// Adatbázis: docs/sql/2026-11-01_v1.11.0_kabala-szavazas.sql
// ═══════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from 'react';
import { resizeImage } from './avatar';

const BUCKET = 'mascot-photos';
const MAX_SIDE = 1000;
const EDITORS = ['admin', 'szulo_admin', 'vezetoedzo', 'edzo'];

const btnPrimary = 'px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-700 text-white font-semibold shadow disabled:opacity-50 disabled:cursor-not-allowed';
const btnSecondary = 'px-3 py-1.5 rounded-lg bg-white border-2 border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed';
const btnDanger = 'px-3 py-1.5 rounded-lg bg-white border-2 border-red-400 hover:bg-red-50 text-red-700 font-semibold text-sm disabled:opacity-50';
const btnDangerArmed = 'px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm disabled:opacity-50';
const inputCls = 'w-full border-2 border-slate-300 rounded-lg px-3 py-2 text-sm';

function Photo({ url, name, className }) {
  if (!url) {
    return <div className={`flex items-center justify-center bg-pink-50 text-4xl ${className}`} aria-label={name}>🧸</div>;
  }
  return <img src={url} alt={name} className={`object-contain bg-white ${className}`} draggable={false} />;
}

async function uploadPhoto(supabase, candidate, file) {
  if (!file.type.startsWith('image/')) throw new Error('Képfájlt válassz (JPG, PNG)!');
  const blob = await resizeImage(file, MAX_SIDE);
  const path = `${candidate.id}/${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (upErr) throw upErr;
  const { error: dbErr } = await supabase.from('mascot_candidates').update({ photo_path: path }).eq('id', candidate.id);
  if (dbErr) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw dbErr;
  }
  if (candidate.photo_path) await supabase.storage.from(BUCKET).remove([candidate.photo_path]);
}

// ─── Szavazó nézet: képes kártyák, kiválasztás, majd külön gomb ───
function VoteCards({ candidates, urls, onVote, busy }) {
  const [picked, setPicked] = useState(null);
  const pickedCandidate = candidates.find(c => c.id === picked);
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {candidates.map(c => (
          <button key={c.id} type="button" onClick={() => setPicked(c.id)}
            className={`text-left rounded-xl overflow-hidden bg-white border-4 shadow-sm hover:shadow-md transition ${picked === c.id ? 'border-pink-600' : 'border-slate-200 hover:border-pink-300'}`}>
            <Photo url={urls[c.id]} name={c.name} className="w-full aspect-square" />
            <div className="p-2">
              <div className="font-bold text-slate-900">{picked === c.id ? '✓ ' : ''}{c.name}</div>
              {c.note && <div className="text-xs text-slate-600 mt-0.5">{c.note}</div>}
            </div>
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className={btnPrimary} disabled={!picked || busy} onClick={() => onVote(picked)}>
          {pickedCandidate ? `Szavazok erre: ${pickedCandidate.name}` : 'Válassz egy képet!'}
        </button>
        <span className="text-sm text-slate-700">Egyszer szavazhatsz, és utólag nem módosítható.</span>
      </div>
    </>
  );
}

// ─── Eredmény: szavazatok szerint, a győztes(ek) kiemelve lezárás után ───
function Results({ candidates, urls, status }) {
  const results = status.results || {};
  const count = id => results[id] || 0;
  const sorted = [...candidates].sort((a, b) => count(b.id) - count(a.id));
  const total = Object.values(results).reduce((s, n) => s + n, 0);
  const top = sorted.length ? count(sorted[0].id) : 0;
  const closed = status.status === 'closed';
  return (
    <div className="space-y-2">
      {sorted.map(c => {
        const n = count(c.id);
        const pct = total ? Math.round((n / total) * 100) : 0;
        const winner = closed && top > 0 && n === top;
        return (
          <div key={c.id} className={`flex items-center gap-3 rounded-xl bg-white p-2 border-2 ${winner ? 'border-yellow-400' : 'border-slate-200'}`}>
            <Photo url={urls[c.id]} name={c.name} className={`${winner ? 'w-24 h-24' : 'w-14 h-14'} rounded-lg flex-shrink-0`} />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-bold text-slate-900">
                  {winner ? '🏆 ' : ''}{c.name}
                  {status.my_vote === c.id && <span className="ml-2 text-xs font-semibold text-pink-700">✓ Te erre szavaztál</span>}
                </span>
                <span className="text-sm font-semibold text-slate-700">{n} szavazat · {pct}%</span>
              </div>
              <div className="mt-1 h-3 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full bg-pink-600" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Jelölt felvétele / szerkesztése ───
function CandidateForm({ supabase, candidate, onDone, onCancel }) {
  const [name, setName] = useState(candidate?.name || '');
  const [note, setNote] = useState(candidate?.note || '');
  const [shopUrl, setShopUrl] = useState(candidate?.shop_url || '');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Add meg a jelölt nevét!'); return; }
    const url = shopUrl.trim();
    if (url && !/^https?:\/\//i.test(url)) { setError('A bolt linkje http:// vagy https:// kezdetű legyen!'); return; }
    setSaving(true);
    setError(null);
    try {
      const row = { name: name.trim(), note: note.trim() || null, shop_url: url || null };
      let saved = candidate;
      if (candidate) {
        const { error: err } = await supabase.from('mascot_candidates').update(row).eq('id', candidate.id);
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase.from('mascot_candidates').insert(row).select().single();
        if (err) throw err;
        saved = data;
      }
      if (file) await uploadPhoto(supabase, saved, file);
      onDone();
    } catch (err) {
      setError(err.message || 'Nem sikerült menteni.');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="bg-white rounded-xl border-2 border-pink-300 p-3 space-y-2">
      <div className="font-bold text-slate-900">{candidate ? `Szerkesztés: ${candidate.name}` : 'Új jelölt'}</div>
      <div className="grid md:grid-cols-2 gap-2">
        <label className="block text-sm font-semibold text-slate-700">Név (ezt látják a szavazók)
          <input className={inputCls} value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder="pl. Fehér maci" />
        </label>
        <label className="block text-sm font-semibold text-slate-700">Rövid leírás (nem kötelező, ezt is látják)
          <input className={inputCls} value={note} maxLength={120} onChange={e => setNote(e.target.value)} placeholder="pl. 100 cm magas" />
        </label>
        <label className="block text-sm font-semibold text-slate-700">Bolt linkje (nem kötelező, csak a kezelők látják)
          <input className={inputCls} value={shopUrl} onChange={e => setShopUrl(e.target.value)} placeholder="https://…" />
        </label>
        <label className="block text-sm font-semibold text-slate-700">{candidate?.photo_path ? 'Kép cseréje' : 'Kép'}
          <input className={inputCls} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] || null)} />
        </label>
      </div>
      {error && <div className="text-sm font-semibold text-red-700">{error}</div>}
      <div className="flex gap-2">
        <button type="submit" className={btnPrimary} disabled={saving}>{saving ? 'Mentés…' : 'Mentés'}</button>
        <button type="button" className={btnSecondary} disabled={saving} onClick={onCancel}>Mégse</button>
      </div>
    </form>
  );
}

// ─── Kezelőfelület (csak szerkesztőknek) ───
function ManagePanel({ supabase, candidates, urls, status, onChanged }) {
  const [editing, setEditing] = useState(null); // null | 'new' | jelölt
  const [armed, setArmed] = useState(null); // kétlépcsős törlés: jelölt-azonosító vagy 'reset'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setArmed(null);
      await onChanged();
    } catch (err) {
      setError(err.message || 'Nem sikerült.');
    }
    setBusy(false);
  };

  const setPollStatus = (next) => run(async () => {
    const { error: err } = await supabase.from('mascot_poll')
      .update({ status: next, updated_at: new Date().toISOString() }).eq('id', 1);
    if (err) throw err;
  });

  const removeCandidate = (c) => run(async () => {
    const { error: err } = await supabase.from('mascot_candidates').delete().eq('id', c.id);
    if (err) {
      if (err.code === '23503') throw new Error(`A(z) „${c.name}” jelöltre már szavaztak, ezért nem törölhető.`);
      throw err;
    }
    if (c.photo_path) await supabase.storage.from(BUCKET).remove([c.photo_path]);
  });

  const resetVotes = () => run(async () => {
    const { error: err } = await supabase.rpc('mascot_reset');
    if (err) throw err;
  });

  const state = status.status;
  return (
    <div className="mt-3 rounded-xl bg-slate-100 border-2 border-slate-300 p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-800">
          Állapot: {state === 'draft' ? 'előkészítés (csak a kezelők látják)' : state === 'open' ? 'a szavazás nyitva' : 'lezárva'} · eddig {status.total} szavazat
        </span>
        {state === 'draft' && (
          <button type="button" className={btnPrimary} disabled={busy || candidates.length < 2} onClick={() => setPollStatus('open')}>Szavazás indítása</button>
        )}
        {state === 'open' && (
          <button type="button" className={btnSecondary} disabled={busy} onClick={() => setPollStatus('closed')}>Szavazás lezárása</button>
        )}
        {state === 'closed' && (
          <button type="button" className={btnSecondary} disabled={busy} onClick={() => setPollStatus('open')}>Újranyitás</button>
        )}
        {state !== 'draft' && (
          <button type="button" className={btnSecondary} disabled={busy} onClick={() => setPollStatus('draft')}>Elrejtés mindenki elől</button>
        )}
        {state === 'draft' && status.total > 0 && (
          armed === 'reset'
            ? <button type="button" className={btnDangerArmed} disabled={busy} onClick={resetVotes}>Igen, minden szavazatot törlök</button>
            : <button type="button" className={btnDanger} disabled={busy} onClick={() => setArmed('reset')}>Szavazatok törlése…</button>
        )}
      </div>
      {state === 'draft' && candidates.length < 2 && (
        <div className="text-sm text-slate-700">Az indításhoz legalább két jelölt kell.</div>
      )}
      {error && <div className="text-sm font-semibold text-red-700">{error}</div>}

      {candidates.map(c => (
        editing?.id === c.id ? (
          <CandidateForm key={c.id} supabase={supabase} candidate={c}
            onCancel={() => setEditing(null)} onDone={async () => { setEditing(null); await onChanged(); }} />
        ) : (
          <div key={c.id} className="flex flex-wrap items-center gap-3 bg-white rounded-lg border border-slate-300 p-2">
            <Photo url={urls[c.id]} name={c.name} className="w-14 h-14 rounded-lg flex-shrink-0" />
            <div className="flex-1 min-w-[10rem]">
              <div className="font-bold text-slate-900">{c.name}</div>
              {c.note && <div className="text-xs text-slate-600">{c.note}</div>}
              {c.shop_url && /^https?:\/\//i.test(c.shop_url) && (
                <a href={c.shop_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-blue-700 underline">Megnézem a boltban</a>
              )}
            </div>
            <button type="button" className={btnSecondary} disabled={busy} onClick={() => setEditing(c)}>Szerkesztés</button>
            {armed === c.id
              ? <button type="button" className={btnDangerArmed} disabled={busy} onClick={() => removeCandidate(c)}>Igen, törlöm</button>
              : <button type="button" className={btnDanger} disabled={busy} onClick={() => setArmed(c.id)}>Törlés</button>}
          </div>
        )
      ))}

      {editing === 'new' ? (
        <CandidateForm supabase={supabase} onCancel={() => setEditing(null)}
          onDone={async () => { setEditing(null); await onChanged(); }} />
      ) : (
        <button type="button" className={btnSecondary} disabled={busy} onClick={() => setEditing('new')}>+ Új jelölt</button>
      )}
    </div>
  );
}

export function MascotPollWidget({ supabase, role }) {
  const [status, setStatus] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [urls, setUrls] = useState({});
  const [manage, setManage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const canManage = EDITORS.includes(role);

  const load = useCallback(async () => {
    const { data: st, error: stErr } = await supabase.rpc('mascot_status');
    if (stErr) {
      // Az SQL még nem futott le vagy átmeneti hiba: az Áttekintés maradjon zavartalan
      console.error('MascotPollWidget:', stErr);
      return;
    }
    const { data: list, error: listErr } = await supabase.from('mascot_candidates')
      .select('id, name, note, shop_url, photo_path, created_at').order('created_at');
    if (listErr) {
      console.error('MascotPollWidget:', listErr);
      return;
    }
    const withPhoto = (list || []).filter(c => c.photo_path);
    const nextUrls = {};
    if (withPhoto.length) {
      const { data: signed } = await supabase.storage.from(BUCKET)
        .createSignedUrls(withPhoto.map(c => c.photo_path), 60 * 60);
      withPhoto.forEach((c, i) => { if (signed?.[i]?.signedUrl) nextUrls[c.id] = signed[i].signedUrl; });
    }
    setCandidates(list || []);
    setUrls(nextUrls);
    setStatus(st);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const vote = async (candidateId) => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('mascot_vote', { p_candidate: candidateId });
    if (err) setError(err.message || 'Nem sikerült a szavazás.');
    await load();
    setBusy(false);
  };

  if (!status) return null;
  const isDraft = status.status === 'draft';
  if (!canManage && (isDraft || candidates.length === 0)) return null;

  const showResults = status.results && (status.my_vote || status.status === 'closed');
  const heading = status.status === 'closed'
    ? '🧸 A Csepeli RG kabalája'
    : '🧸 Szavazz: ki legyen a Csepeli RG kabalája?';

  return (
    <section className="mb-4 rounded-2xl border-2 border-pink-300 bg-pink-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-lg font-bold text-pink-900">{heading}</h3>
        {canManage && (
          <button type="button" className={btnSecondary} onClick={() => setManage(m => !m)}>
            {manage ? 'Kezelés bezárása' : 'Jelöltek kezelése'}
          </button>
        )}
      </div>

      {isDraft && !manage && (
        <div className="text-sm text-slate-700">A szavazás még előkészítés alatt van, csak a kezelők látják ezt a dobozt.</div>
      )}
      {!isDraft && status.status === 'open' && !status.my_vote && (
        <VoteCards candidates={candidates} urls={urls} onVote={vote} busy={busy} />
      )}
      {!isDraft && showResults && (
        <>
          {status.status === 'open' && <div className="text-sm font-semibold text-pink-900 mb-2">Köszönjük a szavazatodat! Így áll most a verseny:</div>}
          <Results candidates={candidates} urls={urls} status={status} />
        </>
      )}
      {error && <div className="mt-2 text-sm font-semibold text-red-700">{error}</div>}

      {canManage && manage && (
        <ManagePanel supabase={supabase} candidates={candidates} urls={urls} status={status} onChanged={load} />
      )}
    </section>
  );
}
