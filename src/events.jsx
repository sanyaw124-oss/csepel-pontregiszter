// ═══════════════════════════════════════════════════════════════════
// PONTREGISZTER v0.9.21 — KLUB ÜZENŐFAL
// Klub események kezelése: versenyek érkezési időpontjai, sportorvos,
// fotózás, megbeszélés, klubprogramok, stb.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit2, Trash2, Save, X, Loader, AlertCircle, Calendar,
  Clock, MapPin, Users, MessageCircle, Filter, ArrowLeft, Check, ChevronDown
} from 'lucide-react';

const COLORS = {
  blue: '#1e3a8a',
  blueDark: '#1e3a8a',
  red: '#BE123C',
  gray200: '#e5e7eb',
  gray700: '#374151'
};

const EVENT_TYPES = [
  { value: 'verseny', label: 'Verseny', icon: '🏆', color: '#BE123C', bg: '#FEE2E2' },
  { value: 'orvos', label: 'Sportorvos / Vizsgálat', icon: '🏥', color: '#DC2626', bg: '#FEE2E2' },
  { value: 'fotozas', label: 'Fotózás', icon: '📸', color: '#7c3aed', bg: '#EDE9FE' },
  { value: 'bemutato', label: 'Bemutató / Fellépés', icon: '🎭', color: '#DB2777', bg: '#FCE7F3' },
  { value: 'megbeszeles', label: 'Klubmegbeszélés', icon: '👥', color: '#0891B2', bg: '#CFFAFE' },
  { value: 'klubprogram', label: 'Klubprogram', icon: '🎉', color: '#16A34A', bg: '#DCFCE7' },
  { value: 'egyeb', label: 'Egyéb', icon: '📋', color: '#6B7280', bg: '#F3F4F6' }
];

const KATEGORIAK = ['BNK', 'SZK', 'VSK I', 'VSK II'];
const KOROSZTALYOK = ['Mini', 'Kisgyermek', 'Gyermek', 'Serdülő', 'Junior', 'Ifjúsági', 'Felnőtt'];

// ═══════════════════════════════════════════════════════════════════
// MAIN: EventsView
// ═══════════════════════════════════════════════════════════════════

