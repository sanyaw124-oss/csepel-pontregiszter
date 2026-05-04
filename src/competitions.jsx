// ═══════════════════════════════════════════════════════════════════
// Pontregiszter v0.8 — Versenyek modul (Lépés 2B-1)
// ═══════════════════════════════════════════════════════════════════
// Verseny létrehozás, listázás, alapadatok szerkesztés
// Versenynapok automatikusan generálódnak (SQL trigger)
// Egy napon több kategória + szerek

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar, MapPin, Plus, ArrowLeft, Save, Loader, AlertCircle,
  ChevronRight, Search, Trophy, Users as UsersIcon, Edit2, X
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
// COLORS
// ═══════════════════════════════════════════════════════════════════
const COLORS = {
  blue: '#1e3a8a',
  blueDark: '#0c1e4a',
  blueLight: '#3b82f6',
  blueBg: '#eff6ff',
  red: '#dc2626',
  redDark: '#991b1b',
  redLight: '#fee2e2',
  white: '#ffffff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray500: '#6b7280',
  gray700: '#374151',
  gray900: '#111827',
  // verseny komolysága szerint színek
  importance: {
    fig: { bg: '#fef3c7', text: '#92400e', label: 'FIG nemzetközi' },
    mrgsz_mb: { bg: '#dbeafe', text: '#1e40af', label: 'MRGSZ Magyar Bajnokság' },
    mrgsz_reg: { bg: '#e0e7ff', text: '#3730a3', label: 'MRGSZ Regionális' },
    diakolimpia: { bg: '#fce7f3', text: '#9d174d', label: 'Diákolimpia' },
    klub: { bg: '#d1fae5', text: '#065f46', label: 'Klubverseny' },
    egyeb: { bg: '#f3f4f6', text: '#374151', label: 'Egyéb' }
  }
};

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

const IMPORTANCE_OPTIONS = [
  { value: 'fig', label: 'FIG nemzetközi' },
  { value: 'mrgsz_mb', label: 'MRGSZ Magyar Bajnokság' },
  { value: 'mrgsz_reg', label: 'MRGSZ Regionális verseny' },
  { value: 'diakolimpia', label: 'Diákolimpia' },
  { value: 'klub', label: 'Klubverseny / Kisverseny' },
  { value: 'egyeb', label: 'Egyéb' }
];

const KATEGORIA_OPTIONS = ['VSK I', 'VSK II', 'SZK', 'BNK'];
const KOROSZTALY_OPTIONS = ['kisgyermek', 'gyermek', 'serdülő', 'junior', 'felnőtt'];

const APPARATUS_OPTIONS = [
  { value: 'szabad', label: 'Szabad gyakorlat' },
  { value: 'karika', label: 'Karika' },
  { value: 'labda', label: 'Labda' },
  { value: 'buzogany', label: 'Buzogány' },
  { value: 'szalag', label: 'Szalag' },
  { value: 'kotel', label: 'Kötél' }
];

const APPARATUS_LABELS = {
  szabad: 'Szabad', karika: 'Karika', labda: 'Labda',
  buzogany: 'Buzogány', szalag: 'Szalag', kotel: 'Kötél'
};

// Csapat-gyakorlat előre meghatározott opciók (2025-2028 ciklus)
const TEAM_EXERCISES = [
  '5 labda',
  '5 szalag',
  '3 karika + 2 buzogánypár',
  '3 labda + 2 karika',
  'Egyéb (manuális)'
];

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function formatDateRange(start, end) {
  if (!start) return '';
  const s = new Date(start);
  if (!end || start === end) {
    return s.toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }
  const e = new Date(end);
  return `${s.toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' })} – ${e.toLocaleDateString('hu-HU', { month: '2-digit', day: '2-digit' })}`;
}

