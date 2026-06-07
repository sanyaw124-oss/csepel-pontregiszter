// ═══════════════════════════════════════════════════════════════════
// Pontregiszter v0.8 — Versenyek modul (Lépés 2B-1)
// ═══════════════════════════════════════════════════════════════════
// Verseny létrehozás, listázás, alapadatok szerkesztés
// Versenynapok automatikusan generálódnak (SQL trigger)
// Egy napon több kategória + szerek

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar, MapPin, Plus, ArrowLeft, Save, Loader, AlertCircle,
  ChevronRight, Search, Trophy, Users as UsersIcon, Edit2, X, Upload, FileText, Check, UserPlus, Award
} from 'lucide-react';
import { ScoringView } from './scoring';
import { CompetitionTeamsView } from './teams';

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
  const [showImport, setShowImport] = useState(false);
  
  const canManage = ['admin', 'szulo_admin', 'vezetoedzo', 'edzo', 'segededzo'].includes(userRole);
  
  if (showImport) {
    return (
      <JsonImportView
        supabase={supabase}
        onClose={() => setShowImport(false)}
        onImported={(competition) => {
          setShowImport(false);
          setEditing(competition);
        }}
      />
    );
  }
  
  if (editing !== null) {
    return (
      <CompetitionEditor
        supabase={supabase}
        competition={editing === 'new' ? null : editing}
        canManage={canManage}
        userRole={userRole}
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
      onImport={() => setShowImport(true)}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPETITIONS LIST
// ═══════════════════════════════════════════════════════════════════

function CompetitionsList({ supabase, canManage, dataReloadKey, onSelect, onCreate, onImport }) {
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
          <div className="flex gap-2 flex-wrap">
            <SecondaryButton onClick={onImport}>
              <Upload className="w-4 h-4" /> JSON importálás
            </SecondaryButton>
            <PrimaryButton onClick={onCreate}>
              <Plus className="w-4 h-4" /> Új verseny
            </PrimaryButton>
          </div>
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
            <CompetitionGroup title="✅ Elmúlt versenyek" competitions={past} onSelect={onSelect} />
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
          {(() => {
            const today = new Date().toISOString().split('T')[0];
            const isLive = competition.start_date <= today && competition.end_date >= today;
            const isPast = competition.end_date < today;
            
            if (competition.is_finalized) {
              return (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: '#D1FAE5', color: '#15803D' }}>
                  ✓ Lezárt
                </span>
              );
            }
            if (isLive) {
              return (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
                  ● Élő
                </span>
              );
            }
            if (isPast) {
              return (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                  ⏳ Befejezetlen rögzítés
                </span>
              );
            }
            return null; // upcoming, nincs külön plecsni
          })()}
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

function CompetitionEditor({ supabase, competition, canManage, userRole, onClose }) {
  const isNew = !competition;
  const [tab, setTab] = useState('basics');
  const [current, setCurrent] = useState(competition);
  const [showImportToCurrent, setShowImportToCurrent] = useState(false);
  
  const tabs = [
    { id: 'basics', label: 'Alapadatok', icon: Calendar },
    { id: 'days', label: 'Napok és kategóriák', icon: Trophy, disabled: isNew && !current },
    { id: 'csepeli', label: 'Csepeli eredmények', icon: Award, disabled: isNew && !current }
  ];

  // Ha a JSON-import view aktív (meglévő versenyhez)
  if (showImportToCurrent && current) {
    return (
      <JsonImportView
        supabase={supabase}
        existingCompetition={current}
        onClose={() => setShowImportToCurrent(false)}
        onImported={() => {
          setShowImportToCurrent(false);
          setTab('days'); // a Napok fülre dobjuk hogy lássa az új kategóriákat
        }}
      />
    );
  }

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
                onAction={(action) => {
                  if (action === 'import_json') setShowImportToCurrent(true);
                }}
              />
            )}
            {tab === 'days' && current && (
              <DaysTab
                supabase={supabase}
                competitionId={current.id}
                canManage={canManage}
                userRole={userRole}
              />
            )}
            {tab === 'csepeli' && current && (
              <CsepeliResultsTab
                supabase={supabase}
                userRole={userRole}
                competition={current}
                onCompetitionChange={(updated) => setCurrent(updated)}
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

function BasicsTab({ supabase, competition, canManage, onSaved, onAction }) {
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
        <div className="pt-2 flex flex-wrap gap-2">
          <PrimaryButton onClick={save} disabled={saving}>
            {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isNew ? 'Verseny létrehozása' : 'Módosítások mentése'}
          </PrimaryButton>
          
          {/* Meglévő versenynél: JSON import + lezárás */}
          {!isNew && (
            <>
              <SecondaryButton onClick={() => onAction && onAction('import_json')}>
                <Upload className="w-4 h-4" /> Startlista JSON-ból
              </SecondaryButton>
              
              <button
                onClick={async () => {
                  const newState = !form.is_finalized;
                  if (newState && !window.confirm('Biztos lezárod a versenyt? Az eredmények véglegesek lesznek. (Visszavonható.)')) return;
                  if (!newState && !window.confirm('Biztos visszanyitod a versenyt? Az eredmények ismét szerkeszthetők lesznek.')) return;
                  setForm({...form, is_finalized: newState});
                  // Azonnal mentjük is
                  setSaving(true);
                  try {
                    const { error } = await supabase
                      .from('competitions')
                      .update({ is_finalized: newState })
                      .eq('id', competition.id);
                    if (error) throw error;
                    if (onSaved) onSaved({...competition, is_finalized: newState});
                  } catch (err) {
                    setError('Mentés sikertelen: ' + err.message);
                    setForm({...form, is_finalized: !newState});
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                className="px-4 py-2 rounded-lg font-medium text-white text-sm flex items-center gap-1.5 disabled:opacity-50"
                style={{ backgroundColor: form.is_finalized ? COLORS.gray700 : '#15803D' }}
              >
                {form.is_finalized ? <><Edit2 className="w-4 h-4" /> Verseny újranyitása</> : <><Check className="w-4 h-4" /> Verseny lezárása</>}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DAYS TAB (versenynapok és kategóriák)
// ═══════════════════════════════════════════════════════════════════

function DaysTab({ supabase, competitionId, canManage, userRole }) {
  const [days, setDays] = useState(null);
  const [error, setError] = useState(null);
  const [openCategory, setOpenCategory] = useState(null);  // ÚJ: nyitott kategória startlistája

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

  // Ha kategória van nyitva, mutatjuk a startlistát
  if (openCategory) {
    return (
      <StartlistView
        supabase={supabase}
        category={openCategory}
        competitionId={competitionId}
        canManage={canManage}
        userRole={userRole}
        onClose={() => { setOpenCategory(null); load(); }}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
        💡 A versenynapok automatikusan generálódnak a kezdő/befejező dátum alapján. 
        Naponként default típus, kategóriánként is külön (egyéni/csapat) beállítható.
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
            onOpenStartlist={(cat) => setOpenCategory(cat)}
          />
        ))
      )}
    </div>
  );
}

function DayCard({ day, supabase, canManage, onTypeChange, onReload, onOpenStartlist }) {
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
            <span className="text-xs text-gray-500">Default típus:</span>
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
            onOpenStartlist={onOpenStartlist}
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

function CategoryRow({ category, dayType, supabase, canManage, onChanged, onOpenStartlist }) {
  const [editing, setEditing] = useState(false);
  
  const categoryType = category.type || dayType || 'egyeni';
  
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
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium" style={{ color: COLORS.blueDark }}>
            {category.kategoria} · {category.korosztaly}
          </span>
          <span 
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ 
              backgroundColor: categoryType === 'csapat' ? '#fef3c7' : COLORS.blueBg,
              color: categoryType === 'csapat' ? '#92400e' : COLORS.blue
            }}
          >
            {categoryType === 'csapat' ? 'Csapat' : 'Egyéni'}
          </span>
          {category.time_range && (
            <span className="text-xs text-gray-500">{category.time_range}</span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          Szerek: {(category.apparatuses || []).length === 0 
            ? <span className="italic">— nincs megadva —</span>
            : (category.apparatuses || []).map(a => APPARATUS_LABELS[a] || a).join(', ')}
        </div>
      </div>
      
      <div className="flex gap-1">
        <SecondaryButton onClick={() => onOpenStartlist && onOpenStartlist(category)}>
          <UsersIcon className="w-4 h-4" /> Startlista
        </SecondaryButton>
        {canManage && (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}

function NewCategoryForm({ dayId, dayType, supabase, onCancel, onSaved }) {
  const [form, setForm] = useState({
    kategoria: 'VSK II',
    korosztaly: 'serdülő',
    type: dayType || 'egyeni',
    apparatuses: [],
    time_range: ''
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
          type: form.type,
          apparatuses: form.apparatuses,
          time_range: form.time_range.trim() || null
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
      
      <div className="grid grid-cols-2 gap-2">
        <Field label="Típus">
          <Select
            value={form.type}
            onChange={(e) => setForm({...form, type: e.target.value})}
          >
            <option value="egyeni">Egyéni</option>
            <option value="csapat">Csapat</option>
          </Select>
        </Field>
        <Field label="Időablak (opcionális)" hint="pl. 10:00–12:25">
          <Input
            type="text"
            value={form.time_range}
            onChange={(e) => setForm({...form, time_range: e.target.value})}
            placeholder="10:00–12:25"
          />
        </Field>
      </div>
      
      <Field label={form.type === 'csapat' ? 'Csapatgyakorlat (1 vagy 2)' : 'Szerek (válaszd ki amivel mennek)'}>
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
    type: category.type || dayType || 'egyeni',
    apparatuses: category.apparatuses || [],
    time_range: category.time_range || ''
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
          type: form.type,
          apparatuses: form.apparatuses,
          time_range: form.time_range.trim() || null
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
      
      <div className="grid grid-cols-2 gap-2">
        <Field label="Típus">
          <Select
            value={form.type}
            onChange={(e) => setForm({...form, type: e.target.value})}
          >
            <option value="egyeni">Egyéni</option>
            <option value="csapat">Csapat</option>
          </Select>
        </Field>
        <Field label="Időablak (opcionális)">
          <Input
            type="text"
            value={form.time_range}
            onChange={(e) => setForm({...form, time_range: e.target.value})}
            placeholder="10:00–12:25"
          />
        </Field>
      </div>
      
      <Field label={form.type === 'csapat' ? 'Csapatgyakorlat (1 vagy 2)' : 'Szerek'}>
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

// ═══════════════════════════════════════════════════════════════════
// STARTLIST VIEW (egy kategória startlistája)
// ═══════════════════════════════════════════════════════════════════

function StartlistView({ supabase, category, competitionId, canManage, userRole, onClose }) {
  const [entries, setEntries] = useState(null);
  const [competitors, setCompetitors] = useState([]);
  const [error, setError] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);  // null | 'new' | entry
  const [viewMode, setViewMode] = useState('startlist');  // 'startlist' | 'scoring'
  
  const isTeam = category.type === 'csapat';
  
  const load = useCallback(async () => {
    try {
      // Egyéni startlista
      const { data, error } = await supabase
        .from('startlist_entries')
        .select(`
          id, start_order, competitor_id, external_name, external_club, 
          apparatus, team_id, performance_number, snapshot_kategoria, snapshot_korosztaly,
          competitor:competitors(id, full_name, nickname, kategoria, korosztaly, birth_year)
        `)
        .eq('competition_category_id', category.id)
        .order('start_order');
      if (error) throw error;
      setEntries(data || []);
      
      // Klubtagok listája (válaszható csepeli versenyzők)
      const { data: comps } = await supabase
        .from('competitors')
        .select('id, full_name, nickname, kategoria, korosztaly, birth_year')
        .eq('is_active', true)
        .eq('is_club_member', true)
        .order('full_name');
      setCompetitors(comps || []);
    } catch (err) {
      setError('Startlista betöltése sikertelen: ' + err.message);
      setEntries([]);
    }
  }, [supabase, category.id]);
  
  useEffect(() => { load(); }, [load]);
  
  const removeEntry = async (entryId) => {
    if (!window.confirm('Biztos törlöd ezt a sort?')) return;
    try {
      // v0.9.50: ha csapat-sor, a kapcsolt csapatot és tagjait is takarítjuk,
      // hogy ne maradjon árva competition_teams rekord
      const target = (entries || []).find(e => e.id === entryId);
      await supabase.from('startlist_entries').delete().eq('id', entryId);
      if (target && target.team_id) {
        await supabase.from('competition_team_members').delete().eq('team_id', target.team_id);
        await supabase.from('competition_teams').delete().eq('id', target.team_id);
      }
      load();
    } catch (err) {
      alert('Törlés sikertelen: ' + err.message);
    }
  };
  
  if (editingEntry !== null) {
    return (
      <StartlistEntryForm
        supabase={supabase}
        competitionCategoryId={category.id}
        competitionId={competitionId}
        category={category}
        entry={editingEntry === 'new' ? null : editingEntry}
        competitors={competitors}
        existingEntries={entries || []}
        onCancel={() => setEditingEntry(null)}
        onSaved={() => { setEditingEntry(null); load(); }}
      />
    );
  }
  
  const csepeliCount = (entries || []).filter(e => e.competitor_id).length;
  const externalCount = (entries || []).filter(e => !e.competitor_id).length;
  
  // Ha pontozás módban vagyunk, mutassuk a ScoringView-t
  // (v0.9.49: csapat-kategóriáknál is engedélyezve — a csapat mint induló
  //  ugyanúgy pontozható D/A/E/P-vel, mint egy egyéni versenyző)
  if (viewMode === 'scoring') {
    return (
      <ScoringView
        supabase={supabase}
        userRole={userRole}
        category={category}
        onBack={() => setViewMode('startlist')}
        onChange={() => load()}
      />
    );
  }
  
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate" style={{ color: COLORS.blueDark }}>
            Startlista: {category.kategoria} · {category.korosztaly}
          </h3>
          <div className="text-xs text-gray-500 flex flex-wrap gap-x-3">
            <span>{isTeam ? 'Csapat' : 'Egyéni'}</span>
            {category.time_range && <span>{category.time_range}</span>}
            <span>Szerek: {(category.apparatuses || []).map(a => APPARATUS_LABELS[a] || a).join(', ') || '—'}</span>
          </div>
        </div>
        {entries && entries.length > 0 && (
          <button
            onClick={() => setViewMode('scoring')}
            className="px-3 py-2 rounded text-white font-medium text-sm flex items-center gap-2"
            style={{ backgroundColor: COLORS.blue }}
          >
            <Trophy className="w-4 h-4" />
            {/* v0.9.37: szülő AKTÍV versenyen pontozhat; a scoring.jsx canEdit
               logikája gondoskodik arról hogy lezárt versenynél már csak edző tud
               módosítani. Versenyző mindig csak nézi. */}
            {userRole === 'versenyzo' ? 'Eredmények' : 'Pontozás'}
          </button>
        )}
      </div>
      
      <ErrorBox>{error}</ErrorBox>
      
      {entries === null ? (
        <div className="text-center py-8">
          <Loader className="w-6 h-6 animate-spin mx-auto text-gray-400" />
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500 mb-3">
          Még nincs startlistasor.
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden mb-3" style={{ borderColor: COLORS.gray200 }}>
          <div className="bg-gray-50 px-3 py-2 text-xs text-gray-600 flex justify-between">
            <span>{entries.length} sor</span>
            <span>{csepeliCount} csepeli · {externalCount} külsős</span>
          </div>
          <div className="divide-y" style={{ borderColor: COLORS.gray200 }}>
            {entries.map(entry => (
              <StartlistRow
                key={entry.id}
                entry={entry}
                canManage={canManage}
                onEdit={() => setEditingEntry(entry)}
                onRemove={() => removeEntry(entry.id)}
              />
            ))}
          </div>
        </div>
      )}
      
      {canManage && (
        <PrimaryButton onClick={() => setEditingEntry('new')}>
          <Plus className="w-4 h-4" /> Új sor
        </PrimaryButton>
      )}
      
    </div>
  );
}

function StartlistRow({ entry, canManage, onEdit, onRemove }) {
  const isCsepeli = !!entry.competitor_id;
  const competitor = entry.competitor;
  
  // Név formázás (becenévvel)
  const displayName = competitor 
    ? (competitor.nickname 
        ? `${competitor.full_name.split(' ')[0]} "${competitor.nickname}" ${competitor.full_name.split(' ').slice(1).join(' ')}`
        : competitor.full_name)
    : entry.external_name;
  
  const club = isCsepeli ? 'Csepeli RG Club' : (entry.external_club || '');
  const apparatus = entry.apparatus 
    ? entry.apparatus.split('+').map(a => APPARATUS_LABELS[a.trim()] || a.trim()).join(' + ')
    : <span className="italic text-gray-500">Választott</span>;
  
  return (
    <div 
      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50"
      style={{ backgroundColor: isCsepeli ? COLORS.redLight : 'white' }}
    >
      <div className="w-8 text-right text-sm font-semibold flex-shrink-0" style={{ color: COLORS.gray700 }}>
        {entry.start_order}.
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          {isCsepeli && <span style={{ color: COLORS.red }}>★</span>}
          <span className={`text-sm truncate ${isCsepeli ? 'font-semibold' : ''}`} style={{ color: COLORS.blueDark }}>
            {displayName}
          </span>
          {entry.performance_number && (
            <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: COLORS.blueBg, color: COLORS.blue }}>
              {entry.performance_number}. bem.
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 truncate">
          {club}
        </div>
      </div>
      <div className="text-sm flex-shrink-0">
        {apparatus}
      </div>
      {canManage && (
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
            title="Szerkesztés"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 hover:bg-red-100 rounded text-red-600"
            title="Törlés"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function StartlistEntryForm({ supabase, competitionCategoryId, competitionId, category, entry, competitors, existingEntries, onCancel, onSaved }) {
  const isNew = !entry;
  const isTeam = category.type === 'csapat';
  // v0.9.50: csapat-mód állapot — kipipált szerek (tömb) és kipipált tagok (competitor id-k)
  const [teamApparatuses, setTeamApparatuses] = useState(() => {
    if (entry && entry.apparatus) return entry.apparatus.split('+').map(s => s.trim()).filter(Boolean);
    return [];
  });
  const [teamMemberIds, setTeamMemberIds] = useState([]);
  const [form, setForm] = useState(() => {
    if (entry) {
      return {
        start_order: entry.start_order,
        is_csepeli: !!entry.competitor_id,
        competitor_id: entry.competitor_id || '',
        external_name: entry.external_name || '',
        external_club: entry.external_club || '',
        apparatus: entry.apparatus || ''
      };
    }
    // Új: következő sorszám
    const maxOrder = existingEntries.reduce((m, e) => Math.max(m, e.start_order), 0);
    return {
      start_order: maxOrder + 1,
      is_csepeli: true,
      competitor_id: '',
      external_name: '',
      external_club: '',
      apparatus: category.apparatuses?.[0] || ''
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // v0.9.50: meglévő csapat-sor szerkesztésekor betöltjük a tagokat
  useEffect(() => {
    if (!isTeam || !entry || !entry.team_id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('competition_team_members')
        .select('competitor_id')
        .eq('team_id', entry.team_id);
      if (!cancelled && data) setTeamMemberIds(data.map(m => m.competitor_id));
    })();
    return () => { cancelled = true; };
  }, [supabase, isTeam, entry]);
  
  const save = async () => {
    setError(null);
    if (!form.start_order || form.start_order < 1) {
      setError('Sorszám kötelező és pozitív kell legyen');
      return;
    }
    // v0.9.50 (3b): csapat-mód mentés
    if (isTeam) {
      if (!form.external_name.trim()) {
        setError('Csapatnév kötelező');
        return;
      }
      setSaving(true);
      try {
        const apparatusStr = teamApparatuses.length > 0 ? teamApparatuses.join('+') : null;
        let teamId = entry?.team_id || null;

        // 1. competition_teams: létrehozás vagy frissítés
        if (teamId) {
          const { error: tErr } = await supabase
            .from('competition_teams')
            .update({ name: form.external_name.trim(), age_range: category.korosztaly || null })
            .eq('id', teamId);
          if (tErr) throw new Error('Csapat frissítése: ' + tErr.message);
        } else {
          const { data: tData, error: tErr } = await supabase
            .from('competition_teams')
            .insert({
              competition_id: competitionId,
              name: form.external_name.trim(),
              age_range: category.korosztaly || null
            })
            .select('id')
            .single();
          if (tErr) throw new Error('Csapat létrehozása: ' + tErr.message);
          teamId = tData.id;
        }

        // 2. startlist_entries: a csapat mint induló-sor
        const payload = {
          competition_category_id: competitionCategoryId,
          start_order: form.start_order,
          competitor_id: null,
          external_name: form.external_name.trim(),
          external_club: form.external_club.trim() || null,
          apparatus: apparatusStr,
          team_id: teamId,
          performance_number: entry?.performance_number ?? null
        };
        if (isNew) {
          const { error: sErr } = await supabase.from('startlist_entries').insert(payload);
          if (sErr) throw new Error('Startlista sor: ' + sErr.message);
        } else {
          const { error: sErr } = await supabase
            .from('startlist_entries').update(payload).eq('id', entry.id);
          if (sErr) throw new Error('Startlista sor: ' + sErr.message);
        }

        // 3. competition_team_members: tagság frissítése (régi törlés → új beírás)
        const { error: dErr } = await supabase
          .from('competition_team_members').delete().eq('team_id', teamId);
        if (dErr) throw new Error('Régi tagság törlése: ' + dErr.message);
        if (teamMemberIds.length > 0) {
          const memberRows = teamMemberIds.map(cid => ({ team_id: teamId, competitor_id: cid }));
          const { error: mErr } = await supabase
            .from('competition_team_members').insert(memberRows);
          if (mErr) throw new Error('Tagok mentése: ' + mErr.message);
        }

        // 4. v0.9.50: a szer ÉS a csapatnév/klub öröklődik a csapat MINDEN bemutatására
        //    (azonos team_id-jű sorok). A tagok a közös team_id miatt automatikusan közösek.
        const { error: aErr } = await supabase
          .from('startlist_entries')
          .update({
            apparatus: apparatusStr,
            external_name: form.external_name.trim(),
            external_club: form.external_club.trim() || null
          })
          .eq('team_id', teamId);
        if (aErr) throw new Error('Csapatadatok terjesztése: ' + aErr.message);

        onSaved();
      } catch (err) {
        setError('Mentés sikertelen: ' + err.message);
        setSaving(false);
      }
      return;
    }
    if (form.is_csepeli && !form.competitor_id) {
      setError('Válassz csepeli versenyzőt');
      return;
    }
    if (!form.is_csepeli && !form.external_name.trim()) {
      setError('Külsős versenyző neve kötelező');
      return;
    }
    
    setSaving(true);
    try {
      const payload = {
        competition_category_id: competitionCategoryId,
        start_order: form.start_order,
        competitor_id: form.is_csepeli ? form.competitor_id : null,
        external_name: form.is_csepeli ? null : form.external_name.trim(),
        external_club: form.is_csepeli ? null : (form.external_club.trim() || null),
        apparatus: form.apparatus || null
      };
      
      if (isNew) {
        const { error } = await supabase.from('startlist_entries').insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('startlist_entries')
          .update(payload)
          .eq('id', entry.id);
        if (error) throw error;
      }
      
      onSaved();
    } catch (err) {
      setError('Mentés sikertelen: ' + err.message);
      setSaving(false);
    }
  };
  
  return (
    <div className="bg-white border rounded-lg p-4" style={{ borderColor: COLORS.gray200 }}>
      <div className="flex items-center gap-2 mb-3">
        <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h4 className="font-semibold" style={{ color: COLORS.blueDark }}>
          {isNew ? 'Új sor' : 'Sor szerkesztése'}
        </h4>
      </div>
      
      <div className="space-y-3">
        <Field label="Sorszám *">
          <Input
            type="number"
            min="1"
            value={form.start_order}
            onChange={(e) => setForm({...form, start_order: parseInt(e.target.value) || 1})}
          />
        </Field>
        
        {isTeam && (
          <>
            <Field label="Csapatnév *">
              <Input
                type="text"
                value={form.external_name}
                onChange={(e) => setForm({...form, external_name: e.target.value})}
                placeholder="pl. Csepel A"
              />
            </Field>
            
            <Field label="Klub">
              <Input
                type="text"
                value={form.external_club}
                onChange={(e) => setForm({...form, external_club: e.target.value})}
                placeholder="pl. Csepeli RG Klub"
              />
            </Field>
            
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Szerek (több is választható)</div>
              <div className="grid grid-cols-2 gap-2">
                {APPARATUS_OPTIONS.map(opt => {
                  const checked = teamApparatuses.includes(opt.value);
                  return (
                    <label
                      key={opt.value}
                      className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm cursor-pointer"
                      style={{
                        borderColor: checked ? COLORS.blue : COLORS.gray200,
                        backgroundColor: checked ? COLORS.blueBg : 'white'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setTeamApparatuses(prev =>
                          prev.includes(opt.value)
                            ? prev.filter(x => x !== opt.value)
                            : [...prev, opt.value]
                        )}
                      />
                      {opt.label}
                    </label>
                  );
                })}
              </div>
              {teamApparatuses.length > 0 && (
                <div className="mt-2 text-xs text-gray-500">
                  Kiválasztott: {teamApparatuses.map(a => APPARATUS_LABELS[a] || a).join(' + ')}
                </div>
              )}
            </div>
            
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">
                Csapattagok ({teamMemberIds.length} kiválasztva)
              </div>
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto" style={{ borderColor: COLORS.gray200 }}>
                {competitors.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500">Nincs választható klubtag.</div>
                ) : competitors.map(c => {
                  const checked = teamMemberIds.includes(c.id);
                  return (
                    <label key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setTeamMemberIds(prev =>
                          prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id]
                        )}
                      />
                      <span>
                        {c.nickname ? `${c.full_name} ("${c.nickname}")` : c.full_name}
                        <span className="text-gray-400"> · {c.kategoria} {c.korosztaly}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </>
        )}
        
        {!isTeam && (
        <>
        <div>
          <div className="text-sm font-medium text-gray-700 mb-2">Versenyző</div>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => setForm({...form, is_csepeli: true})}
              className="flex-1 px-3 py-2 border rounded-lg text-sm font-medium"
              style={{
                borderColor: form.is_csepeli ? COLORS.blue : COLORS.gray200,
                backgroundColor: form.is_csepeli ? COLORS.blueBg : 'white',
                color: form.is_csepeli ? COLORS.blue : COLORS.gray700
              }}
            >
              ★ Csepeli
            </button>
            <button
              type="button"
              onClick={() => setForm({...form, is_csepeli: false})}
              className="flex-1 px-3 py-2 border rounded-lg text-sm font-medium"
              style={{
                borderColor: !form.is_csepeli ? COLORS.blue : COLORS.gray200,
                backgroundColor: !form.is_csepeli ? COLORS.blueBg : 'white',
                color: !form.is_csepeli ? COLORS.blue : COLORS.gray700
              }}
            >
              Külsős
            </button>
          </div>
          
          {form.is_csepeli ? (
            <Select
              value={form.competitor_id}
              onChange={(e) => setForm({...form, competitor_id: e.target.value})}
            >
              <option value="">— válassz versenyzőt —</option>
              {competitors.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nickname ? `${c.full_name} ("${c.nickname}")` : c.full_name} 
                  {' · '}{c.kategoria} {c.korosztaly}
                </option>
              ))}
            </Select>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              <Input
                type="text"
                value={form.external_name}
                onChange={(e) => setForm({...form, external_name: e.target.value})}
                placeholder="Külsős versenyző neve"
              />
              <Input
                type="text"
                value={form.external_club}
                onChange={(e) => setForm({...form, external_club: e.target.value})}
                placeholder="Klub neve (pl. MTK Budapest)"
              />
            </div>
          )}
        </div>
        
        <Field label="Szer" hint="Üres = 'Választott' (pontozáskor derül ki)">
          <Select
            value={form.apparatus}
            onChange={(e) => setForm({...form, apparatus: e.target.value})}
          >
            <option value="">— Választott (üres) —</option>
            {APPARATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </Field>
        </>
        )}
        
        <ErrorBox>{error}</ErrorBox>
        
        <div className="flex gap-2">
          <PrimaryButton onClick={save} disabled={saving}>
            {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Mentés
          </PrimaryButton>
          <SecondaryButton onClick={onCancel}>Mégse</SecondaryButton>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// JSON IMPORT VIEW
// ═══════════════════════════════════════════════════════════════════

// Levenshtein távolság (egyszerű implementáció)
function levenshtein(a, b) {
  if (!a || !b) return Math.max(a?.length || 0, b?.length || 0);
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
      else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

// Versenyző párosítás logikája:
//   1. Pontos egyezés a full_name-mel ('exact')
//   2. Nickname egyezés ('nickname')
//   3. Részleges: vezetéknév + keresztnév első szó egyezés ('partial')
//   4. Levenshtein távolság ≤ 2 (apró elírás) → 'suggestion'
//   5. Egyébként 'none'
function matchCsepeliCompetitor(sourceName, allCompetitors) {
  const sourceLower = sourceName.toLowerCase().trim();
  const sourceTokens = sourceLower.split(/\s+/).filter(t => t.length > 1);
  
  // 1. Pontos egyezés full_name-mel
  for (const c of allCompetitors) {
    if (c.full_name.toLowerCase().trim() === sourceLower) {
      return { status: 'exact', competitor: c };
    }
  }
  
  // 2. Nickname egyezés (ha van nickname)
  for (const c of allCompetitors) {
    if (c.nickname && c.full_name) {
      // pl. full_name='Völgyesi Noémi', nickname='Ori' → keressük 'Völgyesi Ori'-t is
      const fnTokens = c.full_name.toLowerCase().split(/\s+/).filter(t => t.length > 1);
      const surname = fnTokens[0];
      if (sourceTokens.includes(surname) && sourceTokens.includes(c.nickname.toLowerCase())) {
        return { status: 'nickname', competitor: c };
      }
    }
  }
  
  // 3. Részleges egyezés: vezetéknév + keresztnév első szó
  // pl. forrás: "Völgyesi Petra Anna", DB: "Völgyesi Petra"
  // pl. forrás: "Völgyesi N.", DB: "Völgyesi Noémi"  → első betű egyezés
  for (const c of allCompetitors) {
    const dbTokens = c.full_name.toLowerCase().split(/\s+/).filter(t => t.length > 1);
    if (sourceTokens.length < 2 || dbTokens.length < 2) continue;
    
    // Vezetéknév pontos egyezés
    if (sourceTokens[0] !== dbTokens[0]) continue;
    
    // Keresztnév első szó: vagy pontos egyezés, vagy az egyik kezdődik a másikkal
    const sourceFirstName = sourceTokens[1].replace(/\.$/, ''); // ha "n." akkor "n"
    const dbFirstName = dbTokens[1];
    
    if (sourceFirstName === dbFirstName) {
      return { status: 'partial', competitor: c };
    }
    if (sourceFirstName.length === 1 && dbFirstName.startsWith(sourceFirstName)) {
      // pl. "n." → "noémi"
      return { status: 'partial', competitor: c };
    }
    if (dbFirstName.startsWith(sourceFirstName) || sourceFirstName.startsWith(dbFirstName)) {
      return { status: 'partial', competitor: c };
    }
  }
  
  // 4. Levenshtein ≤ 2: ajánlat
  const suggestions = [];
  for (const c of allCompetitors) {
    const dist = levenshtein(c.full_name.toLowerCase().trim(), sourceLower);
    if (dist > 0 && dist <= 2) {
      suggestions.push({ competitor: c, distance: dist });
    }
  }
  if (suggestions.length > 0) {
    suggestions.sort((a, b) => a.distance - b.distance);
    return {
      status: 'suggestion',
      competitor: null,
      suggestions: suggestions.slice(0, 3).map(s => s.competitor)
    };
  }
  
  return { status: 'none', competitor: null };
}

// Csepeli versenyzők egyezésének listája az importálás előtt
// Lehet módosítani a hozzárendeléseket
function CsepeliMatchList({ validationResult, allCompetitors, manualOverrides, setManualOverrides, supabase, onCompetitorAdded }) {
  const [newCompetitorFor, setNewCompetitorFor] = useState(null);  // string sourceName ha modal nyitva
  const matches = validationResult.unique_matches || [];
  
  if (matches.length === 0) {
    return (
      <div className="p-3 bg-gray-50 border rounded text-sm text-gray-600">
        Nincsenek csepeli versenyzők a startlistán.
      </div>
    );
  }
  
  // Csoportosítás státusz szerint
  const exactMatches = matches.filter(m => m.match_status === 'exact');
  const partialMatches = matches.filter(m => m.match_status === 'partial' || m.match_status === 'nickname');
  const suggestions = matches.filter(m => m.match_status === 'suggestion');
  const unmatched = matches.filter(m => m.match_status === 'none');
  
  // A felhasználó manuálisan elfogadta vagy módosította
  const overrideKeys = Object.keys(manualOverrides).filter(k => manualOverrides[k]);
  
  const setOverride = (sourceName, competitorId) => {
    setManualOverrides(prev => {
      const next = { ...prev };
      if (competitorId === '_external') {
        // Külsősként akarjuk
        delete next[sourceName];
      } else if (competitorId) {
        next[sourceName] = competitorId;
      } else {
        delete next[sourceName];
      }
      return next;
    });
  };
  
  // Új csepeli versenyző létrejött
  const handleCompetitorCreated = (newCompetitor, sourceName) => {
    // Hozzáadjuk az allCompetitors-hoz (a parent komponens dolga)
    onCompetitorAdded(newCompetitor);
    // Beállítjuk a manualOverrides-ban
    setManualOverrides(prev => ({ ...prev, [sourceName]: newCompetitor.id }));
    // Bezárjuk a modalt
    setNewCompetitorFor(null);
  };
  
  return (
    <div className="border rounded-lg overflow-hidden" style={{ borderColor: COLORS.gray200 }}>
      <div className="p-3 bg-gray-50 border-b font-medium text-sm flex items-center justify-between" 
           style={{ borderColor: COLORS.gray200, color: COLORS.blueDark }}>
        <span>★ Csepeli versenyzők azonosítása ({matches.length} név)</span>
        <span className="text-xs font-normal text-gray-600">
          ✓ {overrideKeys.length} társítva · ⚠ {matches.length - overrideKeys.length} külsős
        </span>
      </div>
      
      <div className="max-h-96 overflow-y-auto">
        {/* Pontos egyezés - automatikusan elfogadva */}
        {exactMatches.length > 0 && (
          <div>
            <div className="px-3 py-1 bg-green-50 text-xs font-medium text-green-800 border-b" style={{ borderColor: COLORS.gray200 }}>
              ✓ Pontos egyezés ({exactMatches.length})
            </div>
            {exactMatches.map(m => (
              <CsepeliMatchRow
                key={m.source_name}
                match={m}
                allCompetitors={allCompetitors}
                currentValue={manualOverrides[m.source_name] || '_external'}
                onChange={(v) => setOverride(m.source_name, v)}
                onCreateNew={() => setNewCompetitorFor(m.source_name)}
                badgeColor="green"
              />
            ))}
          </div>
        )}
        
        {/* Részleges egyezés / nickname */}
        {partialMatches.length > 0 && (
          <div>
            <div className="px-3 py-1 bg-blue-50 text-xs font-medium text-blue-800 border-b" style={{ borderColor: COLORS.gray200 }}>
              ✓ Részleges egyezés ({partialMatches.length}) — automatikusan társítva, ellenőrizd
            </div>
            {partialMatches.map(m => (
              <CsepeliMatchRow
                key={m.source_name}
                match={m}
                allCompetitors={allCompetitors}
                currentValue={manualOverrides[m.source_name] || '_external'}
                onChange={(v) => setOverride(m.source_name, v)}
                onCreateNew={() => setNewCompetitorFor(m.source_name)}
                badgeColor="blue"
              />
            ))}
          </div>
        )}
        
        {/* Ajánlatok - JÓVÁHAGYÁS SZÜKSÉGES */}
        {suggestions.length > 0 && (
          <div>
            <div className="px-3 py-1 bg-amber-50 text-xs font-medium text-amber-800 border-b" style={{ borderColor: COLORS.gray200 }}>
              ⚠ Ajánlat ({suggestions.length}) — kérlek hagyd jóvá
            </div>
            {suggestions.map(m => (
              <CsepeliMatchRow
                key={m.source_name}
                match={m}
                allCompetitors={allCompetitors}
                currentValue={manualOverrides[m.source_name] || '_external'}
                onChange={(v) => setOverride(m.source_name, v)}
                onCreateNew={() => setNewCompetitorFor(m.source_name)}
                badgeColor="amber"
              />
            ))}
          </div>
        )}
        
        {/* Nem találtak */}
        {unmatched.length > 0 && (
          <div>
            <div className="px-3 py-1 bg-red-50 text-xs font-medium text-red-800 border-b" style={{ borderColor: COLORS.gray200 }}>
              ❌ Nem találtak ({unmatched.length}) — válassz ki egyet vagy hagyd külsősként
            </div>
            {unmatched.map(m => (
              <CsepeliMatchRow
                key={m.source_name}
                match={m}
                allCompetitors={allCompetitors}
                currentValue={manualOverrides[m.source_name] || '_external'}
                onChange={(v) => setOverride(m.source_name, v)}
                onCreateNew={() => setNewCompetitorFor(m.source_name)}
                badgeColor="red"
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Új csepeli versenyző modal */}
      {newCompetitorFor && (
        <NewCsepeliCompetitorModal
          sourceName={newCompetitorFor}
          supabase={supabase}
          onClose={() => setNewCompetitorFor(null)}
          onCreated={(newCompetitor) => handleCompetitorCreated(newCompetitor, newCompetitorFor)}
        />
      )}
    </div>
  );
}

// Új csepeli versenyző gyors-modal (importálás közben)
function NewCsepeliCompetitorModal({ sourceName, supabase, onClose, onCreated }) {
  const [form, setForm] = useState({
    full_name: sourceName,
    kategoria: 'VSK II',
    korosztaly: 'serdülő',
    birth_year: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  const save = async () => {
    setError(null);
    if (!form.full_name.trim()) {
      setError('A teljes név kötelező');
      return;
    }
    if (!form.birth_year) {
      setError('A születési év kötelező');
      return;
    }
    const yearNum = parseInt(form.birth_year);
    if (isNaN(yearNum) || yearNum < 1990 || yearNum > 2025) {
      setError('Érvényes születési év: 1990–2025 között');
      return;
    }
    
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('competitors')
        .insert({
          full_name: form.full_name.trim(),
          kategoria: form.kategoria,
          korosztaly: form.korosztaly,
          birth_year: yearNum,
          is_provisional: true,
          is_active: true
        })
        .select()
        .single();
      if (error) throw error;
      onCreated(data);
    } catch (err) {
      setError('Mentés sikertelen: ' + err.message);
      setSaving(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: COLORS.blueDark }}>
            <UserPlus className="w-5 h-5" />
            Új csepeli versenyző
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-3 text-xs text-amber-900">
          ⚠ Ez egy ideiglenes profil lesz. Admin/edző később ellenőrzi és véglegesíti.
        </div>
        
        <div className="space-y-3">
          <Field label="Teljes név *">
            <Input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm({...form, full_name: e.target.value})}
              placeholder="pl. Tóth Vivien"
            />
          </Field>
          
          <div className="grid grid-cols-2 gap-2">
            <Field label="Kategória *">
              <Select
                value={form.kategoria}
                onChange={(e) => setForm({...form, kategoria: e.target.value})}
              >
                {KATEGORIA_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
              </Select>
            </Field>
            <Field label="Korosztály *">
              <Select
                value={form.korosztaly}
                onChange={(e) => setForm({...form, korosztaly: e.target.value})}
              >
                {KOROSZTALY_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
              </Select>
            </Field>
          </div>
          
          <Field label="Születési év *">
            <Input
              type="number"
              value={form.birth_year}
              onChange={(e) => setForm({...form, birth_year: e.target.value})}
              placeholder="pl. 2010"
              min="1990"
              max="2025"
            />
          </Field>
        </div>
        
        <ErrorBox>{error}</ErrorBox>
        
        <div className="flex gap-2 mt-4">
          <PrimaryButton onClick={save} disabled={saving}>
            {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Létrehozás
          </PrimaryButton>
          <SecondaryButton onClick={onClose}>
            <X className="w-4 h-4" /> Mégse
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}

function CsepeliMatchRow({ match, allCompetitors, currentValue, onChange, onCreateNew, badgeColor }) {
  const colorMap = {
    green: { bg: '#f0fdf4', text: '#166534' },
    blue: { bg: '#eff6ff', text: '#1e40af' },
    amber: { bg: '#fef3c7', text: '#92400e' },
    red: { bg: '#fef2f2', text: '#991b1b' }
  };
  const colors = colorMap[badgeColor];
  
  return (
    <div className="px-3 py-2 border-b flex items-center gap-2 flex-wrap" style={{ borderColor: COLORS.gray200 }}>
      <div className="flex-1 min-w-[200px]">
        <div className="text-sm font-medium">{match.source_name}</div>
        {match.match_status === 'exact' && (
          <div className="text-xs text-green-700">
            → {match.matched_competitor.full_name}
          </div>
        )}
        {(match.match_status === 'partial' || match.match_status === 'nickname') && (
          <div className="text-xs text-blue-700">
            → {match.matched_competitor.full_name}
            {match.match_status === 'nickname' && match.matched_competitor.nickname && ` ("${match.matched_competitor.nickname}")`}
          </div>
        )}
        {match.match_status === 'suggestion' && match.suggestions.length > 0 && (
          <div className="text-xs text-amber-700">
            Talán: {match.suggestions.map(s => s.full_name).join(', ')}?
          </div>
        )}
        {match.match_status === 'none' && (
          <div className="text-xs text-red-700">
            Nincs egyezés
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-1">
        <select
          value={currentValue}
          onChange={(e) => onChange(e.target.value)}
          className="px-2 py-1 border rounded text-xs"
          style={{ borderColor: COLORS.gray200, backgroundColor: 'white', minWidth: 200 }}
        >
          <option value="_external">— Külsősként —</option>
          {allCompetitors.map(c => (
            <option key={c.id} value={c.id}>
              {c.full_name}
              {c.nickname ? ` ("${c.nickname}")` : ''}
              {c.is_provisional ? ' ⚠' : ''}
              {c.kategoria ? ` · ${c.kategoria} ${c.korosztaly || ''}` : ''}
            </option>
          ))}
        </select>
        {onCreateNew && (
          <button
            onClick={onCreateNew}
            className="p-1.5 hover:bg-blue-50 rounded border text-blue-700"
            style={{ borderColor: COLORS.gray200 }}
            title="Új csepeli versenyző létrehozása"
          >
            <UserPlus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function JsonImportView({ supabase, onClose, onImported, existingCompetition = null }) {
  const [jsonText, setJsonText] = useState('');
  const [parsed, setParsed] = useState(null);  // null | object - parsed JSON
  const [parseError, setParseError] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [allCompetitors, setAllCompetitors] = useState([]);
  // Felhasználói felülbírálás: { source_name: competitor_id | null (=külsős) }
  const [manualOverrides, setManualOverrides] = useState({});
  
  useEffect(() => {
    supabase
      .from('competitors')
      .select('id, full_name, nickname, kategoria, korosztaly, is_active, is_club_member')
      .eq('is_club_member', true)
      .then(({ data }) => setAllCompetitors(data || []));
  }, [supabase]);
  
  // Fájl beolvasás
  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setJsonText(e.target.result);
      tryParse(e.target.result);
    };
    reader.readAsText(file);
  };
  
  const tryParse = (text) => {
    setParseError(null);
    setValidationResult(null);
    setParsed(null);
    
    if (!text.trim()) return;
    
    try {
      const data = JSON.parse(text);
      
      // Alap-validáció
      if (!data.competition || !data.competition.name) {
        throw new Error('Hiányzik a "competition.name" mező');
      }
      if (!data.competition.start_date) {
        throw new Error('Hiányzik a "competition.start_date" mező');
      }
      if (!data.competition.importance) {
        throw new Error('Hiányzik a "competition.importance" mező');
      }
      if (!Array.isArray(data.days) || data.days.length === 0) {
        throw new Error('A "days" tömb üres vagy hiányzik');
      }
      
      // Csepeli versenyzők azonosítása (név alapján, fuzzy match-szel)
      // Egy egyedi rekord minden EGYES csepeli sorhoz
      // (mert egy versenyző többször szerepelhet különböző szerekkel)
      const csepeliEntries = [];  // { source_name, source_club, day_idx, cat_idx, entry_idx, match_status, matched_competitor }
      
      data.days.forEach((day, dayIdx) => {
        (day.categories || []).forEach((cat, catIdx) => {
          (cat.startlist || []).forEach((s, entryIdx) => {
            const club = (s.club || '').toLowerCase().trim();
            const isCsepeli = club.includes('csepel') || club === 'csepeli rg club' || club === 'csepel sc';
            
            if (isCsepeli) {
              const sourceName = s.name.trim();
              const matchResult = matchCsepeliCompetitor(sourceName, allCompetitors);
              csepeliEntries.push({
                source_name: sourceName,
                source_club: s.club,
                day_idx: dayIdx,
                cat_idx: catIdx,
                entry_idx: entryIdx,
                match_status: matchResult.status,  // 'exact' | 'nickname' | 'partial' | 'suggestion' | 'none'
                matched_competitor: matchResult.competitor,
                suggestions: matchResult.suggestions || []
              });
            }
          });
        });
      });
      
      // Csoportosítás egyedi nevek szerint (mert lehetnek duplikátumok)
      const uniqueNames = new Map();
      csepeliEntries.forEach(ce => {
        if (!uniqueNames.has(ce.source_name)) {
          uniqueNames.set(ce.source_name, ce);
        }
      });
      const uniqueCsepeliMatches = Array.from(uniqueNames.values());
      
      const matchedCount = uniqueCsepeliMatches.filter(m => m.match_status === 'exact' || m.match_status === 'nickname' || m.match_status === 'partial').length;
      const suggestionCount = uniqueCsepeliMatches.filter(m => m.match_status === 'suggestion').length;
      const unmatchedNames = uniqueCsepeliMatches.filter(m => m.match_status === 'none').map(m => m.source_name);
      
      let totalEntries = 0;
      data.days.forEach(day => {
        (day.categories || []).forEach(cat => {
          totalEntries += (cat.startlist || []).length;
        });
      });
      
      setParsed(data);
      setValidationResult({
        csepeli_matched: matchedCount,
        csepeli_suggestions: suggestionCount,
        csepeli_unmatched: unmatchedNames,
        csepeli_unique_count: uniqueCsepeliMatches.length,
        csepeli_entries: csepeliEntries,
        unique_matches: uniqueCsepeliMatches,
        total_entries: totalEntries,
        days_count: data.days.length,
        categories_count: data.days.reduce((s, d) => s + (d.categories || []).length, 0)
      });
      // Inicializáljuk a manualOverrides-t (ami a felhasználó által módosított hozzárendeléseket tárolja)
      const initialOverrides = {};
      uniqueCsepeliMatches.forEach(m => {
        // Auto-elfogadjuk az exact, nickname, partial találatot
        if (m.matched_competitor && (m.match_status === 'exact' || m.match_status === 'nickname' || m.match_status === 'partial')) {
          initialOverrides[m.source_name] = m.matched_competitor.id;
        }
        // A 'suggestion' státuszúakat NEM rakjuk auto-be (ott a felhasználónak kell jóváhagyni)
      });
      setManualOverrides(initialOverrides);
    } catch (err) {
      setParseError(err.message);
    }
  };
  
  const doImport = async () => {
    if (!parsed) return;
    setImporting(true);
    setImportError(null);
    
    try {
      // 1. venue
      let venueId = null;
      if (parsed.competition.venue) {
        const v = parsed.competition.venue;
        // Próbáljuk megtalálni azonos név alapján
        const { data: existing } = await supabase
          .from('venues')
          .select('id')
          .eq('name', v.name)
          .maybeSingle();
        
        if (existing) {
          venueId = existing.id;
        } else {
          const { data: created, error } = await supabase
            .from('venues')
            .insert({
              name: v.name,
              city: v.city || null,
              country: v.country || 'Magyarország'
            })
            .select()
            .single();
          if (error) throw error;
          venueId = created.id;
        }
      }
      
      // 2. competition — vagy létrehozzuk újat, vagy a meglévő verseny ID-ját használjuk
      let comp;
      if (existingCompetition) {
        // Meglévő verseny — csak lekérdezzük a friss adatokat
        const { data: existingData, error: fetchErr } = await supabase
          .from('competitions')
          .select('*')
          .eq('id', existingCompetition.id)
          .single();
        if (fetchErr) throw fetchErr;
        comp = existingData;
      } else {
        // Új verseny létrehozása
        const endDate = parsed.competition.end_date || parsed.competition.start_date;
        const { data: newComp, error: compError } = await supabase
          .from('competitions')
          .insert({
            name: parsed.competition.name,
            venue_id: venueId,
            start_date: parsed.competition.start_date,
            end_date: endDate,
            importance: parsed.competition.importance
          })
          .select()
          .single();
        if (compError) throw compError;
        comp = newComp;
      }
      
      // SQL trigger automatikusan létrehozza a competition_days rekordokat (új versenynél)
      // Lekérdezzük őket
      let { data: days } = await supabase
        .from('competition_days')
        .select('*')
        .eq('competition_id', comp.id)
        .order('day_number');
      
      // Ha létező versenyhez adunk, lehet hogy hiányoznak napok (pl. az importált JSON több napos)
      // Ilyenkor hozzáadjuk őket
      if (existingCompetition && days && parsed.days.length > 0) {
        const existingDayNumbers = new Set((days || []).map(d => d.day_number));
        const missingDays = parsed.days.filter(d => !existingDayNumbers.has(d.day_number));
        if (missingDays.length > 0) {
          const newDaysPayload = missingDays.map(d => ({
            competition_id: comp.id,
            day_number: d.day_number,
            date: d.date,
            type: 'egyeni'
          }));
          const { data: insertedDays, error: dayErr } = await supabase
            .from('competition_days')
            .insert(newDaysPayload)
            .select();
          if (dayErr) throw dayErr;
          // Frissítsük a `days` változót
          days = [...(days || []), ...(insertedDays || [])];
        }
      }
      
      // 3. minden napra: kategóriák + startlista
      for (const dayData of parsed.days) {
        // Megfelelő nap a competition_days-ből
        const day = days.find(d => d.day_number === dayData.day_number);
        if (!day) continue;
        
        for (const catData of (dayData.categories || [])) {
          // Kategória létrehozása vagy meglévő használata (importnál meglévő versenyhez)
          let cat;
          if (existingCompetition) {
            // Próbáljuk megtalálni a már létező kategóriát
            const { data: existingCat } = await supabase
              .from('competition_categories')
              .select('*')
              .eq('competition_day_id', day.id)
              .eq('kategoria', catData.kategoria)
              .eq('korosztaly', catData.korosztaly)
              .eq('type', catData.type || 'egyeni')
              .maybeSingle();
            
            if (existingCat) {
              cat = existingCat;
              // Frissítjük az apparatuses-t ha különböző
              if (JSON.stringify((existingCat.apparatuses || []).sort()) !== JSON.stringify((catData.apparatuses || []).sort())) {
                await supabase
                  .from('competition_categories')
                  .update({ apparatuses: catData.apparatuses || [], time_range: catData.time_range || existingCat.time_range })
                  .eq('id', existingCat.id);
              }
            }
          }
          
          if (!cat) {
            const { data: newCat, error: catError } = await supabase
              .from('competition_categories')
              .insert({
                competition_day_id: day.id,
                kategoria: catData.kategoria,
                korosztaly: catData.korosztaly,
                type: catData.type || 'egyeni',
                apparatuses: catData.apparatuses || [],
                time_range: catData.time_range || null
              })
              .select()
              .single();
            if (catError) throw catError;
            cat = newCat;
          }
          
          // Startlista bejegyzések
          const entries = (catData.startlist || []).map(s => {
            const club = (s.club || '').toLowerCase().trim();
            const isCsepeli = club.includes('csepel') || club === 'csepeli rg club' || club === 'csepel sc';
            
            if (isCsepeli) {
              // Először a manualOverrides-ből nézzük (ha a felhasználó beállította)
              const overrideId = manualOverrides[s.name.trim()];
              if (overrideId) {
                return {
                  competition_category_id: cat.id,
                  start_order: s.order,
                  competitor_id: overrideId,
                  external_name: null,
                  external_club: null,
                  apparatus: s.apparatus || null,
                  performance_number: s.performance || null
                };
              }
              // Csepeli de nem rendelt versenyzőhöz: külsősként, "Csepeli RG Club (ismeretlen)"
              return {
                competition_category_id: cat.id,
                start_order: s.order,
                competitor_id: null,
                external_name: s.name,
                external_club: 'Csepeli RG Club (ismeretlen)',
                apparatus: s.apparatus || null,
                performance_number: s.performance || null
              };
            }
            
            return {
              competition_category_id: cat.id,
              start_order: s.order,
              competitor_id: null,
              external_name: s.name,
              external_club: s.club || null,
              apparatus: s.apparatus || null,
              performance_number: s.performance || null
            };
          });
          
          if (entries.length > 0) {
            // v0.9.50: csapat-kategóriánál az azonos nevű sorokat közös csapatra kötjük
            // (a két bemutatás = egy csapat). Csak külsős/csapat sorokra (competitor_id nélkül).
            const isTeamCat = (catData.type || cat.type) === 'csapat';
            if (isTeamCat) {
              const nameToTeamId = {};
              for (const e of entries) {
                if (e.competitor_id) continue; // egyéni-rendelt sort nem kötünk csapatra
                const teamName = (e.external_name || '').trim();
                if (!teamName) continue;
                if (!nameToTeamId[teamName]) {
                  const { data: tData, error: tErr } = await supabase
                    .from('competition_teams')
                    .insert({
                      competition_id: comp.id,
                      name: teamName,
                      age_range: catData.korosztaly || null
                    })
                    .select('id')
                    .single();
                  if (tErr) throw new Error('Csapat létrehozása (' + teamName + '): ' + tErr.message);
                  nameToTeamId[teamName] = tData.id;
                }
                e.team_id = nameToTeamId[teamName];
              }
            }
            
            // Meglévő versenynél: nézzük meg már létezik-e startlista ebben a kategóriában
            if (existingCompetition) {
              const { data: existingEntries } = await supabase
                .from('startlist_entries')
                .select('start_order')
                .eq('competition_category_id', cat.id);
              
              if (existingEntries && existingEntries.length > 0) {
                // Már van bejegyzés — ütközés-elkerülés: a max start_order után írjuk
                const maxOrder = Math.max(...existingEntries.map(e => e.start_order || 0));
                entries.forEach((e, idx) => {
                  e.start_order = maxOrder + idx + 1;
                });
              }
            }
            
            // Batch insert
            const { error: insertError } = await supabase
              .from('startlist_entries')
              .insert(entries);
            if (insertError) throw insertError;
          }
        }
      }
      
      // Sikeres
      onImported(comp);
    } catch (err) {
      setImportError('Importálás sikertelen: ' + err.message);
      setImporting(false);
    }
  };
  
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold flex-1" style={{ color: COLORS.blueDark }}>
          {existingCompetition 
            ? `Startlista importálása JSON-ból — ${existingCompetition.name}` 
            : 'Verseny importálása JSON-ból'}
        </h2>
      </div>
      
      {existingCompetition && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-900">
          <div className="font-semibold mb-1 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Meglévő versenyhez fűzöd hozzá
          </div>
          <div>
            A JSON-ban szereplő napok/kategóriák a már létező <strong>{existingCompetition.name}</strong> versenyhez kerülnek hozzáadásra. 
            A verseny alapadatai (név, dátum, helyszín) NEM változnak.
            Az új kategóriák az importálás után a "Napok és kategóriák" fülön szerkeszthetők.
          </div>
        </div>
      )}
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm text-blue-900">
        <div className="font-semibold mb-2 flex items-center gap-2">
          <FileText className="w-4 h-4" /> Hogyan működik?
        </div>
        <div className="space-y-1">
          <div>1. Készíts egy JSON-t a megfelelő struktúrában (nézd a sablon dokumentumot)</div>
          <div>2. Töltsd fel a fájlt VAGY másold be a tartalmat</div>
          <div>3. A rendszer érvényesíti és előnézet látsz</div>
          <div>4. Csepeli versenyzők automatikusan beazonosítva (név alapján)</div>
          <div>5. Mentés gombbal {existingCompetition ? 'hozzáadódnak a kategóriák a meglévő versenyhez' : 'létrejön az egész verseny'}</div>
        </div>
      </div>
      
      <div className="bg-white border rounded-lg p-4 mb-3" style={{ borderColor: COLORS.gray200 }}>
        <div className="text-sm font-medium mb-2" style={{ color: COLORS.blueDark }}>
          1. JSON fájl feltöltése (vagy szöveg beillesztése)
        </div>
        <input
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          className="text-sm mb-2"
        />
        <textarea
          value={jsonText}
          onChange={(e) => { setJsonText(e.target.value); tryParse(e.target.value); }}
          placeholder='{"competition": {...}, "days": [...]}'
          className="w-full h-48 p-2 border rounded-lg text-xs font-mono outline-none"
          style={{ borderColor: COLORS.gray200 }}
        />
      </div>
      
      {parseError && (
        <div className="rounded-lg p-3 text-sm flex gap-2 border mb-3"
             style={{ backgroundColor: COLORS.redLight, borderColor: COLORS.red, color: COLORS.redDark }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">JSON érvénytelen:</div>
            <div className="font-mono text-xs mt-1">{parseError}</div>
          </div>
        </div>
      )}
      
      {parsed && validationResult && (
        <div className="bg-white border rounded-lg p-4 mb-3" style={{ borderColor: COLORS.gray200 }}>
          <div className="text-sm font-medium mb-2 flex items-center gap-2" style={{ color: COLORS.blueDark }}>
            <Check className="w-4 h-4 text-green-600" /> 2. Előnézet
          </div>
          
          <div className="space-y-2 text-sm">
            <div>
              <strong>Verseny:</strong> {parsed.competition.name}
            </div>
            <div className="text-xs text-gray-600">
              {parsed.competition.start_date}
              {parsed.competition.end_date && parsed.competition.end_date !== parsed.competition.start_date 
                ? ` – ${parsed.competition.end_date}` 
                : ''}
              {parsed.competition.venue && ` · ${parsed.competition.venue.name}`}
              {' · '}
              {COLORS.importance[parsed.competition.importance]?.label || parsed.competition.importance}
            </div>
            
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="bg-blue-50 rounded p-2 text-center">
                <div className="text-xl font-bold" style={{ color: COLORS.blue }}>
                  {validationResult.days_count}
                </div>
                <div className="text-xs text-gray-600">nap</div>
              </div>
              <div className="bg-blue-50 rounded p-2 text-center">
                <div className="text-xl font-bold" style={{ color: COLORS.blue }}>
                  {validationResult.categories_count}
                </div>
                <div className="text-xs text-gray-600">kategória</div>
              </div>
              <div className="bg-blue-50 rounded p-2 text-center">
                <div className="text-xl font-bold" style={{ color: COLORS.blue }}>
                  {validationResult.total_entries}
                </div>
                <div className="text-xs text-gray-600">sor</div>
              </div>
            </div>
            
            <div className="mt-3">
              <CsepeliMatchList
                validationResult={validationResult}
                allCompetitors={allCompetitors}
                manualOverrides={manualOverrides}
                setManualOverrides={setManualOverrides}
                supabase={supabase}
                onCompetitorAdded={(newCompetitor) => {
                  setAllCompetitors(prev => [...prev, newCompetitor]);
                }}
              />
            </div>
          </div>
        </div>
      )}
      
      {importError && (
        <div className="rounded-lg p-3 text-sm flex gap-2 border mb-3"
             style={{ backgroundColor: COLORS.redLight, borderColor: COLORS.red, color: COLORS.redDark }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {importError}
        </div>
      )}
      
      <div className="flex gap-2">
        <PrimaryButton onClick={doImport} disabled={!parsed || importing}>
          {importing ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Verseny létrehozása
        </PrimaryButton>
        <SecondaryButton onClick={onClose}>Mégse</SecondaryButton>
      </div>
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════════
// CSEPELI EREDMÉNYEK TAB (v0.9.12) — egyesített Csepeli összesítő + Klub-csapatok
// Két szekció: Egyéni (versenyzőnként kártya, szerek alatta) + Klub-csapatok
// Szülő szerkesztheti, csak edző/admin véglegesíti
// ═══════════════════════════════════════════════════════════════════

function CsepeliResultsTab({ supabase, userRole, competition, onCompetitionChange }) {
  const [section, setSection] = useState('individual'); // 'individual' | 'teams'
  const canFinalize = ['admin', 'szulo_admin', 'vezetoedzo', 'edzo'].includes(userRole);
  // v0.9.50: csapatversenynél (van csapat-kategória) ne jelenjen meg a Klub-csapatok rész
  const [isTeamCompetition, setIsTeamCompetition] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('competition_categories')
        .select('type, competition_day_id, competition_days!inner(competition_id)')
        .eq('competition_days.competition_id', competition.id)
        .eq('type', 'csapat')
        .limit(1);
      if (!cancelled && data && data.length > 0) {
        setIsTeamCompetition(true);
        setSection('individual');
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, competition.id]);
  
  return (
    <div className="space-y-4">
      {/* Szekció választó — csapatversenynél nincs Klub-csapatok */}
      {!isTeamCompetition && (
      <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setSection('individual')}
          className="px-4 py-2 rounded text-sm font-medium transition-all"
          style={{
            backgroundColor: section === 'individual' ? 'white' : 'transparent',
            color: section === 'individual' ? COLORS.red : COLORS.gray700,
            boxShadow: section === 'individual' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          <Award className="w-4 h-4 inline mr-1" />
          Egyéni eredmények
        </button>
        <button
          onClick={() => setSection('teams')}
          className="px-4 py-2 rounded text-sm font-medium transition-all"
          style={{
            backgroundColor: section === 'teams' ? 'white' : 'transparent',
            color: section === 'teams' ? COLORS.red : COLORS.gray700,
            boxShadow: section === 'teams' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          <UsersIcon className="w-4 h-4 inline mr-1" />
          Klub-csapatok
        </button>
      </div>
      )}

      {section === 'individual' && (
        <CsepeliIndividualSection 
          supabase={supabase} 
          userRole={userRole} 
          competition={competition}
          onCompetitionChange={onCompetitionChange}
        />
      )}
      {section === 'teams' && !isTeamCompetition && (
        <CompetitionTeamsView 
          supabase={supabase} 
          userRole={userRole} 
          competitionId={competition.id}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CsepeliIndividualSection — egyéni eredmények kártya-stílusban
// Versenyzőnként egy kártya, minden szer alatta egy sor
// Egy "összetett" mező versenyzőnként
// ═══════════════════════════════════════════════════════════════════

function CsepeliIndividualSection({ supabase, userRole, competition, onCompetitionChange }) {
  const [groupedByCategoryAndCompetitor, setGroupedByCategoryAndCompetitor] = useState({});
  const [results, setResults] = useState({}); // entryId → result
  const [allAroundResults, setAllAroundResults] = useState({}); // catId__compId → all_around result
  const [editValues, setEditValues] = useState({}); // entryId → {placement, scores, notes}
  const [editAllAround, setEditAllAround] = useState({}); // catId__compId → {placement, notes}
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingCompId, setSavingCompId] = useState(null); // 'catId__compId' formátum
  const [successMsg, setSuccessMsg] = useState(null);

  const canFinalize = ['admin', 'szulo_admin', 'vezetoedzo', 'edzo'].includes(userRole);
  const canEdit = ['admin', 'szulo', 'szulo_admin', 'vezetoedzo', 'edzo', 'segededzo'].includes(userRole);
  const isFinalized = competition?.is_finalized;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: days, error: dErr } = await supabase
        .from('competition_days')
        .select(`
          id, day_number, date,
          categories:competition_categories (
            id, kategoria, korosztaly, type, apparatuses, time_range,
            entries:startlist_entries (
              id, start_order, competitor_id, apparatus,
              competitor:competitor_id (id, full_name, nickname, kategoria, korosztaly, birth_year)
            )
          )
        `)
        .eq('competition_id', competition.id)
        .order('day_number');
      if (dErr) throw dErr;

      // Csoportosítás: category → competitor → entries[]
      const grouped = {};
      (days || []).forEach(day => {
        (day.categories || [])
          .filter(c => c.type !== 'csapat')
          .forEach(cat => {
            const csepeliEntries = (cat.entries || []).filter(e => e.competitor_id);
            if (csepeliEntries.length === 0) return;
            
            const catKey = cat.id;
            if (!grouped[catKey]) {
              grouped[catKey] = { category: cat, competitors: {} };
            }
            csepeliEntries.forEach(entry => {
              const compId = entry.competitor_id;
              if (!grouped[catKey].competitors[compId]) {
                grouped[catKey].competitors[compId] = {
                  competitor: entry.competitor,
                  entries: []
                };
              }
              grouped[catKey].competitors[compId].entries.push(entry);
            });
          });
      });

      // Eredmények
      const allEntryIds = [];
      Object.values(grouped).forEach(g => {
        Object.values(g.competitors).forEach(c => {
          c.entries.forEach(e => allEntryIds.push(e.id));
        });
      });

      let resultsMap = {};
      if (allEntryIds.length > 0) {
        const { data: resData } = await supabase
          .from('results')
          .select('*')
          .in('startlist_entry_id', allEntryIds);
        (resData || []).forEach(r => { resultsMap[r.startlist_entry_id] = r; });
      }

      // Összetett eredmények
      const categoryIds = Object.keys(grouped);
      let aaMap = {};
      if (categoryIds.length > 0) {
        const { data: aaData } = await supabase
          .from('all_around_results')
          .select('*')
          .in('competition_category_id', categoryIds);
        (aaData || []).forEach(a => {
          aaMap[`${a.competition_category_id}__${a.competitor_id}`] = a;
        });
      }

      // v0.9.39: Helyezés AUTO-SZÁMÍTÁS
      // ha a results.placement NULL DE van score_total, számoljuk ki a helyezést
      // a teljes startlista (csepeliek + külsősök) alapján kategória+szer csoportonként.
      // Tie-break: E → D → A (FIG CoP 2025-2028)
      // 
      // PROBLÉMA háttere: a scoring.jsx-en a "Helyezések" nézet csak megjelenítéshez
      // számolja a helyezéseket, NEM ír vissza a DB-be. Ezért a Csepeli eredmények
      // szerkesztőben üresen jelent meg a placement mező korábban.
      // Most: ha a DB-ben van placement (manuálisan beírt), azt használjuk;
      // különben kiszámoljuk és virtuálisan beállítjuk az editValues-ban.
      const allEntriesForRanking = []; // { catId, entryId, apparatus, score_total, score_e, score_d, score_a, isCsepeli }
      (days || []).forEach(day => {
        (day.categories || [])
          .filter(c => c.type !== 'csapat')
          .forEach(cat => {
            (cat.entries || []).forEach(entry => {
              // Csepeli rekordnak vesszük csak, ahol van results bejegyzés
              const r = resultsMap[entry.id];
              if (r && r.score_total !== null && r.score_total !== undefined) {
                allEntriesForRanking.push({
                  catId: cat.id,
                  entryId: entry.id,
                  apparatus: entry.apparatus,
                  competitorId: entry.competitor_id,
                  score_total: r.score_total,
                  score_e: r.score_e,
                  score_d: r.score_d,
                  score_a: r.score_a
                });
              }
            });
            // Külsős versenyzők (entry.competitor_id NULL) - ők NINCSENEK a results
            // táblában (csak csepelinek mentjük), így a helyezésszámításhoz külön
            // forrásból kellene lekérni. Egyelőre csak a csepeliek között rangsorolunk.
            // TODO 2. kör: külsősök beépítése a tényleges helyezésszámításba
          });
      });

      // Helyezésszámítás kategóriánként + szerenként
      const calculatedPlacement = {}; // entryId → placement
      const groups = {}; // "catId__apparatus" → entries[]
      allEntriesForRanking.forEach(e => {
        const key = `${e.catId}__${e.apparatus || '__none__'}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(e);
      });
      Object.values(groups).forEach(arr => {
        // Rendezés: total DESC → e DESC → d DESC → a DESC
        arr.sort((a, b) => {
          if (b.score_total !== a.score_total) return b.score_total - a.score_total;
          if ((b.score_e || 0) !== (a.score_e || 0)) return (b.score_e || 0) - (a.score_e || 0);
          if ((b.score_d || 0) !== (a.score_d || 0)) return (b.score_d || 0) - (a.score_d || 0);
          return (b.score_a || 0) - (a.score_a || 0);
        });
        arr.forEach((e, idx) => { calculatedPlacement[e.entryId] = idx + 1; });
      });

      setGroupedByCategoryAndCompetitor(grouped);
      setResults(resultsMap);
      setAllAroundResults(aaMap);

      // Init edit values - a placement-nél: DB-érték elsőbbség, különben számolt érték
      const initEdit = {};
      const initAA = {};
      Object.entries(grouped).forEach(([catId, g]) => {
        Object.entries(g.competitors).forEach(([compId, cData]) => {
          cData.entries.forEach(e => {
            const r = resultsMap[e.id];
            initEdit[e.id] = {
              // v0.9.39: ha DB-ben nincs placement DE van pont, töltsük a számoltat
              placement: r?.placement ?? calculatedPlacement[e.id] ?? '',
              score_db: r?.score_db ?? '',
              score_da: r?.score_da ?? '',
              score_d: r?.score_d ?? '',
              score_a: r?.score_a ?? '',
              score_e: r?.score_e ?? '',
              score_p: r?.score_p ?? '',
              score_total: r?.score_total ?? '',
              notes: r?.notes ?? ''
            };
          });
          const aaKey = `${catId}__${compId}`;
          const aa = aaMap[aaKey];
          initAA[aaKey] = {
            placement: aa?.placement ?? '',
            score_total: aa?.score_total ?? '',
            notes: aa?.notes ?? ''
          };
        });
      });
      setEditValues(initEdit);
      setEditAllAround(initAA);
    } catch (err) {
      console.error('CsepeliIndividual load error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase, competition.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Egy versenyző mentése (összes szer + összetett egyszerre)
  const handleSaveCompetitor = async (catId, compId) => {
    const key = `${catId}__${compId}`;
    setSavingCompId(key);
    setError(null);
    setSuccessMsg(null);
    try {
      const compData = groupedByCategoryAndCompetitor[catId].competitors[compId];
      const compName = compData.competitor.full_name;
      
      const parseOpt = (val, name, max) => {
        if (val === '' || val === null || val === undefined) return null;
        const n = parseFloat(String(val).replace(',', '.'));
        if (isNaN(n)) throw new Error(`${compName} ${name}: szám kell`);
        if (n < 0) throw new Error(`${compName} ${name}: nem lehet negatív`);
        if (max && n > max) throw new Error(`${compName} ${name}: max ${max}`);
        return n;
      };
      
      const parseInt2 = (val, name) => {
        if (val === '' || val === null || val === undefined) return null;
        const n = parseInt(val, 10);
        if (isNaN(n) || n < 1) throw new Error(`${compName} ${name}: pozitív egész szám`);
        return n;
      };

      // Minden szer mentése
      for (const entry of compData.entries) {
        const vals = editValues[entry.id];
        const placement = parseInt2(vals.placement, 'helyezés');
        
        const scoreDb = parseOpt(vals.score_db, 'DB', null);
        const scoreDa = parseOpt(vals.score_da, 'DA', null);
        let scoreD = parseOpt(vals.score_d, 'D', null);
        if (scoreD === null && (scoreDb !== null || scoreDa !== null)) {
          scoreD = (scoreDb || 0) + (scoreDa || 0);
        }
        const scoreA = parseOpt(vals.score_a, 'A', 10);
        const scoreE = parseOpt(vals.score_e, 'E', 10);
        const scoreP = parseOpt(vals.score_p, 'P', null);
        let scoreTotal = parseOpt(vals.score_total, 'Total', null);
        if (scoreTotal === null && (scoreD !== null || scoreA !== null || scoreE !== null)) {
          scoreTotal = Math.round(((scoreD || 0) + (scoreA || 0) + (scoreE || 0) - (scoreP || 0)) * 1000) / 1000;
        }

        // Ha SEMMI nincs megadva, kihagyjuk
        if (placement === null && scoreTotal === null && scoreD === null && scoreA === null && scoreE === null) {
          continue;
        }

        const existing = results[entry.id];
        const payload = {
          startlist_entry_id: entry.id,
          apparatus: entry.apparatus,
          placement,
          score_db: scoreDb,
          score_da: scoreDa,
          score_d: scoreD,
          score_a: scoreA,
          score_e: scoreE,
          score_p: scoreP,
          score_total: scoreTotal,
          notes: vals.notes || null,
          modified_at: new Date().toISOString()
        };

        if (existing) {
          await supabase.from('results').update(payload).eq('id', existing.id);
        } else {
          payload.is_provisional = true;
          await supabase.from('results').insert(payload);
        }
      }

      // Összetett eredmény mentése
      const aaVals = editAllAround[key];
      if (aaVals && (aaVals.placement || aaVals.score_total || aaVals.notes)) {
        const aaPayload = {
          competition_category_id: catId,
          competitor_id: compId,
          placement: parseInt2(aaVals.placement, 'összetett helyezés'),
          score_total: parseOpt(aaVals.score_total, 'összetett pont', null),
          notes: aaVals.notes || null,
          modified_at: new Date().toISOString()
        };
        
        const existingAA = allAroundResults[key];
        if (existingAA) {
          await supabase.from('all_around_results').update(aaPayload).eq('id', existingAA.id);
        } else {
          aaPayload.is_provisional = true;
          await supabase.from('all_around_results').insert(aaPayload);
        }
      }

      setSuccessMsg(`Mentve: ${compName}`);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingCompId(null);
    }
  };

  // Verseny lezárása
  const handleFinalize = async () => {
    if (!canFinalize) return;
    if (!window.confirm('Lezárod a versenyt? Lezárás után csak edző és admin módosíthat. Folytatod?')) return;
    
    try {
      const userResp = await supabase.auth.getUser();
      const userId = userResp.data?.user?.id;
      
      // results véglegesítése
      const allResIds = Object.values(results).filter(r => r).map(r => r.id);
      if (allResIds.length > 0) {
        await supabase.from('results')
          .update({ is_provisional: false, finalized_by: userId, finalized_at: new Date().toISOString() })
          .in('id', allResIds);
      }
      
      // all_around véglegesítése
      const aaIds = Object.values(allAroundResults).filter(a => a).map(a => a.id);
      if (aaIds.length > 0) {
        await supabase.from('all_around_results')
          .update({ is_provisional: false, finalized_by: userId, finalized_at: new Date().toISOString() })
          .in('id', aaIds);
      }
      
      // verseny lezárása
      await supabase.from('competitions').update({ is_finalized: true }).eq('id', competition.id);
      
      setSuccessMsg('Verseny lezárva!');
      if (onCompetitionChange) onCompetitionChange({ ...competition, is_finalized: true });
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReopen = async () => {
    if (!canFinalize) return;
    if (!window.confirm('Visszanyitod a versenyt?')) return;
    
    try {
      const allResIds = Object.values(results).filter(r => r).map(r => r.id);
      if (allResIds.length > 0) {
        await supabase.from('results').update({ is_provisional: true, finalized_by: null, finalized_at: null }).in('id', allResIds);
      }
      const aaIds = Object.values(allAroundResults).filter(a => a).map(a => a.id);
      if (aaIds.length > 0) {
        await supabase.from('all_around_results').update({ is_provisional: true, finalized_by: null, finalized_at: null }).in('id', aaIds);
      }
      await supabase.from('competitions').update({ is_finalized: false }).eq('id', competition.id);
      setSuccessMsg('Verseny visszanyitva.');
      if (onCompetitionChange) onCompetitionChange({ ...competition, is_finalized: false });
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  const categoryKeys = Object.keys(groupedByCategoryAndCompetitor);
  if (categoryKeys.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Award className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <div>Még nincs csepeli versenyző a startlistában.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Üzenetek */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 text-sm text-green-700">
          <Check className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-900">
        💡 Csak helyezés kötelező, pontok opcionálisak. Versenyzőnként a "Mentés" gomb az összes szert + összetettet egyszerre menti. Az eredmények csak <strong>verseny lezárása után</strong> jelennek meg az Áttekintésen.
      </div>

      {/* Kategóriánként */}
      {categoryKeys.map(catId => {
        const group = groupedByCategoryAndCompetitor[catId];
        const cat = group.category;
        // v0.9.37: CRASH JAVÍTÁS - korábban null.full_name TypeError-ral kifagyott
        // szülő profillal (RLS miatt egyes versenyzők competitor: null).
        // Most: 1) kiszűrjük az érvényteleneket, 2) becenév-elsődleges magyar abc rendezés.
        const compIds = Object.keys(group.competitors)
          .filter(cid => group.competitors[cid]?.competitor) // null guard
          .sort((a, b) => {
            const cA = group.competitors[a].competitor;
            const cB = group.competitors[b].competitor;
            const nA = (cA.nickname || cA.full_name || '').trim();
            const nB = (cB.nickname || cB.full_name || '').trim();
            return nA.localeCompare(nB, 'hu', { sensitivity: 'base', numeric: true });
          });
        
        return (
          <div key={catId} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
              <div className="font-semibold text-sm">{cat.kategoria} · {cat.korosztaly}</div>
              <div className="text-xs text-gray-500">{compIds.length} csepeli versenyző</div>
            </div>
            <div className="p-3 space-y-3">
              {compIds.map(compId => {
                const cData = group.competitors[compId];
                const aaKey = `${catId}__${compId}`;
                const competitor = cData.competitor;
                const name = competitor.nickname 
                  ? `${competitor.full_name.split(' ')[0]} "${competitor.nickname}" ${competitor.full_name.split(' ').slice(1).join(' ')}`
                  : competitor.full_name;
                
                const sortedEntries = [...cData.entries].sort((a, b) => (a.start_order || 0) - (b.start_order || 0));
                
                return (
                  <div 
                    key={compId} 
                    className="rounded-lg p-3 border-l-4"
                    style={{ backgroundColor: '#FCE7F3', borderLeftColor: COLORS.red }}
                  >
                    {/* Versenyző fejléc + összetett */}
                    <div className="flex items-center gap-3 flex-wrap mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-base" style={{ color: COLORS.red }}>
                          ★ {name}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-gray-700">Összetett:</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={editAllAround[aaKey]?.placement || ''}
                          onChange={(e) => setEditAllAround(prev => ({
                            ...prev,
                            [aaKey]: { ...prev[aaKey], placement: e.target.value }
                          }))}
                          placeholder="hely"
                          className="w-16 px-2 py-1 text-sm border border-gray-300 rounded font-semibold"
                          style={{ color: COLORS.red, textAlign: 'center' }}
                          disabled={!canEdit}
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editAllAround[aaKey]?.score_total || ''}
                          onChange={(e) => setEditAllAround(prev => ({
                            ...prev,
                            [aaKey]: { ...prev[aaKey], score_total: e.target.value }
                          }))}
                          placeholder="pont"
                          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
                          disabled={!canEdit}
                        />
                      </div>
                    </div>
                    
                    {/* Szerek táblázat */}
                    <div className="space-y-2">
                      {sortedEntries.map(entry => {
                        const apparatusLabel = entry.apparatus 
                          ? (APPARATUS_LABELS[entry.apparatus] || entry.apparatus) 
                          : 'Választott';
                        const vals = editValues[entry.id] || {};
                        const onChange = (field, value) => setEditValues(prev => ({
                          ...prev,
                          [entry.id]: { ...prev[entry.id], [field]: value }
                        }));
                        
                        return (
                          <div key={entry.id} className="bg-white rounded p-2 border border-gray-200">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-medium text-gray-500 w-6">{entry.start_order}.</span>
                              <span className="text-sm font-medium text-gray-700 min-w-[80px]">{apparatusLabel}</span>
                              {canEdit && (
                                <>
                                  <label className="text-xs text-gray-500">Helyezés:</label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={vals.placement || ''}
                                    onChange={(e) => onChange('placement', e.target.value)}
                                    placeholder="—"
                                    className="w-12 px-1.5 py-0.5 text-xs border border-gray-300 rounded text-center font-semibold"
                                  />
                                </>
                              )}
                            </div>
                            {canEdit && (
                              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1 ml-8">
                                <NoSpinnerInput label="DB" value={vals.score_db} onChange={v => onChange('score_db', v)} />
                                <NoSpinnerInput label="DA" value={vals.score_da} onChange={v => onChange('score_da', v)} />
                                <NoSpinnerInput label="D" value={vals.score_d} onChange={v => onChange('score_d', v)} />
                                <NoSpinnerInput label="A" value={vals.score_a} onChange={v => onChange('score_a', v)} max="10" />
                                <NoSpinnerInput label="E" value={vals.score_e} onChange={v => onChange('score_e', v)} max="10" />
                                <NoSpinnerInput label="P" value={vals.score_p} onChange={v => onChange('score_p', v)} />
                                <NoSpinnerInput label="Total" value={vals.score_total} onChange={v => onChange('score_total', v)} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Megjegyzés + Mentés */}
                    {canEdit && (
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <input
                          type="text"
                          value={editAllAround[aaKey]?.notes || ''}
                          onChange={(e) => setEditAllAround(prev => ({
                            ...prev,
                            [aaKey]: { ...prev[aaKey], notes: e.target.value }
                          }))}
                          placeholder="Megjegyzés a versenyzőről (opcionális)"
                          className="flex-1 min-w-[180px] px-2 py-1 text-xs border border-gray-300 rounded"
                        />
                        <button
                          onClick={() => handleSaveCompetitor(catId, compId)}
                          disabled={savingCompId === `${catId}__${compId}`}
                          className="px-4 py-1.5 rounded text-white text-sm font-medium disabled:opacity-50"
                          style={{ backgroundColor: COLORS.blue }}
                        >
                          {savingCompId === `${catId}__${compId}` 
                            ? <Loader className="w-3 h-3 animate-spin inline" /> 
                            : <Save className="w-3 h-3 inline mr-1" />}
                          Mentés
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Alsó akciók */}
      {canFinalize && (
        <div className="bg-white rounded-lg border-2 p-4 sticky bottom-4 shadow-lg"
             style={{ borderColor: isFinalized ? '#15803D' : COLORS.red }}>
          {isFinalized ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm flex-1" style={{ color: '#15803D' }}>
                ✓ A verseny le van zárva. Az eredmények véglegesek.
              </span>
              <button onClick={handleReopen} className="px-4 py-2 rounded border border-gray-300 text-sm hover:bg-gray-50">
                <Edit2 className="w-4 h-4 inline mr-1" /> Visszanyitás
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm flex-1" style={{ color: COLORS.red }}>
                ⏳ A verseny még nincs lezárva.
              </span>
              <button onClick={handleFinalize} className="px-4 py-2 rounded text-white text-sm font-medium"
                      style={{ backgroundColor: '#15803D' }}>
                <Check className="w-4 h-4 inline mr-1" /> Verseny lezárása
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Beviteli mező nyilak nélkül (spinner OFF)
function NoSpinnerInput({ label, value, onChange, max }) {
  return (
    <div>
      <label className="text-xs text-gray-500 block mb-0.5">{label}</label>
      <input
        type="text"
        inputMode="decimal"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        max={max}
        className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        style={{ MozAppearance: 'textfield' }}
      />
    </div>
  );
}