export function EventsView({ supabase, userRole }) {
  const [events, setEvents] = useState(null);
  const [filter, setFilter] = useState('upcoming'); // upcoming | past | all
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);

  const canManage = ['admin', 'szulo_admin', 'vezetoedzo', 'edzo'].includes(userRole);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('club_events')
        .select(`
          *,
          arrival_times:event_arrival_times(
            id, arrival_time, group_label, note, display_order,
            competitors:event_arrival_competitors(
              competitor:competitors(id, full_name, nickname)
            )
          )
        `)
        .order('event_date', { ascending: false });
      if (err) throw err;
      setEvents(data || []);
    } catch (err) {
      setError(err.message);
    }
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (event) => {
    if (!window.confirm(`Biztos törlöd? "${event.title}"`)) return;
    try {
      await supabase.from('club_events').delete().eq('id', event.id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (editing !== null) {
    return (
      <EventForm
        supabase={supabase}
        event={editing === 'new' ? null : editing}
        onSaved={() => { setEditing(null); load(); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  if (events === null) {
    return (
      <div className="flex justify-center py-12">
        <Loader className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  
  const filtered = events.filter(e => {
    if (filter === 'upcoming') return e.event_date >= today;
    if (filter === 'past') return e.event_date < today;
    return true;
  });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4" style={{ color: COLORS.blueDark }}>
        📢 Klub üzenőfal
      </h2>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 mb-4 shadow-sm">
        <div className="flex items-center justify-between p-3 border-b border-gray-200 flex-wrap gap-2">
          <div className="flex gap-1 bg-gray-100 p-1 rounded">
            <button
              onClick={() => setFilter('upcoming')}
              className="px-3 py-1.5 rounded text-sm font-medium transition-all"
              style={{
                backgroundColor: filter === 'upcoming' ? 'white' : 'transparent',
                color: filter === 'upcoming' ? COLORS.blue : COLORS.gray700,
                boxShadow: filter === 'upcoming' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              📅 Aktuális
            </button>
            <button
              onClick={() => setFilter('past')}
              className="px-3 py-1.5 rounded text-sm font-medium transition-all"
              style={{
                backgroundColor: filter === 'past' ? 'white' : 'transparent',
                color: filter === 'past' ? COLORS.blue : COLORS.gray700,
                boxShadow: filter === 'past' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              🕐 Múltbeli
            </button>
            <button
              onClick={() => setFilter('all')}
              className="px-3 py-1.5 rounded text-sm font-medium transition-all"
              style={{
                backgroundColor: filter === 'all' ? 'white' : 'transparent',
                color: filter === 'all' ? COLORS.blue : COLORS.gray700,
                boxShadow: filter === 'all' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              📋 Mind
            </button>
          </div>
          
          {canManage && (
            <button
              onClick={() => setEditing('new')}
              className="px-4 py-2 rounded text-white text-sm font-medium flex items-center gap-1"
              style={{ backgroundColor: COLORS.blue }}
            >
              <Plus className="w-4 h-4" /> Új bejegyzés
            </button>
          )}
        </div>

        <div className="p-3 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center text-gray-500 py-8 text-sm">
              {filter === 'upcoming' && 'Nincs közelgő esemény.'}
              {filter === 'past' && 'Nincs múltbeli esemény.'}
              {filter === 'all' && 'Még nincs bejegyzés.'}
            </div>
          ) : (
            filtered.map(event => (
              <EventCard
                key={event.id}
                event={event}
                canManage={canManage}
                onEdit={() => setEditing(event)}
                onDelete={() => handleDelete(event)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EventCard - egy bejegyzés megjelenítése
// ═══════════════════════════════════════════════════════════════════

function EventCard({ event, canManage, onEdit, onDelete }) {
  const typeInfo = EVENT_TYPES.find(t => t.value === event.event_type) || EVENT_TYPES[6];
  
  const today = new Date().toISOString().split('T')[0];
  const isPast = event.event_date < today;
  const isToday = event.event_date === today;
  
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const days = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'];
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} (${days[d.getDay()]})`;
  };

  const audienceLabel = () => {
    if (event.audience_type === 'all') return 'Mindenki';
    if (event.audience_type === 'category') return `Kategória: ${event.audience_category}`;
    if (event.audience_type === 'korosztaly') return `Korosztály: ${event.audience_korosztaly}`;
    if (event.audience_type === 'individual') return 'Egyéni';
    return '';
  };

  const arrivals = (event.arrival_times || []).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

  return (
    <div 
      className="rounded-lg p-3 border-l-4"
      style={{ 
        backgroundColor: isPast ? '#f9fafb' : typeInfo.bg,
        borderLeftColor: typeInfo.color,
        opacity: isPast ? 0.7 : 1
      }}
    >
      <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-base flex items-center gap-2 flex-wrap" style={{ color: typeInfo.color }}>
            <span className="text-xl">{typeInfo.icon}</span>
            <span>{event.title}</span>
            {isToday && (
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium">
                MA
              </span>
            )}
          </div>
        </div>
        {canManage && (
          <div className="flex gap-1">
            <button onClick={onEdit} className="p-1.5 hover:bg-white rounded" title="Szerkesztés">
              <Edit2 className="w-3.5 h-3.5 text-gray-500" />
            </button>
            <button onClick={onDelete} className="p-1.5 hover:bg-red-50 rounded" title="Törlés">
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
            </button>
          </div>
        )}
      </div>

      <div className="text-sm space-y-1 text-gray-700">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formatDate(event.event_date)}</span>
          {event.event_time && (
            <>
              <Clock className="w-3.5 h-3.5 ml-2" />
              <span className="font-medium">{event.event_time}</span>
            </>
          )}
        </div>
        
        {event.venue && (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            <span>{event.venue}</span>
          </div>
        )}
        
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          <span>{audienceLabel()}</span>
        </div>
        
        {event.description && (
          <div className="flex items-start gap-1.5 mt-1.5">
            <MessageCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span className="italic">{event.description}</span>
          </div>
        )}
        
        {/* Érkezési időpontok (több csoport) */}
        {arrivals.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <div className="text-xs font-semibold text-gray-700 mb-1">⏰ Érkezési időpontok:</div>
            <div className="space-y-1">
              {arrivals.map(a => (
                <div key={a.id} className="bg-white/70 rounded p-1.5 text-xs">
                  <span className="font-semibold">{a.arrival_time}</span>
                  {a.group_label && <span className="text-gray-600"> · {a.group_label}</span>}
                  {a.competitors && a.competitors.length > 0 && (
                    <div className="ml-3 text-gray-600 mt-0.5">
                      {a.competitors.map((c, i) => (
                        <span key={i}>
                          {i > 0 && ', '}
                          {c.competitor?.nickname ? `${c.competitor.full_name.split(' ')[0]} "${c.competitor.nickname}"` : c.competitor?.full_name}
                        </span>
                      ))}
                    </div>
                  )}
                  {a.note && <div className="ml-3 italic text-gray-500 mt-0.5">{a.note}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EventForm - bejegyzés szerkesztő űrlap
// ═══════════════════════════════════════════════════════════════════

function EventForm({ supabase, event, onSaved, onCancel }) {
  const [form, setForm] = useState({
    event_type: event?.event_type || 'egyeb',
    title: event?.title || '',
    description: event?.description || '',
    event_date: event?.event_date || new Date().toISOString().split('T')[0],
    event_time: event?.event_time || '',
    venue: event?.venue || '',
    audience_type: event?.audience_type || 'all',
    audience_category: event?.audience_category || '',
    audience_korosztaly: event?.audience_korosztaly || '',
    is_active: event?.is_active ?? true
  });
  const [arrivals, setArrivals] = useState(
    event?.arrival_times?.length 
      ? event.arrival_times.map(a => ({
          id: a.id,
          arrival_time: a.arrival_time,
          group_label: a.group_label || '',
          note: a.note || '',
          competitor_ids: (a.competitors || []).map(c => c.competitor?.id).filter(Boolean)
        }))
      : []
  );
  const [allCompetitors, setAllCompetitors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase.from('competitors')
      .select('id, full_name, nickname, kategoria, korosztaly')
      .eq('is_active', true)
      .eq('is_provisional', false)
      .order('full_name')
      .then(({ data }) => setAllCompetitors(data || []));
  }, [supabase]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!form.title.trim()) throw new Error('A cím kötelező!');
      if (!form.event_date) throw new Error('A dátum kötelező!');

      const userResp = await supabase.auth.getUser();
      const userId = userResp.data?.user?.id;

      const payload = {
        event_type: form.event_type,
        title: form.title.trim(),
        description: form.description || null,
        event_date: form.event_date,
        event_time: form.event_time || null,
        venue: form.venue || null,
        audience_type: form.audience_type,
        audience_category: form.audience_type === 'category' ? form.audience_category : null,
        audience_korosztaly: form.audience_type === 'korosztaly' ? form.audience_korosztaly : null,
        is_active: form.is_active,
        modified_by: userId,
        modified_at: new Date().toISOString()
      };

      let eventId;
      if (event) {
        eventId = event.id;
        await supabase.from('club_events').update(payload).eq('id', event.id);
        // Régi érkezési időpontok törlése
        await supabase.from('event_arrival_times').delete().eq('event_id', eventId);
      } else {
        payload.created_by = userId;
        const { data: created, error: err } = await supabase
          .from('club_events').insert(payload).select().single();
        if (err) throw err;
        eventId = created.id;
      }

      // Új érkezési időpontok beillesztése
      for (let i = 0; i < arrivals.length; i++) {
        const a = arrivals[i];
        if (!a.arrival_time) continue;
        const { data: insArr, error: arrErr } = await supabase
          .from('event_arrival_times')
          .insert({
            event_id: eventId,
            arrival_time: a.arrival_time,
            group_label: a.group_label || null,
            note: a.note || null,
            display_order: i
          })
          .select()
          .single();
        if (arrErr) throw arrErr;
        
        if (a.competitor_ids && a.competitor_ids.length > 0) {
          const compPayload = a.competitor_ids.map(cid => ({
            arrival_id: insArr.id,
            competitor_id: cid
          }));
          await supabase.from('event_arrival_competitors').insert(compPayload);
        }
      }

      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addArrival = () => {
    setArrivals([...arrivals, { 
      arrival_time: '', group_label: '', note: '', competitor_ids: [] 
    }]);
  };

  const removeArrival = (idx) => {
    setArrivals(arrivals.filter((_, i) => i !== idx));
  };

  const updateArrival = (idx, field, value) => {
    setArrivals(arrivals.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };

  const toggleArrivalCompetitor = (arrIdx, compId) => {
    setArrivals(arrivals.map((a, i) => {
      if (i !== arrIdx) return a;
      const ids = a.competitor_ids || [];
      return {
        ...a,
        competitor_ids: ids.includes(compId) ? ids.filter(id => id !== compId) : [...ids, compId]
      };
    }));
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold" style={{ color: COLORS.blueDark }}>
          {event ? 'Bejegyzés szerkesztése' : 'Új klubesemény'}
        </h2>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3 shadow-sm">
        
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Bejegyzés típusa *</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {EVENT_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setForm({ ...form, event_type: t.value })}
                className="rounded p-2 border-2 text-sm flex items-center gap-1.5 transition-all"
                style={{
                  borderColor: form.event_type === t.value ? t.color : COLORS.gray200,
                  backgroundColor: form.event_type === t.value ? t.bg : 'white'
                }}
              >
                <span>{t.icon}</span>
                <span className="truncate text-xs">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Bejegyzés címe *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Pl. Sportorvos vizsgálat"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Dátum *</label>
            <input
              type="date"
              value={form.event_date}
              onChange={(e) => setForm({ ...form, event_date: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Időpont (opcionális)</label>
            <input
              type="text"
              value={form.event_time}
              onChange={(e) => setForm({ ...form, event_time: e.target.value })}
              placeholder="Pl. 16:00"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Helyszín</label>
          <input
            type="text"
            value={form.venue}
            onChange={(e) => setForm({ ...form, venue: e.target.value })}
            placeholder="Pl. Kis terem, vagy BVSC Sportcsarnok"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Kik érintettek?</label>
          <div className="flex gap-2 flex-wrap">
            {[
              { value: 'all', label: 'Mindenki' },
              { value: 'category', label: 'Kategória szerint' },
              { value: 'korosztaly', label: 'Korosztály szerint' },
              { value: 'individual', label: 'Egyéni (érkezési idő alapján)' }
            ].map(a => (
              <button
                key={a.value}
                onClick={() => setForm({ ...form, audience_type: a.value })}
                className="px-3 py-1.5 rounded border text-xs"
                style={{
                  borderColor: form.audience_type === a.value ? COLORS.blue : COLORS.gray200,
                  backgroundColor: form.audience_type === a.value ? '#EFF6FF' : 'white',
                  color: form.audience_type === a.value ? COLORS.blue : COLORS.gray700
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {form.audience_type === 'category' && (
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Kategória</label>
            <select
              value={form.audience_category}
              onChange={(e) => setForm({ ...form, audience_category: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
            >
              <option value="">— válassz —</option>
              {KATEGORIAK.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        )}

        {form.audience_type === 'korosztaly' && (
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Korosztály</label>
            <select
              value={form.audience_korosztaly}
              onChange={(e) => setForm({ ...form, audience_korosztaly: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
            >
              <option value="">— válassz —</option>
              {KOROSZTALYOK.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Részletes infó (opcionális)</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Pl. Fehér leotárd, vasaltan! Vegyél magaddal vizet és banánt."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
            rows="3"
          />
        </div>

        {/* Érkezési időpontok (több csoport) */}
        <div className="border-t pt-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-700">
              ⏰ Egyéni érkezési időpontok (opcionális)
            </label>
            <button
              onClick={addArrival}
              className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100"
            >
              <Plus className="w-3 h-3 inline" /> Új csoport
            </button>
          </div>

          {arrivals.length === 0 ? (
            <div className="text-xs text-gray-500 italic">
              Ha az eseményen több időpontban érkeznek, itt felveheted őket csoportonként.
            </div>
          ) : (
            <div className="space-y-2">
              {arrivals.map((a, idx) => (
                <div key={idx} className="bg-gray-50 rounded p-2 border border-gray-200">
                  <div className="flex items-start gap-2 mb-2">
                    <input
                      type="text"
                      value={a.arrival_time}
                      onChange={(e) => updateArrival(idx, 'arrival_time', e.target.value)}
                      placeholder="Pl. 7:00"
                      className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                    <input
                      type="text"
                      value={a.group_label}
                      onChange={(e) => updateArrival(idx, 'group_label', e.target.value)}
                      placeholder="Csoport (pl. VSK II Serdülő)"
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                    <button
                      onClick={() => removeArrival(idx)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={a.note}
                    onChange={(e) => updateArrival(idx, 'note', e.target.value)}
                    placeholder="Megjegyzés (pl. Bemelegítés 7:30-tól)"
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded mb-1.5"
                  />
                  
                  {/* Versenyző kapcsolat (csak individual audience) */}
                  {form.audience_type === 'individual' && (
                    <div className="mt-1.5">
                      <div className="text-xs text-gray-600 mb-1">Versenyzők ehhez az időponthoz:</div>
                      <div className="max-h-32 overflow-y-auto border rounded bg-white p-1">
                        {allCompetitors.map(c => (
                          <label key={c.id} className="flex items-center gap-1.5 px-1 py-0.5 hover:bg-gray-50 rounded text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={(a.competitor_ids || []).includes(c.id)}
                              onChange={() => toggleArrivalCompetitor(idx, c.id)}
                            />
                            <span>
                              {c.nickname 
                                ? `${c.full_name.split(' ')[0]} "${c.nickname}" ${c.full_name.split(' ').slice(1).join(' ')}` 
                                : c.full_name}
                              <span className="text-gray-400 ml-1">({c.kategoria} {c.korosztaly})</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="text-xs text-red-600 bg-red-50 p-2 rounded flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded text-white text-sm font-medium disabled:opacity-50 flex items-center gap-1"
            style={{ backgroundColor: COLORS.blue }}
          >
            {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Mentés
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded border border-gray-300 text-sm hover:bg-gray-50"
          >
            Mégse
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// UpcomingEventsWidget - Áttekintés főoldali widget (max 5 esemény, 14 nap)
// ═══════════════════════════════════════════════════════════════════

export function UpcomingEventsWidget({ supabase, onOpenEvents }) {
  const [events, setEvents] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const in14Days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const { data } = await supabase
          .from('club_events')
          .select(`
            id, event_type, title, description, event_date, event_time, venue,
            audience_type, audience_category, audience_korosztaly,
            arrival_times:event_arrival_times(
              id, arrival_time, group_label, note,
              competitors:event_arrival_competitors(
                competitor:competitors(id, full_name, nickname)
              )
            )
          `)
          .eq('is_active', true)
          .gte('event_date', today)
          .lte('event_date', in14Days)
          .order('event_date', { ascending: true })
          .limit(6);
        
        if (active) setEvents(data || []);
      } catch (err) {
        console.error('UpcomingEvents:', err);
        if (active) setEvents([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [supabase]);

  if (loading) return null;
  if (!events || events.length === 0) return null;

  const hasMore = events.length > 5;
  const displayed = events.slice(0, 5);

  const formatRelative = (dateStr) => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    if (dateStr === today) return 'MA';
    if (dateStr === tomorrow) return 'HOLNAP';
    
    const d = new Date(dateStr);
    const todayD = new Date();
    todayD.setHours(0,0,0,0);
    const diff = Math.ceil((d - todayD) / (1000 * 60 * 60 * 24));
    return `${diff} nap múlva`;
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  const audienceLabel = (e) => {
    if (e.audience_type === 'all') return 'Mindenki';
    if (e.audience_type === 'category') return e.audience_category;
    if (e.audience_type === 'korosztaly') return e.audience_korosztaly;
    if (e.audience_type === 'individual') return 'Egyéni';
    return '';
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm flex items-center gap-1.5" style={{ color: COLORS.blueDark }}>
          📅 Közelgő események
        </h3>
        {hasMore && onOpenEvents && (
          <button 
            onClick={onOpenEvents}
            className="text-xs text-blue-600 hover:underline"
          >
            Mind →
          </button>
        )}
      </div>
      
      <div className="space-y-2">
        {displayed.map(e => {
          const typeInfo = EVENT_TYPES.find(t => t.value === e.event_type) || EVENT_TYPES[6];
          const arrivals = e.arrival_times || [];
          const hasExpandable = arrivals.length > 0 || (e.description && e.description.length > 0);
          const isExpanded = expandedId === e.id;
          
          return (
            <div 
              key={e.id} 
              className="rounded border-l-4 text-sm overflow-hidden"
              style={{ 
                backgroundColor: typeInfo.bg,
                borderLeftColor: typeInfo.color
              }}
            >
              <div className="flex items-start gap-2 p-2">
                <span className="text-lg flex-shrink-0">{typeInfo.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold flex items-center gap-1.5 flex-wrap" style={{ color: typeInfo.color }}>
                    <span>{e.title}</span>
                    <span className="text-xs bg-white/70 px-1.5 py-0.5 rounded font-medium">
                      {formatRelative(e.event_date)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                    <span>📅 {formatDate(e.event_date)}</span>
                    {e.event_time && <span>⏰ {e.event_time}</span>}
                    {e.venue && <span>📍 {e.venue}</span>}
                    <span>👥 {audienceLabel(e)}</span>
                  </div>
                </div>
                {hasExpandable && (
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : e.id)}
                    className="p-1 rounded hover:bg-white/50 transition-transform flex-shrink-0"
                    style={{ 
                      color: typeInfo.color,
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                    }}
                    aria-label={isExpanded ? 'Becsukás' : 'Részletek'}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              {/* Részletek kibontható szekció */}
              {hasExpandable && isExpanded && (
                <div className="px-2 pb-2 pt-1 border-t border-white/40 bg-white/30">
                  {e.description && (
                    <div className="text-xs text-gray-700 italic mb-2">
                      💬 {e.description}
                    </div>
                  )}
                  
                  {arrivals.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-gray-700 mb-1">⏰ Érkezési időpontok:</div>
                      <div className="space-y-1">
                        {arrivals.map(a => (
                          <div key={a.id} className="bg-white/70 rounded p-1.5 text-xs">
                            <div>
                              <span className="font-semibold">{a.arrival_time}</span>
                              {a.group_label && <span className="text-gray-600"> · {a.group_label}</span>}
                            </div>
                            {a.competitors && a.competitors.length > 0 && (
                              <div className="text-gray-600 mt-0.5">
                                👥 {a.competitors.map((c, i) => (
                                  <span key={i}>
                                    {i > 0 && ', '}
                                    {c.competitor?.nickname 
                                      ? `${c.competitor.full_name.split(' ')[0]} "${c.competitor.nickname}"` 
                                      : c.competitor?.full_name}
                                  </span>
                                ))}
                              </div>
                            )}
                            {a.note && <div className="italic text-gray-500 mt-0.5">📝 {a.note}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