function importanceBadge(importance) {
  const config = COLORS.importance[importance] || COLORS.importance.egyeb;
  return (
    <span 
      className="text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      {config.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}

function Input(props) {
  return (
    <input
      autoComplete="off"
      {...props}
      className={`w-full px-3 py-2 border rounded-lg outline-none transition-all ${props.className || ''}`}
      style={{ borderColor: COLORS.gray200, ...props.style }}
      onFocus={(e) => { e.target.style.borderColor = COLORS.blue; props.onFocus && props.onFocus(e); }}
      onBlur={(e) => { e.target.style.borderColor = COLORS.gray200; props.onBlur && props.onBlur(e); }}
    />
  );
}

function Select({ children, ...props }) {
  return (
    <select
      {...props}
      className={`w-full px-3 py-2 border rounded-lg outline-none ${props.className || ''}`}
      style={{ borderColor: COLORS.gray200, backgroundColor: 'white', ...props.style }}
    >
      {children}
    </select>
  );
}

function PrimaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      className={`px-4 py-2 rounded-lg font-medium text-white text-sm flex items-center gap-1.5 disabled:opacity-50 ${props.className || ''}`}
      style={{ backgroundColor: COLORS.blue, ...props.style }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      className={`px-4 py-2 rounded-lg font-medium border text-sm flex items-center gap-1.5 disabled:opacity-50 ${props.className || ''}`}
      style={{ borderColor: COLORS.gray200, color: COLORS.gray700, backgroundColor: 'white', ...props.style }}
    >
      {children}
    </button>
  );
}

function ErrorBox({ children }) {
  if (!children) return null;
  return (
    <div className="rounded-lg p-3 text-sm flex gap-2 border"
         style={{ backgroundColor: COLORS.redLight, borderColor: COLORS.red, color: COLORS.redDark }}>
      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPETITIONS VIEW (fő komponens)
// ═══════════════════════════════════════════════════════════════════

export function CompetitionsView({ supabase, userRole, dataReloadKey }) {
  const [editing, setEditing] = useState(null);  // null | 'new' | competition object
  
  const canManage = ['admin', 'szulo_admin', 'vezetoedzo', 'edzo', 'segededzo'].includes(userRole);
  
  if (editing !== null) {
    return (
      <CompetitionEditor
        supabase={supabase}
        competition={editing === 'new' ? null : editing}
        canManage={canManage}
        onClose={() => setEditing(null)}
      />
    );
  }
  
  return (
    <CompetitionsList
      supabase={supabase}
      canManage={canManage}
      dataReloadKey={dataReloadKey}
      onSelect={(c) => setEditing(c)}
      onCreate={() => setEditing('new')}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPETITIONS LIST
// ═══════════════════════════════════════════════════════════════════

function CompetitionsList({ supabase, canManage, dataReloadKey, onSelect, onCreate }) {
  const [competitions, setCompetitions] = useState(null);
  const [search, setSearch] = useState('');
  const [filterImportance, setFilterImportance] = useState('all');
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('competitions')
        .select(`
          id, name, start_date, end_date, importance, is_finalized,
          venue:venues(id, name, city, country),
          days:competition_days(id, day_number, date, type)
        `)
        .order('start_date', { ascending: false });
      if (error) throw error;
      setCompetitions(data || []);
    } catch (err) {
      setError('Versenyek betöltése sikertelen: ' + err.message);
      setCompetitions([]);
    }
  }, [supabase]);

  useEffect(() => { load(); }, [load, dataReloadKey]);

  const filtered = (competitions || []).filter(c => {
    if (filterImportance !== 'all' && c.importance !== filterImportance) return false;
    if (search) {
      const q = search.toLowerCase();
      const venue = c.venue ? `${c.venue.name} ${c.venue.city || ''}` : '';
      if (!c.name.toLowerCase().includes(q) && !venue.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Csoportosítás: közelgő / élő / lezárt
  const today = new Date().toISOString().split('T')[0];
  const upcoming = filtered.filter(c => c.start_date > today);
  const live = filtered.filter(c => c.start_date <= today && c.end_date >= today);
  const past = filtered.filter(c => c.end_date < today);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-2xl font-bold" style={{ color: COLORS.blueDark }}>
          Versenyek
        </h2>
        {canManage && (
          <PrimaryButton onClick={onCreate}>
            <Plus className="w-4 h-4" /> Új verseny
          </PrimaryButton>
        )}
      </div>

      {/* Szűrő sáv */}
      <div className="bg-white rounded-lg border p-3 mb-4 flex flex-wrap gap-2 items-center"
           style={{ borderColor: COLORS.gray200 }}>
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Keresés név vagy helyszín..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 outline-none text-sm bg-transparent"
          />
        </div>
        <Select
          value={filterImportance}
          onChange={(e) => setFilterImportance(e.target.value)}
          style={{ width: 'auto', minWidth: 180 }}
        >
          <option value="all">Minden komolyság</option>
          {IMPORTANCE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </div>

      <ErrorBox>{error}</ErrorBox>

      {competitions === null ? (
        <div className="text-center py-8">
          <Loader className="w-6 h-6 animate-spin mx-auto text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          {(competitions.length === 0)
            ? 'Még nincs verseny. Hozz létre egyet a "Új verseny" gombbal.'
            : 'Nincs a szűrésnek megfelelő verseny.'}
        </div>
      ) : (
        <div className="space-y-4">
          {live.length > 0 && (
            <CompetitionGroup title="📍 Élő versenyek" competitions={live} onSelect={onSelect} />
          )}
          {upcoming.length > 0 && (
            <CompetitionGroup title="📅 Közelgő versenyek" competitions={upcoming} onSelect={onSelect} />
          )}
          {past.length > 0 && (
            <CompetitionGroup title="🏆 Lezárt versenyek" competitions={past} onSelect={onSelect} />
          )}
        </div>
      )}
    </div>
  );
}

function CompetitionGroup({ title, competitions, onSelect }) {
  return (
    <div>
      <h3 className="font-semibold text-sm mb-2" style={{ color: COLORS.gray700 }}>
        {title} ({competitions.length})
      </h3>
      <div className="space-y-2">
        {competitions.map(c => (
          <CompetitionCard key={c.id} competition={c} onClick={() => onSelect(c)} />
        ))}
      </div>
    </div>
  );
}

function CompetitionCard({ competition, onClick }) {
  const venue = competition.venue;
  const days = competition.days || [];
  const dayCount = days.length;
  const hasIndividual = days.some(d => d.type === 'egyeni');
  const hasTeam = days.some(d => d.type === 'csapat');
  
  return (
    <button
      onClick={onClick}
      className="w-full bg-white border rounded-lg p-4 hover:border-blue-400 transition-colors text-left flex items-start gap-3 shadow-sm"
      style={{ borderColor: COLORS.gray200 }}
    >
      <div 
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: COLORS.blueBg }}
      >
        <Calendar className="w-5 h-5" style={{ color: COLORS.blue }} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h4 className="font-semibold text-base truncate" style={{ color: COLORS.blueDark }}>
            {competition.name}
          </h4>
          {importanceBadge(competition.importance)}
          {competition.is_finalized && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              Lezárt
            </span>
          )}
        </div>
        
        <div className="text-xs text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {venue && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {venue.name}{venue.city ? `, ${venue.city}` : ''}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDateRange(competition.start_date, competition.end_date)}
          </span>
          {dayCount > 0 && (
            <span>{dayCount} nap</span>
          )}
          {hasIndividual && hasTeam && <span>· Egyéni + Csapat</span>}
          {hasIndividual && !hasTeam && <span>· Egyéni</span>}
          {!hasIndividual && hasTeam && <span>· Csapat</span>}
        </div>
      </div>
      
      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPETITION EDITOR (egyetlen verseny szerkesztése)
// ═══════════════════════════════════════════════════════════════════

function CompetitionEditor({ supabase, competition, canManage, onClose }) {
  const isNew = !competition;
  const [tab, setTab] = useState('basics');
  const [current, setCurrent] = useState(competition);
  
  const tabs = [
    { id: 'basics', label: 'Alapadatok', icon: Calendar },
    { id: 'days', label: 'Napok és kategóriák', icon: Trophy, disabled: isNew && !current }
    // 2B-2-ben jönnek: { id: 'startlist', label: 'Startlista', icon: UsersIcon }
    // 2B-3-ben jönnek: { id: 'results', label: 'Eredmények', icon: Trophy }
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold flex-1 truncate" style={{ color: COLORS.blueDark }}>
          {isNew && !current ? 'Új verseny' : (current?.name || 'Verseny')}
        </h2>
        {current && current.importance && importanceBadge(current.importance)}
      </div>
      
      {/* Fülek (csak ha létezik a verseny) */}
      {current && (
        <div className="bg-white rounded-lg border mb-4 shadow-sm" style={{ borderColor: COLORS.gray200 }}>
          <div className="flex border-b overflow-x-auto" style={{ borderColor: COLORS.gray200 }}>
            {tabs.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => !t.disabled && setTab(t.id)}
                  disabled={t.disabled}
                  className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap disabled:opacity-50"
                  style={{
                    borderColor: tab === t.id ? COLORS.blue : 'transparent',
                    color: tab === t.id ? COLORS.blue : COLORS.gray700
                  }}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
          
          <div className="p-4">
            {tab === 'basics' && (
              <BasicsTab
                supabase={supabase}
                competition={current}
                canManage={canManage}
                onSaved={(updated) => setCurrent(updated)}
              />
            )}
            {tab === 'days' && current && (
              <DaysTab
                supabase={supabase}
                competitionId={current.id}
                canManage={canManage}
              />
            )}
          </div>
        </div>
      )}
      
      {/* Új verseny: csak alapadatok */}
      {!current && (
        <div className="bg-white rounded-lg border p-4 shadow-sm" style={{ borderColor: COLORS.gray200 }}>
          <BasicsTab
            supabase={supabase}
            competition={null}
            canManage={canManage}
            onSaved={(created) => setCurrent(created)}
          />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// BASICS TAB (alapadatok)
// ═══════════════════════════════════════════════════════════════════

function BasicsTab({ supabase, competition, canManage, onSaved }) {
  const isNew = !competition;
  const [form, setForm] = useState({
    name: competition?.name || '',
    venue_id: competition?.venue?.id || competition?.venue_id || '',
    start_date: competition?.start_date || '',
    end_date: competition?.end_date || '',
    importance: competition?.importance || 'klub',
    is_finalized: competition?.is_finalized || false
  });
  const [venues, setVenues] = useState([]);
  const [showNewVenue, setShowNewVenue] = useState(false);
  const [newVenue, setNewVenue] = useState({ name: '', city: '', country: 'Magyarország' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    supabase
      .from('venues')
      .select('id, name, city, country')
      .order('name')
      .then(({ data }) => setVenues(data || []));
  }, [supabase]);

  const save = async () => {
    setError(null);
    if (!form.name.trim()) {
      setError('A verseny neve kötelező');
      return;
    }
    if (!form.start_date) {
      setError('A kezdő dátum kötelező');
      return;
    }
    
    // Ha nincs end_date, akkor = start_date (egynapos)
    const endDate = form.end_date || form.start_date;
    
    if (endDate < form.start_date) {
      setError('A befejező dátum nem lehet korábbi mint a kezdő dátum');
      return;
    }
    
    // Max 7 nap
    const start = new Date(form.start_date);
    const end = new Date(endDate);
    const dayCount = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
    if (dayCount > 7) {
      setError('A verseny max 7 napos lehet');
      return;
    }

    setSaving(true);
    try {
      let venueId = form.venue_id || null;
      
      // Ha új helyszín, hozzuk létre
      if (showNewVenue && newVenue.name.trim()) {
        const { data: createdVenue, error: venueError } = await supabase
          .from('venues')
          .insert({
            name: newVenue.name.trim(),
            city: newVenue.city.trim() || null,
            country: newVenue.country.trim() || 'Magyarország'
          })
          .select()
          .single();
        if (venueError) throw venueError;
        venueId = createdVenue.id;
      }
      
      const payload = {
        name: form.name.trim(),
        venue_id: venueId,
        start_date: form.start_date,
        end_date: endDate,
        importance: form.importance,
        is_finalized: form.is_finalized
      };
      
      let result;
      if (isNew) {
        const { data, error } = await supabase
          .from('competitions')
          .insert(payload)
          .select(`
            id, name, start_date, end_date, importance, is_finalized,
            venue:venues(id, name, city, country),
            days:competition_days(id, day_number, date, type)
          `)
          .single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase
          .from('competitions')
          .update(payload)
          .eq('id', competition.id)
          .select(`
            id, name, start_date, end_date, importance, is_finalized,
            venue:venues(id, name, city, country),
            days:competition_days(id, day_number, date, type)
          `)
          .single();
        if (error) throw error;
        result = data;
      }
      
      onSaved(result);
    } catch (err) {
      setError('Mentés sikertelen: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <Field label="Verseny neve *">
        <Input
          type="text"
          value={form.name}
          onChange={(e) => setForm({...form, name: e.target.value})}
          placeholder="pl. Wroclaw Cup 2026"
          disabled={!canManage}
        />
      </Field>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Kezdő dátum *">
          <Input
            type="date"
            value={form.start_date}
            onChange={(e) => setForm({...form, start_date: e.target.value, end_date: form.end_date || e.target.value})}
            disabled={!canManage}
          />
        </Field>
        <Field label="Befejező dátum" hint="ha 1 napos, hagyhatod üresen">
          <Input
            type="date"
            value={form.end_date}
            onChange={(e) => setForm({...form, end_date: e.target.value})}
            min={form.start_date}
            disabled={!canManage}
          />
        </Field>
      </div>
      
      <Field label="Komolyság *">
        <Select
          value={form.importance}
          onChange={(e) => setForm({...form, importance: e.target.value})}
          disabled={!canManage}
        >
          {IMPORTANCE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </Field>
      
      <Field label="Helyszín">
        {!showNewVenue ? (
          <div className="flex gap-2">
            <Select
              value={form.venue_id}
              onChange={(e) => setForm({...form, venue_id: e.target.value})}
              disabled={!canManage}
              className="flex-1"
            >
              <option value="">— válassz helyszínt —</option>
              {venues.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name}{v.city ? ` (${v.city}` : ''}{v.country && v.country !== 'Magyarország' ? `, ${v.country})` : (v.city ? ')' : '')}
                </option>
              ))}
            </Select>
            {canManage && (
              <SecondaryButton onClick={() => setShowNewVenue(true)}>
                <Plus className="w-4 h-4" /> Új helyszín
              </SecondaryButton>
            )}
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
            <div className="text-sm font-medium text-blue-900">Új helyszín létrehozása:</div>
            <Input
              type="text"
              value={newVenue.name}
              onChange={(e) => setNewVenue({...newVenue, name: e.target.value})}
              placeholder="Helyszín neve (pl. Csepeli Sportcsarnok)"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="text"
                value={newVenue.city}
                onChange={(e) => setNewVenue({...newVenue, city: e.target.value})}
                placeholder="Város"
              />
              <Input
                type="text"
                value={newVenue.country}
                onChange={(e) => setNewVenue({...newVenue, country: e.target.value})}
                placeholder="Ország"
              />
            </div>
            <div className="flex gap-2">
              <SecondaryButton onClick={() => { setShowNewVenue(false); setNewVenue({ name: '', city: '', country: 'Magyarország' }); }}>
                <X className="w-4 h-4" /> Mégse
              </SecondaryButton>
            </div>
          </div>
        )}
      </Field>
      
      {!isNew && canManage && (
        <Field label="Lezárt verseny">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_finalized}
              onChange={(e) => setForm({...form, is_finalized: e.target.checked})}
              style={{ accentColor: COLORS.blue }}
            />
            <span>{form.is_finalized ? 'Lezárt (eredmények véglegesek)' : 'Élő/szerkeszthető'}</span>
          </label>
        </Field>
      )}
      
      <ErrorBox>{error}</ErrorBox>
      
      {canManage && (
        <div className="pt-2">
          <PrimaryButton onClick={save} disabled={saving}>
            {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isNew ? 'Verseny létrehozása' : 'Módosítások mentése'}
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DAYS TAB (versenynapok és kategóriák)
// ═══════════════════════════════════════════════════════════════════

function DaysTab({ supabase, competitionId, canManage }) {
  const [days, setDays] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('competition_days')
        .select(`
          id, day_number, date, type, notes,
          categories:competition_categories(*)
        `)
        .eq('competition_id', competitionId)
        .order('day_number');
      if (error) throw error;
      setDays(data || []);
    } catch (err) {
      setError('Versenynapok betöltése sikertelen: ' + err.message);
      setDays([]);
    }
  }, [supabase, competitionId]);

  useEffect(() => { load(); }, [load]);

  const updateDayType = async (dayId, newType) => {
    try {
      const { error } = await supabase
        .from('competition_days')
        .update({ type: newType })
        .eq('id', dayId);
      if (error) throw error;
      load();
    } catch (err) {
      setError('Frissítés sikertelen: ' + err.message);
    }
  };

  return (
    <div className="space-y-3">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
        💡 A versenynapok automatikusan generálódnak a kezdő/befejező dátum alapján. 
        Itt naponként beállíthatod a típust (egyéni/csapat) és a kategóriákat.
      </div>
      
      <ErrorBox>{error}</ErrorBox>
      
      {days === null ? (
        <div className="text-center py-8">
          <Loader className="w-6 h-6 animate-spin mx-auto text-gray-400" />
        </div>
      ) : days.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          Még nincsenek versenynapok. Ellenőrizd hogy van-e kezdő/befejező dátum.
        </div>
      ) : (
        days.map(day => (
          <DayCard
            key={day.id}
            day={day}
            supabase={supabase}
            canManage={canManage}
            onTypeChange={updateDayType}
            onReload={load}
          />
        ))
      )}
    </div>
  );
}

function DayCard({ day, supabase, canManage, onTypeChange, onReload }) {
  const [showAddCategory, setShowAddCategory] = useState(false);
  const dateStr = new Date(day.date).toLocaleDateString('hu-HU', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
  });
  
  return (
    <div className="border rounded-lg overflow-hidden" style={{ borderColor: COLORS.gray200 }}>
      <div className="bg-gray-50 p-3 flex items-center justify-between flex-wrap gap-2"
           style={{ borderColor: COLORS.gray200 }}>
        <div>
          <div className="font-semibold" style={{ color: COLORS.blueDark }}>
            {day.day_number}. nap
          </div>
          <div className="text-sm text-gray-600">{dateStr}</div>
        </div>
        
        {canManage && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Típus:</span>
            <Select
              value={day.type}
              onChange={(e) => onTypeChange(day.id, e.target.value)}
              style={{ width: 'auto' }}
            >
              <option value="egyeni">Egyéni</option>
              <option value="csapat">Csapat</option>
            </Select>
          </div>
        )}
      </div>
      
      <div className="p-3 space-y-2">
        <div className="text-sm font-medium text-gray-700">
          Kategóriák ({(day.categories || []).length})
        </div>
        
        {(day.categories || []).length === 0 && (
          <div className="text-sm text-gray-500 italic">
            Még nincs kategória erre a napra.
          </div>
        )}
        
        {(day.categories || []).map(cat => (
          <CategoryRow
            key={cat.id}
            category={cat}
            dayType={day.type}
            supabase={supabase}
            canManage={canManage}
            onChanged={onReload}
          />
        ))}
        
        {canManage && (
          showAddCategory ? (
            <NewCategoryForm
              dayId={day.id}
              dayType={day.type}
              supabase={supabase}
              onCancel={() => setShowAddCategory(false)}
              onSaved={() => { setShowAddCategory(false); onReload(); }}
            />
          ) : (
            <button
              onClick={() => setShowAddCategory(true)}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Új kategória ehhez a naphoz
            </button>
          )
        )}
      </div>
    </div>
  );
}

function CategoryRow({ category, dayType, supabase, canManage, onChanged }) {
  const [editing, setEditing] = useState(false);
  
  const removeCategory = async () => {
    if (!window.confirm(`Biztos törlöd a "${category.kategoria} ${category.korosztaly}" kategóriát?`)) return;
    try {
      const { error } = await supabase
        .from('competition_categories')
        .delete()
        .eq('id', category.id);
      if (error) throw error;
      onChanged();
    } catch (err) {
      alert('Törlés sikertelen: ' + err.message);
    }
  };
  
  if (editing) {
    return (
      <CategoryEditForm
        category={category}
        dayType={dayType}
        supabase={supabase}
        onCancel={() => setEditing(false)}
        onSaved={() => { setEditing(false); onChanged(); }}
      />
    );
  }
  
  return (
    <div className="border rounded-lg p-3 flex items-center justify-between gap-2 flex-wrap"
         style={{ borderColor: COLORS.gray200 }}>
      <div className="flex-1">
        <div className="font-medium" style={{ color: COLORS.blueDark }}>
          {category.kategoria} · {category.korosztaly}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          Szerek: {(category.apparatuses || []).length === 0 
            ? <span className="italic">— nincs megadva —</span>
            : (category.apparatuses || []).map(a => APPARATUS_LABELS[a] || a).join(', ')}
        </div>
      </div>
      
      {canManage && (
        <div className="flex gap-1">
          <button
            onClick={() => setEditing(true)}
            className="p-2 hover:bg-gray-100 rounded text-gray-600"
            title="Szerkesztés"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={removeCategory}
            className="p-2 hover:bg-red-50 rounded text-red-600"
            title="Törlés"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function NewCategoryForm({ dayId, dayType, supabase, onCancel, onSaved }) {
  const [form, setForm] = useState({
    kategoria: 'VSK II',
    korosztaly: 'serdülő',
    apparatuses: []
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  const toggleApparatus = (a) => {
    setForm(f => ({
      ...f,
      apparatuses: f.apparatuses.includes(a)
        ? f.apparatuses.filter(x => x !== a)
        : [...f.apparatuses, a]
    }));
  };
  
  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      const { error } = await supabase
        .from('competition_categories')
        .insert({
          competition_day_id: dayId,
          kategoria: form.kategoria,
          korosztaly: form.korosztaly,
          apparatuses: form.apparatuses
        });
      if (error) throw error;
      onSaved();
    } catch (err) {
      setError('Mentés sikertelen: ' + err.message);
      setSaving(false);
    }
  };
  
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
      <div className="font-medium text-sm text-amber-900">Új kategória</div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Kategória">
          <Select
            value={form.kategoria}
            onChange={(e) => setForm({...form, kategoria: e.target.value})}
          >
            {KATEGORIA_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
          </Select>
        </Field>
        <Field label="Korosztály">
          <Select
            value={form.korosztaly}
            onChange={(e) => setForm({...form, korosztaly: e.target.value})}
          >
            {KOROSZTALY_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
          </Select>
        </Field>
      </div>
      
      <Field label={dayType === 'csapat' ? 'Csapatgyakorlat (1 vagy 2)' : 'Szerek (válaszd ki amivel mennek)'}>
        <div className="flex flex-wrap gap-2">
          {APPARATUS_OPTIONS.map(opt => (
            <label
              key={opt.value}
              className="flex items-center gap-1.5 px-2 py-1 border rounded cursor-pointer text-sm"
              style={{ 
                borderColor: form.apparatuses.includes(opt.value) ? COLORS.blue : COLORS.gray200,
                backgroundColor: form.apparatuses.includes(opt.value) ? COLORS.blueBg : 'white'
              }}
            >
              <input
                type="checkbox"
                checked={form.apparatuses.includes(opt.value)}
                onChange={() => toggleApparatus(opt.value)}
                style={{ accentColor: COLORS.blue }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </Field>
      
      <ErrorBox>{error}</ErrorBox>
      
      <div className="flex gap-2">
        <PrimaryButton onClick={save} disabled={saving}>
          {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Mentés
        </PrimaryButton>
        <SecondaryButton onClick={onCancel}>
          <X className="w-4 h-4" /> Mégse
        </SecondaryButton>
      </div>
    </div>
  );
}

function CategoryEditForm({ category, dayType, supabase, onCancel, onSaved }) {
  const [form, setForm] = useState({
    kategoria: category.kategoria,
    korosztaly: category.korosztaly,
    apparatuses: category.apparatuses || []
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  const toggleApparatus = (a) => {
    setForm(f => ({
      ...f,
      apparatuses: f.apparatuses.includes(a)
        ? f.apparatuses.filter(x => x !== a)
        : [...f.apparatuses, a]
    }));
  };
  
  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      const { error } = await supabase
        .from('competition_categories')
        .update({
          kategoria: form.kategoria,
          korosztaly: form.korosztaly,
          apparatuses: form.apparatuses
        })
        .eq('id', category.id);
      if (error) throw error;
      onSaved();
    } catch (err) {
      setError('Mentés sikertelen: ' + err.message);
      setSaving(false);
    }
  };
  
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
      <div className="font-medium text-sm text-blue-900">Kategória szerkesztése</div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Kategória">
          <Select
            value={form.kategoria}
            onChange={(e) => setForm({...form, kategoria: e.target.value})}
          >
            {KATEGORIA_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
          </Select>
        </Field>
        <Field label="Korosztály">
          <Select
            value={form.korosztaly}
            onChange={(e) => setForm({...form, korosztaly: e.target.value})}
          >
            {KOROSZTALY_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
          </Select>
        </Field>
      </div>
      
      <Field label={dayType === 'csapat' ? 'Csapatgyakorlat (1 vagy 2)' : 'Szerek'}>
        <div className="flex flex-wrap gap-2">
          {APPARATUS_OPTIONS.map(opt => (
            <label
              key={opt.value}
              className="flex items-center gap-1.5 px-2 py-1 border rounded cursor-pointer text-sm"
              style={{ 
                borderColor: form.apparatuses.includes(opt.value) ? COLORS.blue : COLORS.gray200,
                backgroundColor: form.apparatuses.includes(opt.value) ? COLORS.blueBg : 'white'
              }}
            >
              <input
                type="checkbox"
                checked={form.apparatuses.includes(opt.value)}
                onChange={() => toggleApparatus(opt.value)}
                style={{ accentColor: COLORS.blue }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </Field>
      
      <ErrorBox>{error}</ErrorBox>
      
      <div className="flex gap-2">
        <PrimaryButton onClick={save} disabled={saving}>
          {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Mentés
        </PrimaryButton>
        <SecondaryButton onClick={onCancel}>
          <X className="w-4 h-4" /> Mégse
        </SecondaryButton>
      </div>
    </div>
  );
}
