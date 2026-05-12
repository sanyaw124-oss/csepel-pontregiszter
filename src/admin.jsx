import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, UserPlus, Edit2, Plus, Check, AlertCircle, Heart, Award,
  Save, ArrowLeft, ChevronRight, Loader, Search, Copy, Trophy, BookOpen, Clock, Trash2, X,
  ToggleLeft, ToggleRight, Eye, EyeOff
} from 'lucide-react';

// HELPER: jelszó generálás már az Edge Function-on történik szerveroldalon

// ═══════════════════════════════════════════════════════════════════
// HELPER: versenyző név formázás
// ═══════════════════════════════════════════════════════════════════

export function formatCompetitorName(c) {
  if (!c) return '';
  if (!c.nickname) return c.full_name;
  const parts = c.full_name.trim().split(' ');
  if (parts.length === 2) {
    return `${parts[0]} "${c.nickname}" ${parts[1]}`;
  }
  return `${c.full_name} "${c.nickname}"`;
}

// ═══════════════════════════════════════════════════════════════════
// HELPER: életkor számítás
// ═══════════════════════════════════════════════════════════════════

export function calculateAge(birthDate) {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

export const KATEGORIAK = ['BNK', 'SZK', 'VSK I', 'VSK II'];
export const KOROSZTALYOK = ['Mini', 'Kisgyermek', 'Gyermek', 'Serdülő', 'Junior', 'Ifjúsági', 'Felnőtt'];

const COLORS = {
  blue: '#1e3a8a',
  blueDark: '#0c1e4a',
  blueLight: '#3b82f6',
  blueBg: '#eff6ff',
  red: '#dc2626',
  redDark: '#991b1b',
  redLight: '#fee2e2',
  gray200: '#e5e7eb',
  gray500: '#6b7280',
  gray700: '#374151'
};

const ROLE_LABELS = {
  vezetoedzo: 'Vezetőedző',
  edzo: 'Edző',
  segededzo: 'Segédedző',
  szulo_admin: 'Szülő-admin'
};

// ═══════════════════════════════════════════════════════════════════
// COMMON UI: Field, Button
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
      style={{ borderColor: COLORS.gray200, ...props.style }}
    >
      {children}
    </select>
  );
}

function PrimaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      className={`flex items-center gap-1 px-4 py-2 text-white rounded-lg disabled:opacity-50 ${props.className || ''}`}
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
      className={`px-4 py-2 border rounded-lg hover:bg-gray-50 ${props.className || ''}`}
      style={{ borderColor: COLORS.gray200, ...props.style }}
    >
      {children}
    </button>
  );
}

function ErrorBox({ children }) {
  if (!children) return null;
  return (
    <div className="flex items-start gap-2 text-sm p-3 rounded-lg border"
         style={{ backgroundColor: COLORS.redLight, borderColor: COLORS.red, color: COLORS.redDark }}>
      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN: AdminView - 4 fül
// ═══════════════════════════════════════════════════════════════════

export function AdminView({ supabase, userRole, dataReloadKey }) {
  const [tab, setTab] = useState('competitors');
  
  const tabs = [
    { id: 'competitors', label: 'Versenyzők', icon: Users },
    { id: 'parents', label: 'Szülők', icon: Heart },
    { id: 'staff', label: 'Edzők', icon: Award },
    { id: 'links', label: 'Kapcsolatok', icon: ChevronRight }
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4" style={{ color: COLORS.blueDark }}>
        Adminisztráció
      </h2>

      <div className="bg-white rounded-lg border border-gray-200 mb-4 shadow-sm">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap"
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
          {tab === 'competitors' && <AdminCompetitors supabase={supabase} dataReloadKey={dataReloadKey} />}
          {tab === 'parents' && <AdminParents supabase={supabase} userRole={userRole} dataReloadKey={dataReloadKey} />}
          {tab === 'staff' && <AdminStaff supabase={supabase} userRole={userRole} dataReloadKey={dataReloadKey} />}
          {tab === 'links' && <AdminLinks supabase={supabase} dataReloadKey={dataReloadKey} />}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VERSENYZŐK
// ═══════════════════════════════════════════════════════════════════

function AdminCompetitors({ supabase, dataReloadKey }) {
  const [competitors, setCompetitors] = useState(null);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState({ search: '', kategoria: 'all', showInactive: false });
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from('competitors')
      .select('*')
      .order('full_name');
    if (error) setError(error.message);
    else setCompetitors(data);
  }, [supabase]);

  useEffect(() => { load(); }, [load, dataReloadKey]);

  const filtered = (competitors || []).filter(c => {
    if (!filter.showInactive && !c.is_active) return false;
    if (filter.kategoria !== 'all' && c.kategoria !== filter.kategoria) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (!c.full_name.toLowerCase().includes(q) && 
          !(c.nickname || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (editing !== null) {
    return (
      <CompetitorForm
        supabase={supabase}
        competitor={editing === 'new' ? null : editing}
        userRole="admin"
        onSaved={() => { setEditing(null); load(); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  if (competitors === null) {
    return <div className="text-center py-8"><Loader className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Keresés név vagy becenév..."
              value={filter.search}
              onChange={(e) => setFilter({...filter, search: e.target.value})}
              className="pl-9"
            />
          </div>
          <Select
            value={filter.kategoria}
            onChange={(e) => setFilter({...filter, kategoria: e.target.value})}
            style={{ width: 'auto' }}
          >
            <option value="all">Minden kat.</option>
            {KATEGORIAK.map(k => <option key={k} value={k}>{k}</option>)}
          </Select>
        </div>
        <PrimaryButton onClick={() => setEditing('new')}>
          <Plus className="w-4 h-4" /> Új versenyző
        </PrimaryButton>
      </div>

      <div className="flex items-center justify-between mb-3 text-sm">
        <span className="text-gray-600">
          {filtered.length} / {competitors.length} versenyző
        </span>
        <button
          onClick={() => setFilter({...filter, showInactive: !filter.showInactive})}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900"
        >
          {filter.showInactive ? <ToggleRight className="w-5 h-5 text-blue-700" /> : <ToggleLeft className="w-5 h-5" />}
          Inaktívak mutatása
        </button>
      </div>

      <ErrorBox>{error}</ErrorBox>

      {filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-8 text-sm">
          {competitors.length === 0
            ? 'Még nincs versenyző. Kattints az "Új versenyző" gombra.'
            : 'Nincs találat a szűrésre.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => <CompetitorRow key={c.id} competitor={c} onEdit={() => setEditing(c)} />)}
        </div>
      )}
    </div>
  );
}

function CompetitorRow({ competitor, onEdit }) {
  const age = calculateAge(competitor.birth_date) ?? (new Date().getFullYear() - competitor.birth_year);
  return (
    <div 
      className="border rounded-lg p-3 flex items-center justify-between hover:bg-gray-50"
      style={{ 
        borderColor: competitor.is_provisional ? '#fbbf24' : COLORS.gray200,
        backgroundColor: competitor.is_provisional ? '#fef3c7' : undefined,
        opacity: competitor.is_active ? 1 : 0.5
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="font-semibold flex items-center gap-2 flex-wrap" style={{ color: COLORS.blueDark }}>
          {formatCompetitorName(competitor)}
          {!competitor.is_active && (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600">Inaktív</span>
          )}
          {competitor.is_provisional && (
            <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ backgroundColor: '#f59e0b', color: 'white' }}>
              ⚠ Ideiglenes
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          {competitor.kategoria} · {competitor.korosztaly} · {age} éves
        </div>
      </div>
      <button onClick={onEdit} className="p-2 text-gray-600 hover:bg-white rounded">
        <Edit2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function CompetitorForm({ supabase, competitor, onSaved, onCancel, userRole }) {
  const isNew = !competitor;
  const [form, setForm] = useState(() => {
    if (competitor) {
      return {
        ...competitor,
        birth_date: competitor.birth_date || '',
        competing_since: competitor.competing_since || ''
      };
    }
    return {
      full_name: '',
      nickname: '',
      birth_date: '',
      competing_since: '',
      kategoria: 'VSK II',
      korosztaly: 'serdülő',
      email: '',
      is_active: true,
      is_club_member: true
    };
  });
  const [parents, setParents] = useState([]);
  const [linkedParentIds, setLinkedParentIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Szülők és linkek betöltése
  useEffect(() => {
    const loadParents = async () => {
      const { data: p } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('role', ['szulo', 'szulo_admin'])
        .order('full_name');
      setParents(p || []);

      if (!isNew) {
        const { data: links } = await supabase
          .from('parent_child_links')
          .select('parent_user_id')
          .eq('competitor_id', competitor.id);
        setLinkedParentIds((links || []).map(l => l.parent_user_id));
      }
    };
    loadParents();
  }, [supabase, isNew, competitor]);

  const toggleParent = (pid) => {
    setLinkedParentIds(prev =>
      prev.includes(pid) ? prev.filter(x => x !== pid) : [...prev, pid]
    );
  };

  const save = async (markAsFinal = false) => {
    setError(null);
    if (!(form.full_name || '').trim()) {
      setError('A név kötelező');
      return;
    }
    if (!form.birth_date) {
      setError('A születési dátum kötelező');
      return;
    }
    
    setSaving(true);
    try {
      const birthYear = new Date(form.birth_date).getFullYear();
      const payload = {
        full_name: (form.full_name || '').trim(),
        nickname: (form.nickname || '').trim() || null,
        birth_date: form.birth_date,
        birth_year: birthYear,
        competing_since: form.competing_since || null,
        kategoria: form.kategoria,
        korosztaly: form.korosztaly,
        email: (form.email || '').trim() || null,
        is_active: form.is_active,
        is_club_member: form.is_club_member
      };
      
      // Ha "véglegesként" mentjük, állítsuk false-ra a provisional flaget
      if (markAsFinal) {
        payload.is_provisional = false;
      }

      let competitorId;
      if (isNew) {
        const { data, error } = await supabase
          .from('competitors')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        competitorId = data.id;
      } else {
        const { error } = await supabase
          .from('competitors')
          .update(payload)
          .eq('id', competitor.id);
        if (error) throw error;
        competitorId = competitor.id;
      }

      // Szülő-gyerek kapcsolatok frissítése
      // 1. Minden meglévő törlése
      await supabase
        .from('parent_child_links')
        .delete()
        .eq('competitor_id', competitorId);
      // 2. Új linkek beszúrása
      if (linkedParentIds.length > 0) {
        const linkRows = linkedParentIds.map(pid => ({
          parent_user_id: pid,
          competitor_id: competitorId
        }));
        const { error: linkError } = await supabase
          .from('parent_child_links')
          .insert(linkRows);
        if (linkError) throw linkError;
      }

      onSaved();
    } catch (err) {
      setError('Mentés sikertelen: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h3 className="font-semibold" style={{ color: COLORS.blueDark }}>
          {isNew ? 'Új versenyző' : 'Versenyző szerkesztése'}
        </h3>
      </div>

      <div className="space-y-3">
        <Field label="Teljes név *">
          <Input
            type="text"
            value={form.full_name}
            onChange={(e) => setForm({...form, full_name: e.target.value})}
            placeholder="Vezetéknév Keresztnév"
          />
        </Field>

        <Field label="Becenév" hint='Megjelenítés: Vezetéknév "Becenév" Keresztnév'>
          <Input
            type="text"
            value={form.nickname}
            onChange={(e) => setForm({...form, nickname: e.target.value})}
            placeholder="pl. Kátya"
          />
        </Field>

        <Field label="Születési dátum *">
          <Input
            type="date"
            value={form.birth_date}
            onChange={(e) => setForm({...form, birth_date: e.target.value})}
            max={new Date().toISOString().split('T')[0]}
            min="2000-01-01"
          />
        </Field>

        <Field label="Versenyez óta (opcionális)">
          <Input
            type="date"
            value={form.competing_since}
            onChange={(e) => setForm({...form, competing_since: e.target.value})}
            max={new Date().toISOString().split('T')[0]}
            min={form.birth_date || '2000-01-01'}
          />
          <div className="text-xs text-gray-500 mt-1">
            Mióta versenyez aktívan (statisztikákhoz, edzői áttekintéshez)
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Kategória">
            <Select value={form.kategoria} onChange={(e) => setForm({...form, kategoria: e.target.value})}>
              {KATEGORIAK.map(k => <option key={k}>{k}</option>)}
            </Select>
          </Field>
          <Field label="Korosztály">
            <Select value={form.korosztaly} onChange={(e) => setForm({...form, korosztaly: e.target.value})}>
              {KOROSZTALYOK.map(k => <option key={k}>{k}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Email (opcionális)">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({...form, email: e.target.value})}
          />
        </Field>

        {!isNew && (
          <Field label={`Szülő(k) — ${linkedParentIds.length} kiválasztva`}>
            {parents.length === 0 ? (
              <div className="text-sm text-gray-500 italic p-3 border border-dashed rounded-lg">
                Még nincs szülő fiók. Hozz létre szülőt először.
              </div>
            ) : (
              <div className="border rounded-lg max-h-48 overflow-y-auto" style={{ borderColor: COLORS.gray200 }}>
                {parents.map(p => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                    style={{ borderColor: COLORS.gray200 }}
                  >
                    <input
                      type="checkbox"
                      checked={linkedParentIds.includes(p.id)}
                      onChange={() => toggleParent(p.id)}
                      className="rounded"
                      style={{ accentColor: COLORS.blue }}
                    />
                    <span className="text-sm">{p.full_name}</span>
                    {p.email && <span className="text-xs text-gray-500">({p.email})</span>}
                  </label>
                ))}
              </div>
            )}
          </Field>
        )}

        {!isNew && (
          <Field label="Aktív státusz">
            <button
              type="button"
              onClick={() => setForm({...form, is_active: !form.is_active})}
              className="flex items-center gap-2 text-sm"
            >
              {form.is_active ? (
                <>
                  <ToggleRight className="w-6 h-6" style={{ color: COLORS.blue }} />
                  <span style={{ color: COLORS.blue }}>Aktív versenyző</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-6 h-6 text-gray-400" />
                  <span className="text-gray-500">Inaktív (nem versenyez)</span>
                </>
              )}
            </button>
          </Field>
        )}


        {isNew && (
          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
            A szülő-gyerek kapcsolatokat a mentés után tudod beállítani — szerkeszd újra a versenyzőt.
          </div>
        )}
        
        {/* Ideiglenes profil figyelmeztetés */}
        {!isNew && competitor?.is_provisional && (
          <div className="rounded-lg p-3 text-sm flex gap-2 border"
               style={{ backgroundColor: '#fef3c7', borderColor: '#f59e0b', color: '#92400e' }}>
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold mb-1">Ideiglenes profil</div>
              <div>Ez a versenyző gyors importálás során jött létre. Ellenőrizd az adatokat, és ha mindent kitöltöttél, a "Mentés véglegesként" gombbal véglegesítheted.</div>
            </div>
          </div>
        )}

        {/* Csapat-eredmények - csak meglévő versenyzőnél */}
        {!isNew && competitor?.id && (
          <CompetitorTeamResults supabase={supabase} competitorId={competitor.id} />
        )}

        {/* Korábbi eredmények - csak meglévő versenyzőnél */}
        {!isNew && competitor?.id && (
          <CompetitorHistoricalResults supabase={supabase} competitorId={competitor.id} userRole={userRole} />
        )}

        {/* Edzések - csak meglévő versenyzőnél */}
        {!isNew && competitor?.id && (
          <CompetitorTrainingHistory supabase={supabase} competitorId={competitor.id} />
        )}

        <ErrorBox>{error}</ErrorBox>

        <div className="flex gap-2 pt-2 flex-wrap">
          <PrimaryButton onClick={() => save(false)} disabled={saving}>
            {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Mentés
          </PrimaryButton>
          {!isNew && competitor?.is_provisional && (
            <button
              onClick={() => save(true)}
              disabled={saving}
              className="px-4 py-2 rounded-lg font-medium text-white text-sm flex items-center gap-1.5 disabled:opacity-50"
              style={{ backgroundColor: '#f59e0b' }}
            >
              <Check className="w-4 h-4" />
              Mentés véglegesként
            </button>
          )}
          <SecondaryButton onClick={onCancel}>Mégse</SecondaryButton>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SZÜLŐK
// ═══════════════════════════════════════════════════════════════════

function AdminParents({ supabase, dataReloadKey, userRole }) {
  const [parents, setParents] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);
  const [generatedCreds, setGeneratedCreds] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, username, role, created_at')
      .in('role', ['szulo', 'szulo_admin'])
      .order('full_name');
    if (error) setError(error.message);
    else setParents(data);
  }, [supabase]);

  useEffect(() => { load(); }, [load, dataReloadKey]);

  if (editing !== null) {
    return (
      <ParentForm
        supabase={supabase}
        parent={editing === 'new' ? null : editing}
        userRole={userRole}
        onSaved={(creds) => { 
          setEditing(null); 
          load();
          if (creds) setGeneratedCreds(creds);
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  if (parents === null) {
    return <div className="text-center py-8"><Loader className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>;
  }

  return (
    <div>
      {generatedCreds && <CredentialsPopup creds={generatedCreds} onClose={() => setGeneratedCreds(null)} />}
      
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm text-gray-600">{parents.length} szülő fiók</span>
        <PrimaryButton onClick={() => setEditing('new')}>
          <UserPlus className="w-4 h-4" /> Új szülő
        </PrimaryButton>
      </div>

      <ErrorBox>{error}</ErrorBox>

      {parents.length === 0 ? (
        <div className="text-center text-gray-500 py-8 text-sm">Még nincs szülő fiók.</div>
      ) : (
        <div className="space-y-2">
          {parents.map(p => (
            <ParentRow key={p.id} parent={p} supabase={supabase} onEdit={() => setEditing(p)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ParentRow({ parent, supabase, onEdit }) {
  const [childCount, setChildCount] = useState(null);
  
  useEffect(() => {
    supabase
      .from('parent_child_links')
      .select('competitor_id', { count: 'exact', head: true })
      .eq('parent_user_id', parent.id)
      .then(({ count }) => setChildCount(count ?? 0));
  }, [supabase, parent.id]);

  return (
    <div className="border rounded-lg p-3 flex items-center justify-between hover:bg-gray-50"
         style={{ borderColor: COLORS.gray200 }}>
      <div className="min-w-0 flex-1">
        <div className="font-semibold flex items-center gap-2" style={{ color: COLORS.blueDark }}>
          {parent.full_name}
          {parent.role === 'szulo_admin' && (
            <span className="text-xs px-2 py-0.5 rounded font-normal"
                  style={{ backgroundColor: COLORS.blue, color: 'white' }}>
              Admin
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 truncate">
          {parent.email}
          {childCount !== null && ` · ${childCount} gyerek`}
        </div>
      </div>
      <button onClick={onEdit} className="p-2 text-gray-600 hover:bg-white rounded">
        <Edit2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function ParentForm({ supabase, parent, userRole, onSaved, onCancel }) {
  const isNew = !parent;
  const [form, setForm] = useState({
    full_name: parent?.full_name || '',
    email: parent?.email || '',
    role: parent?.role || 'szulo',
    password: '',  // ÚJ: manuálisan megadott jelszó (új fiókhoz)
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false); // ÚJ: jelszó módosítás panel megjelenítése
  const [newPassword, setNewPassword] = useState(''); // ÚJ: új jelszó (létező fiókhoz)
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [competitors, setCompetitors] = useState([]);
  const [linkedChildIds, setLinkedChildIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [passwordChangeMessage, setPasswordChangeMessage] = useState(null); // ÚJ: jelszó módosítás után üzenet

  // Csak admin (nem szulo_admin) változtathat szülő-admin szerepkört
  const canSetSzuloAdmin = userRole === 'admin';

  useEffect(() => {
    const loadData = async () => {
      const { data: c } = await supabase
        .from('competitors')
        .select('id, full_name, nickname, birth_year, kategoria')
        .eq('is_active', true)
        .order('full_name');
      setCompetitors(c || []);

      if (!isNew) {
        const { data: links } = await supabase
          .from('parent_child_links')
          .select('competitor_id')
          .eq('parent_user_id', parent.id);
        setLinkedChildIds((links || []).map(l => l.competitor_id));
      }
    };
    loadData();
  }, [supabase, isNew, parent]);

  const toggleChild = (cid) => {
    setLinkedChildIds(prev =>
      prev.includes(cid) ? prev.filter(x => x !== cid) : [...prev, cid]
    );
  };

  // Jelszó validáció: legalább 6 karakter és legalább egy szám
  const validatePassword = (pwd) => {
    if (!pwd || pwd.length < 6) return 'A jelszó legalább 6 karakter legyen';
    if (!/\d/.test(pwd)) return 'A jelszó legalább 1 számot tartalmazzon';
    return null;
  };

  const save = async () => {
    setError(null);
    if (!(form.full_name || '').trim()) {
      setError('A név kötelező');
      return;
    }
    if (!(form.email || '').trim()) {
      setError('Az email kötelező');
      return;
    }
    
    // ÚJ: új fióknál kötelező a jelszó megadása
    if (isNew) {
      const pwdError = validatePassword(form.password);
      if (pwdError) {
        setError(pwdError);
        return;
      }
    }

    setSaving(true);
    try {
      let userId = parent?.id;

      if (isNew) {
        // Új user: Edge Function-ön keresztül - manuális jelszóval
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Nincs aktív session');
        
        const response = await fetch(
          `${supabase.supabaseUrl}/functions/v1/create-user`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              email: form.email.trim(),
              full_name: form.full_name.trim(),
              role: form.role,
              password: form.password  // ÚJ: manuális jelszó átadása
            })
          }
        );
        
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Felhasználó létrehozása sikertelen');
        }
        
        userId = result.user_id;
      } else {
        // Frissítés: profile - név, email, ÉS role
        const updates = {
          full_name: (form.full_name || '').trim(),
          email: (form.email || '').trim()
        };
        // Csak ha admin, és változott a role
        if (canSetSzuloAdmin && form.role !== parent.role) {
          updates.role = form.role;
        }
        
        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', parent.id);
        if (error) throw error;
      }

      // Szülő-gyerek kapcsolatok
      await supabase
        .from('parent_child_links')
        .delete()
        .eq('parent_user_id', userId);
      if (linkedChildIds.length > 0) {
        const linkRows = linkedChildIds.map(cid => ({
          parent_user_id: userId,
          competitor_id: cid
        }));
        const { error: linkError } = await supabase
          .from('parent_child_links')
          .insert(linkRows);
        if (linkError) throw linkError;
      }

      onSaved(isNew ? { 
        email: form.email.trim(), 
        password: form.password,
        name: form.full_name.trim()
      } : null);
    } catch (err) {
      setError('Mentés sikertelen: ' + err.message);
      setSaving(false);
    }
  };

  // ÚJ: jelszó megváltoztatása meglévő felhasználónak (csak admin)
  const changePassword = async () => {
    setError(null);
    setPasswordChangeMessage(null);
    
    const pwdError = validatePassword(newPassword);
    if (pwdError) {
      setError(pwdError);
      return;
    }
    
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nincs aktív session');
      
      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/change-password`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: parent.id,
            new_password: newPassword
          })
        }
      );
      
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Jelszó módosítása sikertelen');
      }
      
      setPasswordChangeMessage(`Jelszó sikeresen módosítva. Új jelszó: ${newPassword}`);
      setNewPassword('');
      setShowPasswordChange(false);
    } catch (err) {
      setError('Jelszó módosítás sikertelen: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h3 className="font-semibold" style={{ color: COLORS.blueDark }}>
          {isNew ? 'Új szülő fiók' : 'Szülő szerkesztése'}
        </h3>
      </div>

      {isNew && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-900">
          <strong>Új szülő fiók:</strong> add meg a jelszót (min. 6 karakter, min. 1 szám), 
          és továbbítsd a szülőnek (email/SMS/papír).
        </div>
      )}

      <div className="space-y-3">
        <Field label="Teljes név *">
          <Input
            type="text"
            value={form.full_name}
            onChange={(e) => setForm({...form, full_name: e.target.value})}
            placeholder="pl. Völgyesi Sándor"
          />
        </Field>

        <Field label="Email * (ezzel fog belépni)">
          <Input
            type="email"
            name="parent_email_field"
            autoComplete="off"
            value={form.email}
            onChange={(e) => setForm({...form, email: e.target.value})}
            disabled={!isNew}
            placeholder="szulo@example.com"
          />
        </Field>

        {isNew && (
          <Field label="Jelszó * (min. 6 karakter, min. 1 szám)">
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({...form, password: e.target.value})}
                placeholder="pl. csepel123"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>
        )}

        {/* ÚJ: meglévő szülőnél role-váltó (csak admin láthatja) */}
        {!isNew && canSetSzuloAdmin && (
          <Field 
            label="Szerepkör" 
            hint={form.role === 'szulo_admin' 
              ? 'Szülő-admin: admin jog + saját gyerekek látása' 
              : 'Sima szülő: csak saját gyerekek'}
          >
            <Select 
              value={form.role} 
              onChange={(e) => setForm({...form, role: e.target.value})}
            >
              <option value="szulo">Szülő (alapértelmezett)</option>
              <option value="szulo_admin">Szülő-admin (admin jogokkal)</option>
            </Select>
          </Field>
        )}

        {/* ÚJ: jelszó módosítása meglévő fióknál */}
        {!isNew && (
          <div className="border-t pt-3" style={{ borderColor: COLORS.gray200 }}>
            {!showPasswordChange ? (
              <SecondaryButton onClick={() => setShowPasswordChange(true)}>
                <Eye className="w-4 h-4" /> Jelszó megváltoztatása
              </SecondaryButton>
            ) : (
              <div className="space-y-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="text-sm font-medium text-amber-900">
                  Új jelszó (min. 6 karakter, min. 1 szám):
                </div>
                <div className="relative">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="új jelszó"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex gap-2">
                  <PrimaryButton onClick={changePassword} disabled={saving}>
                    {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Jelszó beállítása
                  </PrimaryButton>
                  <SecondaryButton onClick={() => { setShowPasswordChange(false); setNewPassword(''); }}>
                    Mégse
                  </SecondaryButton>
                </div>
              </div>
            )}
            {passwordChangeMessage && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2 text-sm text-green-900">
                <Check className="w-4 h-4 inline mr-1" />
                {passwordChangeMessage}
              </div>
            )}
          </div>
        )}

        <Field label={`Gyerek(ek) — ${linkedChildIds.length} kiválasztva`}>
          {competitors.length === 0 ? (
            <div className="text-sm text-gray-500 italic p-3 border border-dashed rounded-lg">
              Még nincs aktív versenyző. Először vegyél fel versenyzőket.
            </div>
          ) : (
            <div className="border rounded-lg max-h-48 overflow-y-auto" style={{ borderColor: COLORS.gray200 }}>
              {competitors.map(c => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                  style={{ borderColor: COLORS.gray200 }}
                >
                  <input
                    type="checkbox"
                    checked={linkedChildIds.includes(c.id)}
                    onChange={() => toggleChild(c.id)}
                    style={{ accentColor: COLORS.blue }}
                  />
                  <span className="text-sm">
                    {formatCompetitorName(c)}
                    <span className="text-gray-500 text-xs ml-1">({c.kategoria}, {c.birth_year})</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </Field>

        <ErrorBox>{error}</ErrorBox>

        <div className="flex gap-2 pt-2">
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

function CredentialsPopup({ creds, onClose }) {
  const [copied, setCopied] = useState(false);
  
  const copyText = `Csepel SC RG Pontregiszter — Belépési adatok\n\nNév: ${creds.name}\nEmail: ${creds.email}\nJelszó: ${creds.password}\n\nLink: https://csepel-pontregiszter.vercel.app\n\nKérjük első belépéskor változtasd meg a jelszót!`;

  const copy = () => {
    navigator.clipboard.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center gap-2 mb-3">
          <Check className="w-6 h-6 text-green-600" />
          <h3 className="text-lg font-bold" style={{ color: COLORS.blueDark }}>
            Fiók létrehozva!
          </h3>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-900">
          <strong>Tipp:</strong> Másold ki az adatokat és küldd át a felhasználónak (email/SMS/papír). 
          A jelszót később is megváltoztathatod a Szerkesztés panelen.
        </div>

        <div className="space-y-2 mb-4">
          <div className="bg-gray-50 rounded p-3">
            <div className="text-xs text-gray-500 mb-1">Email</div>
            <div className="font-mono text-sm" style={{ color: COLORS.blueDark }}>{creds.email}</div>
          </div>
          <div className="bg-gray-50 rounded p-3">
            <div className="text-xs text-gray-500 mb-1">Jelszó</div>
            <div className="font-mono text-lg font-bold" style={{ color: COLORS.blueDark }}>{creds.password}</div>
          </div>
        </div>

        <div className="flex gap-2">
          <PrimaryButton onClick={copy} className="flex-1 justify-center">
            {copied ? <><Check className="w-4 h-4" /> Másolva!</> : <><Copy className="w-4 h-4" /> Üzenet másolása</>}
          </PrimaryButton>
          <SecondaryButton onClick={onClose}>Bezárás</SecondaryButton>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EDZŐK
// ═══════════════════════════════════════════════════════════════════

function AdminStaff({ supabase, userRole, dataReloadKey }) {
  const [staff, setStaff] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);
  const [generatedCreds, setGeneratedCreds] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    // Edzői fiókok + szulo_admin fiókok (nem a sima admin)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['vezetoedzo', 'edzo', 'segededzo', 'szulo_admin'])
      .order('full_name');
    if (error) setError(error.message);
    else setStaff(data);
  }, [supabase]);

  useEffect(() => { load(); }, [load, dataReloadKey]);

  if (editing !== null) {
    return (
      <StaffForm
        supabase={supabase}
        member={editing === 'new' ? null : editing}
        userRole={userRole}
        onSaved={(creds) => { setEditing(null); load(); if (creds) setGeneratedCreds(creds); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  if (staff === null) {
    return <div className="text-center py-8"><Loader className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>;
  }

  return (
    <div>
      {generatedCreds && <CredentialsPopup creds={generatedCreds} onClose={() => setGeneratedCreds(null)} />}

      <div className="flex justify-between items-center mb-3">
        <span className="text-sm text-gray-600">{staff.length} edző / admin</span>
        <PrimaryButton onClick={() => setEditing('new')}>
          <UserPlus className="w-4 h-4" /> Új edző / admin
        </PrimaryButton>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-xs text-blue-900">
        <strong>Megjegyzés:</strong> Az edzők automatikusan minden klubversenyzőt látnak. 
        A szülő-admin egyszerre admin jogú és saját gyerekeit is látja.
      </div>

      <ErrorBox>{error}</ErrorBox>

      {staff.length === 0 ? (
        <div className="text-center text-gray-500 py-8 text-sm">Még nincs edző fiók.</div>
      ) : (
        <div className="space-y-2">
          {staff.map(s => (
            <div key={s.id} className="border rounded-lg p-3 flex items-center justify-between hover:bg-gray-50"
                 style={{ borderColor: COLORS.gray200 }}>
              <div>
                <div className="font-semibold" style={{ color: COLORS.blueDark }}>{s.full_name}</div>
                <div className="text-xs text-gray-500">{s.email} · {ROLE_LABELS[s.role] || s.role}</div>
              </div>
              <button onClick={() => setEditing(s)} className="p-2 text-gray-600 hover:bg-white rounded">
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StaffForm({ supabase, member, userRole, onSaved, onCancel }) {
  const isNew = !member;
  const [form, setForm] = useState({
    full_name: member?.full_name || '',
    email: member?.email || '',
    role: member?.role || 'edzo',
    titulus: member?.titulus || '',
    password: ''  // ÚJ: manuális jelszó
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [passwordChangeMessage, setPasswordChangeMessage] = useState(null);

  // Csak admin (nem szulo_admin) hozhat létre szulo_admin fiókot
  const canCreateSzuloAdmin = userRole === 'admin';

  const validatePassword = (pwd) => {
    if (!pwd || pwd.length < 6) return 'A jelszó legalább 6 karakter legyen';
    if (!/\d/.test(pwd)) return 'A jelszó legalább 1 számot tartalmazzon';
    return null;
  };

  const save = async () => {
    setError(null);
    if (!(form.full_name || '').trim() || !(form.email || '').trim()) {
      setError('Név és email kötelező');
      return;
    }
    
    // ÚJ: új fióknál kötelező a jelszó
    if (isNew) {
      const pwdError = validatePassword(form.password);
      if (pwdError) {
        setError(pwdError);
        return;
      }
    }

    setSaving(true);
    try {
      if (isNew) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Nincs aktív session');
        
        const response = await fetch(
          `${supabase.supabaseUrl}/functions/v1/create-user`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              email: (form.email || '').trim(),
              full_name: (form.full_name || '').trim(),
              role: form.role,
              titulus: (form.titulus || '').trim() || null,
              password: form.password  // ÚJ
            })
          }
        );
        
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Felhasználó létrehozása sikertelen');
        }
      } else {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: (form.full_name || '').trim(),
            role: form.role,
            titulus: (form.titulus || '').trim() || null
          })
          .eq('id', member.id);
        if (error) throw error;
      }

      onSaved(isNew ? { 
        email: (form.email || '').trim(), 
        password: form.password,
        name: (form.full_name || '').trim()
      } : null);
    } catch (err) {
      setError('Mentés sikertelen: ' + err.message);
      setSaving(false);
    }
  };

  // ÚJ: jelszó változtatás meglévő fiókhoz
  const changePassword = async () => {
    setError(null);
    setPasswordChangeMessage(null);
    
    const pwdError = validatePassword(newPassword);
    if (pwdError) {
      setError(pwdError);
      return;
    }
    
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nincs aktív session');
      
      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/change-password`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: member.id,
            new_password: newPassword
          })
        }
      );
      
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Jelszó módosítása sikertelen');
      }
      
      setPasswordChangeMessage(`Jelszó sikeresen módosítva. Új jelszó: ${newPassword}`);
      setNewPassword('');
      setShowPasswordChange(false);
    } catch (err) {
      setError('Jelszó módosítás sikertelen: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h3 className="font-semibold" style={{ color: COLORS.blueDark }}>
          {isNew ? 'Új edző / admin' : 'Szerkesztés'}
        </h3>
      </div>

      {isNew && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-900">
          <strong>Új fiók:</strong> add meg a jelszót (min. 6 karakter, min. 1 szám), 
          és továbbítsd a felhasználónak.
        </div>
      )}

      <div className="space-y-3">
        <Field label="Teljes név *">
          <Input value={form.full_name} onChange={(e) => setForm({...form, full_name: e.target.value})} />
        </Field>
        <Field label="Email *">
          <Input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} 
                 disabled={!isNew} />
        </Field>
        
        {isNew && (
          <Field label="Jelszó * (min. 6 karakter, min. 1 szám)">
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({...form, password: e.target.value})}
                placeholder="pl. csepel123"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>
        )}
        
        <Field label="Szerepkör" hint={form.role === 'szulo_admin' ? 'Admin jog + saját gyerekek látása. A gyerekeket a Szülők fülön rendelheted hozzá.' : null}>
          <Select value={form.role} onChange={(e) => setForm({...form, role: e.target.value})}>
            <option value="vezetoedzo">Vezetőedző</option>
            <option value="edzo">Edző</option>
            <option value="segededzo">Segédedző</option>
            {canCreateSzuloAdmin && <option value="szulo_admin">Szülő-admin</option>}
          </Select>
        </Field>
        <Field label="Titulus (opcionális)">
          <Input value={form.titulus} onChange={(e) => setForm({...form, titulus: e.target.value})} 
                 placeholder="pl. balett-edző, koreográfus" />
        </Field>

        {/* ÚJ: jelszó módosítása meglévő fióknál */}
        {!isNew && (
          <div className="border-t pt-3" style={{ borderColor: COLORS.gray200 }}>
            {!showPasswordChange ? (
              <SecondaryButton onClick={() => setShowPasswordChange(true)}>
                <Eye className="w-4 h-4" /> Jelszó megváltoztatása
              </SecondaryButton>
            ) : (
              <div className="space-y-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="text-sm font-medium text-amber-900">
                  Új jelszó (min. 6 karakter, min. 1 szám):
                </div>
                <div className="relative">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="új jelszó"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex gap-2">
                  <PrimaryButton onClick={changePassword} disabled={saving}>
                    {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Jelszó beállítása
                  </PrimaryButton>
                  <SecondaryButton onClick={() => { setShowPasswordChange(false); setNewPassword(''); }}>
                    Mégse
                  </SecondaryButton>
                </div>
              </div>
            )}
            {passwordChangeMessage && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2 text-sm text-green-900">
                <Check className="w-4 h-4 inline mr-1" />
                {passwordChangeMessage}
              </div>
            )}
          </div>
        )}

        <ErrorBox>{error}</ErrorBox>

        <div className="flex gap-2 pt-2">
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
// KAPCSOLATOK ÁTTEKINTÉS
// ═══════════════════════════════════════════════════════════════════

function AdminLinks({ supabase, dataReloadKey }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: parents }, { data: competitors }, { data: links }] = await Promise.all([
          supabase.from('profiles').select('id, full_name, email, role').in('role', ['szulo', 'szulo_admin']).order('full_name'),
          supabase.from('competitors').select('id, full_name, nickname, kategoria, birth_year, is_active').order('full_name'),
          supabase.from('parent_child_links').select('parent_user_id, competitor_id')
        ]);
        setData({ parents: parents || [], competitors: competitors || [], links: links || [] });
      } catch (err) {
        setError(err.message);
      }
    };
    load();
  }, [supabase, dataReloadKey]);

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (data === null) return <div className="text-center py-8"><Loader className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>;

  return (
    <div>
      <h3 className="font-semibold mb-3" style={{ color: COLORS.blueDark }}>
        Szülő-gyerek kapcsolatok
      </h3>
      
      {data.links.length === 0 ? (
        <div className="text-center text-gray-500 py-8 text-sm">
          Még nincsenek kapcsolatok. Szerkeszd a szülő vagy versenyző profilját.
        </div>
      ) : (
        <div className="space-y-3">
          {data.parents.map(parent => {
            const childIds = data.links
              .filter(l => l.parent_user_id === parent.id)
              .map(l => l.competitor_id);
            const children = data.competitors.filter(c => childIds.includes(c.id));
            if (children.length === 0) return null;
            return (
              <div key={parent.id} className="border rounded-lg p-3" style={{ borderColor: COLORS.gray200 }}>
                <div className="flex items-center gap-2 font-semibold text-sm mb-2"
                     style={{ color: COLORS.blueDark }}>
                  <Heart className="w-4 h-4" style={{ color: COLORS.blue }} />
                  {parent.full_name}
                  {parent.role === 'szulo_admin' && (
                    <span className="text-xs px-2 py-0.5 rounded font-normal"
                          style={{ backgroundColor: COLORS.blue, color: 'white' }}>
                      Admin
                    </span>
                  )}
                  <span className="text-xs text-gray-500 font-normal">({parent.email})</span>
                </div>
                <div className="ml-6 space-y-1">
                  {children.map(c => (
                    <div key={c.id} className="text-sm text-gray-700 flex items-center gap-2">
                      <ChevronRight className="w-3 h-3 text-gray-400" />
                      <span style={{ opacity: c.is_active ? 1 : 0.5 }}>
                        {formatCompetitorName(c)}
                        <span className="text-xs text-gray-500 ml-1">
                          ({c.kategoria}, {c.birth_year})
                          {!c.is_active && ' · inaktív'}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPETITORS PUBLIC VIEW (a Versenyzők navfül-höz)
// ═══════════════════════════════════════════════════════════════════

export function CompetitorsView({ supabase, dataReloadKey }) {
  const [competitors, setCompetitors] = useState(null);
  const [filter, setFilter] = useState({ kategoria: 'all', search: '' });

  useEffect(() => {
    supabase
      .from('competitors')
      .select('*')
      .eq('is_active', true)
      .order('full_name')
      .then(({ data }) => setCompetitors(data || []));
  }, [supabase, dataReloadKey]);

  if (competitors === null) {
    return <div className="text-center py-8"><Loader className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>;
  }

  const filtered = competitors.filter(c => {
    if (filter.kategoria !== 'all' && c.kategoria !== filter.kategoria) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (!c.full_name.toLowerCase().includes(q) && 
          !(c.nickname || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });
  
  // Csoportosítás: ideiglenes vs végleges
  const provisional = filtered.filter(c => c.is_provisional);
  const finalized = filtered.filter(c => !c.is_provisional);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4" style={{ color: COLORS.blueDark }}>
        Versenyzők
      </h2>
      
      {competitors.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center shadow-sm">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <div className="font-semibold text-gray-700 mb-1">Még nincs aktív versenyző</div>
          <div className="text-sm text-gray-500">Az adminisztrátor adhat hozzá versenyzőket.</div>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Keresés..."
                value={filter.search}
                onChange={(e) => setFilter({...filter, search: e.target.value})}
                className="pl-9"
              />
            </div>
            <Select
              value={filter.kategoria}
              onChange={(e) => setFilter({...filter, kategoria: e.target.value})}
              style={{ width: 'auto' }}
            >
              <option value="all">Minden kat.</option>
              {KATEGORIAK.map(k => <option key={k} value={k}>{k}</option>)}
            </Select>
          </div>

          <div className="text-sm text-gray-600 mb-3">
            {filtered.length} / {competitors.length} versenyző
            {provisional.length > 0 && (
              <span className="ml-2 text-amber-700">· {provisional.length} ideiglenes</span>
            )}
          </div>

          {/* Ideiglenes profilok szekció */}
          {provisional.length > 0 && (
            <div className="mb-4 border-2 rounded-lg overflow-hidden" style={{ borderColor: '#f59e0b' }}>
              <div className="px-3 py-2 text-sm font-semibold flex items-center gap-2"
                   style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                <AlertCircle className="w-4 h-4" />
                Ideiglenes profilok ({provisional.length}) — kiegészítésre vár
              </div>
              <div className="space-y-1 p-2 bg-amber-50">
                {provisional.map(c => {
                  const age = calculateAge(c.birth_date) ?? (new Date().getFullYear() - c.birth_year);
                  return (
                    <div key={c.id} className="bg-white border rounded p-2"
                         style={{ borderColor: '#fbbf24' }}>
                      <div className="font-semibold" style={{ color: COLORS.blueDark }}>
                        {formatCompetitorName(c)} <span className="text-xs text-amber-700 font-normal">⚠ Ideiglenes</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {c.kategoria} · {c.korosztaly} · {age} éves
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Végleges profilok */}
          <div className="space-y-2">
            {finalized.map(c => {
              const age = calculateAge(c.birth_date) ?? (new Date().getFullYear() - c.birth_year);
              return (
                <div key={c.id} className="bg-white border rounded-lg p-3 shadow-sm"
                     style={{ borderColor: COLORS.gray200 }}>
                  <div className="font-semibold" style={{ color: COLORS.blueDark }}>
                    {formatCompetitorName(c)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {c.kategoria} · {c.korosztaly} · {age} éves
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PARENT PROFILE VIEW — szülő látja és szerkesztheti a saját gyerekét
// ═══════════════════════════════════════════════════════════════════

export function ParentProfileView({ supabase, parentUserId, dataReloadKey }) {
  const [children, setChildren] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    // A szülő gyerekei a parent_child_links-ből
    const { data: links, error: linksErr } = await supabase
      .from('parent_child_links')
      .select('competitor_id')
      .eq('parent_user_id', parentUserId);
    
    if (linksErr) {
      setError(linksErr.message);
      return;
    }
    
    if (!links || links.length === 0) {
      setChildren([]);
      return;
    }
    
    const childIds = links.map(l => l.competitor_id);
    const { data: comps, error: compsErr } = await supabase
      .from('competitors')
      .select('*')
      .in('id', childIds)
      .order('full_name');
    
    if (compsErr) {
      setError(compsErr.message);
    } else {
      setChildren(comps || []);
    }
  }, [supabase, parentUserId]);

  useEffect(() => { load(); }, [load, dataReloadKey]);

  if (editing) {
    return (
      <ParentChildEditForm
        supabase={supabase}
        competitor={editing}
        onSaved={() => { setEditing(null); load(); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  if (children === null) {
    return <div className="text-center py-8"><Loader className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4" style={{ color: COLORS.blueDark }}>
        Gyermekeim
      </h2>

      <ErrorBox>{error}</ErrorBox>

      {children.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500 shadow-sm">
          Nincs összerendelt gyermek. Kérd meg az adminisztrátort vagy az edzőt.
        </div>
      ) : (
        <div className="space-y-2">
          {children.map(child => {
            const age = calculateAge(child.birth_date) ?? (new Date().getFullYear() - child.birth_year);
            return (
              <div 
                key={child.id} 
                className="bg-white rounded-lg border p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                style={{ borderColor: COLORS.gray200 }}
                onClick={() => setEditing(child)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold" style={{ color: COLORS.blueDark }}>
                      {formatCompetitorName(child)}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {child.kategoria} · {child.korosztaly} · {age} éves
                    </div>
                    {!child.is_active && (
                      <div className="text-xs text-gray-500 mt-1">Inaktív</div>
                    )}
                  </div>
                  <Edit2 className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
        <strong>Megjegyzés:</strong> Kattints egy gyerekre a profil szerkesztéséhez. 
        Új gyerek hozzárendelését vagy szülők változtatását az adminisztrátortól kérheted.
      </div>
    </div>
  );
}

function ParentChildEditForm({ supabase, competitor, onSaved, onCancel }) {
  const [form, setForm] = useState({
    full_name: competitor.full_name,
    nickname: competitor.nickname || '',
    birth_date: competitor.birth_date || '',
    competing_since: competitor.competing_since || '',
    kategoria: competitor.kategoria,
    korosztaly: competitor.korosztaly,
    email: competitor.email || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    setError(null);
    if (!form.full_name.trim()) {
      setError('A név kötelező');
      return;
    }
    if (!form.birth_date) {
      setError('A születési dátum kötelező');
      return;
    }

    setSaving(true);
    try {
      const birthYear = new Date(form.birth_date).getFullYear();
      const { error: updErr } = await supabase
        .from('competitors')
        .update({
          full_name: form.full_name.trim(),
          nickname: form.nickname.trim() || null,
          birth_date: form.birth_date,
          birth_year: birthYear,
          competing_since: form.competing_since || null,
          kategoria: form.kategoria,
          korosztaly: form.korosztaly,
          email: form.email.trim() || null
        })
        .eq('id', competitor.id);
      
      if (updErr) throw updErr;
      onSaved();
    } catch (err) {
      setError('Mentés sikertelen: ' + err.message);
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-xl font-bold" style={{ color: COLORS.blueDark }}>
          {formatCompetitorName(competitor)}
        </h2>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3 shadow-sm"
           style={{ borderColor: COLORS.gray200 }}>
        <Field label="Teljes név *">
          <Input
            type="text"
            value={form.full_name}
            onChange={(e) => setForm({...form, full_name: e.target.value})}
          />
        </Field>

        <Field label="Becenév" hint='Megjelenítés: Vezetéknév "Becenév" Keresztnév'>
          <Input
            type="text"
            value={form.nickname}
            onChange={(e) => setForm({...form, nickname: e.target.value})}
          />
        </Field>

        <Field label="Születési dátum *">
          <Input
            type="date"
            value={form.birth_date}
            onChange={(e) => setForm({...form, birth_date: e.target.value})}
            max={new Date().toISOString().split('T')[0]}
            min="2000-01-01"
          />
        </Field>

        <Field label="Versenyez óta (opcionális)">
          <Input
            type="date"
            value={form.competing_since}
            onChange={(e) => setForm({...form, competing_since: e.target.value})}
            max={new Date().toISOString().split('T')[0]}
            min={form.birth_date || '2000-01-01'}
          />
          <div className="text-xs text-gray-500 mt-1">
            Mióta versenyez aktívan
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Kategória">
            <Select value={form.kategoria} onChange={(e) => setForm({...form, kategoria: e.target.value})}>
              {KATEGORIAK.map(k => <option key={k}>{k}</option>)}
            </Select>
          </Field>
          <Field label="Korosztály">
            <Select value={form.korosztaly} onChange={(e) => setForm({...form, korosztaly: e.target.value})}>
              {KOROSZTALYOK.map(k => <option key={k}>{k}</option>)}
            </Select>
          </Field>
        </div>
        <div className="text-xs text-gray-500 -mt-1">
          A kategória/korosztály változás automatikusan rögzítésre kerül a fejlődési előzményben.
        </div>

        <Field label="Email (opcionális)">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({...form, email: e.target.value})}
          />
        </Field>

        {/* Csapat-eredmények */}
        {competitor?.id && (
          <CompetitorTeamResults supabase={supabase} competitorId={competitor.id} />
        )}

        {/* Korábbi eredmények */}
        {competitor?.id && (
          <CompetitorHistoricalResults supabase={supabase} competitorId={competitor.id} userRole="szulo" />
        )}

        {/* Edzések */}
        {competitor?.id && (
          <CompetitorTrainingHistory supabase={supabase} competitorId={competitor.id} />
        )}

        <ErrorBox>{error}</ErrorBox>

        <div className="flex gap-2 pt-2">
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
// CSAPAT-EREDMÉNYEK KOMPONENS (v0.9.2)
// Megjelenik a versenyző adatlapján: minden csapat ahol részt vett
// ═══════════════════════════════════════════════════════════════════

function CompetitorTeamResults({ supabase, competitorId }) {
  const [teams, setTeams] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setError(null);
      try {
        // Lekérdezzük a csapatokat amikben a versenyző részt vett
        // + a versenyek nevét és dátumát
        const { data, error: err } = await supabase
          .from('competition_team_members')
          .select(`
            id,
            position,
            team:team_id (
              id, name, age_range, placement, score, notes,
              competition:competition_id (id, name, start_date, end_date)
            )
          `)
          .eq('competitor_id', competitorId);
        if (err) throw err;
        if (active) setTeams(data || []);
      } catch (err) {
        if (active) setError(err.message);
      }
    })();
    return () => { active = false; };
  }, [supabase, competitorId]);

  if (teams === null && !error) return null; // betöltés alatt, semmi

  return (
    <div className="rounded-lg p-3 border" style={{ borderColor: COLORS.gray200, backgroundColor: '#fafafa' }}>
      <div className="flex items-center gap-2 mb-2">
        <Trophy className="w-4 h-4" style={{ color: COLORS.amber || '#B45309' }} />
        <span className="font-semibold text-sm">Csapat-eredmények ({teams?.length || 0})</span>
      </div>
      
      {error && (
        <div className="text-xs text-red-600">Hiba a betöltéskor: {error}</div>
      )}
      
      {teams?.length === 0 && !error && (
        <div className="text-xs text-gray-500 italic">Még nincs rögzített csapat-eredmény.</div>
      )}
      
      {teams && teams.length > 0 && (
        <div className="space-y-2">
          {teams
            .filter(t => t.team) // a teljesen törölt csapatok kiszűrése
            .sort((a, b) => {
              // Versenyek dátuma szerint csökkenően (legújabb felülre)
              const aDate = a.team.competition?.start_date || '';
              const bDate = b.team.competition?.start_date || '';
              return bDate.localeCompare(aDate);
            })
            .map(tm => {
              const team = tm.team;
              const comp = team.competition;
              const placement = team.placement;
              const placementColor = placement === 1 ? '#B45309' 
                : placement === 2 ? '#6B7280' 
                : placement === 3 ? '#92400E' 
                : COLORS.gray700;
              
              return (
                <div 
                  key={tm.id} 
                  className="bg-white rounded p-2 border-l-4 text-sm"
                  style={{ borderLeftColor: '#BE123C', borderColor: COLORS.gray200, borderWidth: '0.5px', borderStyle: 'solid', borderLeftWidth: '3px' }}
                >
                  <div className="flex items-start justify-between flex-wrap gap-1">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium" style={{ color: '#BE123C' }}>
                        {team.name}
                        {team.age_range && (
                          <span className="text-xs font-normal text-gray-500 ml-2">
                            ({team.age_range})
                          </span>
                        )}
                      </div>
                      {comp && (
                        <div className="text-xs text-gray-600 mt-0.5">
                          {comp.name}
                          {comp.start_date && (
                            <span className="text-gray-400 ml-1">
                              · {comp.start_date}
                            </span>
                          )}
                        </div>
                      )}
                      {team.notes && (
                        <div className="text-xs text-gray-500 italic mt-0.5">{team.notes}</div>
                      )}
                    </div>
                    {placement && (
                      <div className="text-right">
                        <div className="font-bold text-base" style={{ color: placementColor }}>
                          {placement}. hely
                        </div>
                        {team.score && (
                          <div className="text-xs text-gray-500">
                            {parseFloat(team.score).toFixed(3)} pont
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          }
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EDZÉSEK SZEKCIÓ KOMPONENS (v0.9.7)
// Megjelenik a versenyző adatlapján: idei évi összesítő + utolsó alkalmak
// ═══════════════════════════════════════════════════════════════════

function CompetitorTrainingHistory({ supabase, competitorId }) {
  const [yearStats, setYearStats] = useState(null);
  const [previousYearStats, setPreviousYearStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Idei évi összesítő
        const { data: yStats } = await supabase
          .from('v_training_yearly_summary')
          .select('edzes_count, egesznapos_count, tabor_count, total_count')
          .eq('competitor_id', competitorId)
          .eq('year', currentYear)
          .maybeSingle();

        // Tavalyi évi összesítő
        const { data: prevStats } = await supabase
          .from('v_training_yearly_summary')
          .select('edzes_count, egesznapos_count, tabor_count, total_count')
          .eq('competitor_id', competitorId)
          .eq('year', lastYear)
          .maybeSingle();

        // Utolsó 10 alkalom (idei évben)
        const { data: recentSess, error: rErr } = await supabase
          .from('training_attendance')
          .select('id, training_sessions!inner(id, date, session_type, notes)')
          .eq('competitor_id', competitorId)
          .gte('training_sessions.date', `${currentYear}-01-01`)
          .order('training_sessions(date)', { ascending: false })
          .limit(10);
        if (rErr) throw rErr;

        if (!active) return;
        setYearStats(yStats || { edzes_count: 0, egesznapos_count: 0, tabor_count: 0, total_count: 0 });
        setPreviousYearStats(prevStats);
        setRecent(recentSess || []);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [supabase, competitorId, currentYear, lastYear]);

  const getTypeLabel = (type) => {
    if (type === 'edzes') return { label: 'Edzés', color: '#1D4ED8', bg: '#DBEAFE' };
    if (type === 'egesznapos') return { label: 'Egésznapos', color: '#15803D', bg: '#D1FAE5' };
    if (type === 'tabor') return { label: 'Tábor', color: '#B45309', bg: '#FEF3C7' };
    return { label: type, color: COLORS.gray700, bg: '#F3F4F6' };
  };

  if (loading) return null;

  return (
    <div className="rounded-lg p-3 border" style={{ borderColor: COLORS.gray200, backgroundColor: '#fafafa' }}>
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className="w-4 h-4" style={{ color: '#1D4ED8' }} />
        <span className="font-semibold text-sm">Edzések ({currentYear})</span>
      </div>

      {error && (
        <div className="text-xs text-red-600">Hiba a betöltéskor: {error}</div>
      )}

      {/* Idei évi 3 stat kártya */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-white rounded p-2 text-center border" style={{ borderColor: COLORS.gray200 }}>
          <div className="text-xs text-gray-500 mb-0.5">Edzés</div>
          <div className="text-lg font-semibold" style={{ color: '#1D4ED8' }}>{yearStats.edzes_count}</div>
        </div>
        <div className="bg-white rounded p-2 text-center border" style={{ borderColor: COLORS.gray200 }}>
          <div className="text-xs text-gray-500 mb-0.5">Egésznapos</div>
          <div className="text-lg font-semibold" style={{ color: '#15803D' }}>{yearStats.egesznapos_count}</div>
        </div>
        <div className="bg-white rounded p-2 text-center border" style={{ borderColor: COLORS.gray200 }}>
          <div className="text-xs text-gray-500 mb-0.5">Tábor</div>
          <div className="text-lg font-semibold" style={{ color: '#B45309' }}>{yearStats.tabor_count}</div>
        </div>
      </div>

      {/* Tavalyi év (ha van) */}
      {previousYearStats && previousYearStats.total_count > 0 && (
        <div className="text-xs text-gray-500 mb-3">
          {lastYear}: {previousYearStats.edzes_count} edzés · {previousYearStats.egesznapos_count} egésznap · {previousYearStats.tabor_count} tábor
        </div>
      )}

      {/* Utolsó alkalmak */}
      {recent.length > 0 ? (
        <div>
          <div className="text-xs text-gray-500 mb-1">Utolsó alkalmak</div>
          <div className="space-y-1">
            {recent.map(r => {
              const sess = r.training_sessions;
              const meta = getTypeLabel(sess.session_type);
              return (
                <div key={r.id} className="flex items-center gap-2 text-xs bg-white p-1.5 rounded border" style={{ borderColor: COLORS.gray200 }}>
                  <span className="text-gray-500 font-mono min-w-[88px]">{sess.date}</span>
                  <span 
                    className="px-1.5 py-0.5 rounded font-medium"
                    style={{ backgroundColor: meta.bg, color: meta.color }}
                  >
                    {meta.label}
                  </span>
                  {sess.notes && (
                    <span className="text-gray-500 italic flex-1 truncate">{sess.notes}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-xs text-gray-500 italic">
          {currentYear}-ben még nincs rögzített edzés.
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// KORÁBBI EREDMÉNYEK KOMPONENS (v0.9.14)
// Versenyző adatlapján: régi (jellemzően 2026 előtti) eredmények rögzítése
// Szülő is rögzíthet, edző/admin szerkesztheti
// ═══════════════════════════════════════════════════════════════════

const APPARATUS_LIST = [
  { key: 'szabad', label: 'Szabad' },
  { key: 'karika', label: 'Karika' },
  { key: 'labda', label: 'Labda' },
  { key: 'buzogany', label: 'Buzogány' },
  { key: 'szalag', label: 'Szalag' },
  { key: 'kotel', label: 'Kötél' }
];

const COMPETITION_TYPE_LIST = [
  { value: 'egyeni', label: 'Egyéni' },
  { value: 'egyuttes', label: 'Együttes (kéziszer)' },
  { value: 'esztetikus', label: 'Esztétikus csapat gimnasztika' }
];

const VERSENY_BESOROLAS_LIST = [
  { value: 'fig', label: 'FIG nemzetközi' },
  { value: 'mrgsz_mb', label: 'MRGSZ Magyar Bajnokság' },
  { value: 'mrgsz_regional', label: 'MRGSZ Regionális verseny' },
  { value: 'diakolimpia', label: 'Diákolimpia' },
  { value: 'club', label: 'Klubverseny / Kisverseny' },
  { value: 'egyeb', label: 'Egyéb' }
];

function CompetitorHistoricalResults({ supabase, competitorId, userRole }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | item

  const canEdit = ['admin', 'szulo', 'szulo_admin', 'vezetoedzo', 'edzo', 'segededzo'].includes(userRole);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('historical_results')
        .select('*')
        .eq('competitor_id', competitorId)
        .order('year', { ascending: false })
        .order('created_at', { ascending: false });
      if (err) throw err;
      setItems(data || []);
    } catch (err) {
      setError(err.message);
    }
  }, [supabase, competitorId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (item) => {
    if (!window.confirm(`Biztos törlöd? ${item.year} · ${item.competition_name}`)) return;
    try {
      await supabase.from('historical_results').delete().eq('id', item.id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (items === null && !error) return null;

  if (editing !== null) {
    return (
      <HistoricalResultForm
        supabase={supabase}
        competitorId={competitorId}
        item={editing === 'new' ? null : editing}
        existingItems={items || []}
        onSaved={() => { setEditing(null); load(); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="rounded-lg p-3 border" style={{ borderColor: COLORS.gray200, backgroundColor: '#fafafa' }}>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" style={{ color: '#7c3aed' }} />
          <span className="font-semibold text-sm">Korábbi eredmények ({items?.length || 0})</span>
        </div>
        {canEdit && (
          <button
            onClick={() => setEditing('new')}
            className="text-xs px-3 py-1.5 rounded text-white font-medium"
            style={{ backgroundColor: '#7c3aed' }}
          >
            <Plus className="w-3 h-3 inline mr-1" /> Új eredmény
          </button>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-600 mb-2">{error}</div>
      )}

      {items?.length === 0 && !error && (
        <div className="text-xs text-gray-500 italic">Még nincs rögzített korábbi eredmény.</div>
      )}

      <div className="space-y-2">
        {(items || []).map(item => (
          <HistoricalResultCard
            key={item.id}
            item={item}
            onEdit={canEdit ? () => setEditing(item) : null}
            onDelete={canEdit ? () => handleDelete(item) : null}
          />
        ))}
      </div>
    </div>
  );
}

// Egy korábbi eredmény kártyája (megjelenítéshez)
function HistoricalResultCard({ item, onEdit, onDelete }) {
  const typeLabel = COMPETITION_TYPE_LIST.find(t => t.value === item.competition_type)?.label || item.competition_type;
  const besorolas = VERSENY_BESOROLAS_LIST.find(v => v.value === item.importance)?.label;
  const results = item.results || {};
  
  // Csak azok a szerek listáznak amibe írtak adatot
  const visibleApparatuses = APPARATUS_LIST.filter(a => 
    results[a.key] && (results[a.key].placement || results[a.key].score)
  );
  const hasOsszetett = results.osszetett && (results.osszetett.placement || results.osszetett.score);
  const hasCsapat = results.csapat && (results.csapat.placement || results.csapat.score);

  const placementColor = (p) => {
    if (p === 1) return '#B45309';
    if (p === 2) return '#6B7280';
    if (p === 3) return '#92400E';
    return COLORS.gray700;
  };

  return (
    <div className="bg-white rounded p-2.5 border-l-4 text-sm" 
         style={{ borderLeftColor: '#7c3aed', borderColor: COLORS.gray200, borderWidth: '0.5px', borderStyle: 'solid', borderLeftWidth: '3px' }}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="font-medium" style={{ color: '#7c3aed' }}>
            {item.year} · {item.competition_name}
          </div>
          <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-2">
            <span>{typeLabel}</span>
            {besorolas && <span>· {besorolas}</span>}
            {item.kategoria && <span>· {item.kategoria}</span>}
            {item.korosztaly && <span>· {item.korosztaly}</span>}
            {item.team_name && <span>· {item.team_name}</span>}
          </div>
        </div>
        <div className="flex gap-1">
          {onEdit && (
            <button onClick={onEdit} className="p-1 hover:bg-gray-100 rounded" title="Szerkesztés">
              <Edit2 className="w-3.5 h-3.5 text-gray-500" />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="p-1 hover:bg-red-50 rounded" title="Törlés">
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
            </button>
          )}
        </div>
      </div>

      {/* Szerek + Összetett + Csapat — csak amibe írtak */}
      {(visibleApparatuses.length > 0 || hasOsszetett || hasCsapat) && (
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
          {visibleApparatuses.map(a => {
            const r = results[a.key];
            return (
              <div key={a.key} className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded">
                <span className="text-gray-600 min-w-[55px]">{a.label}:</span>
                {r.placement && <span className="font-semibold" style={{ color: placementColor(r.placement) }}>{r.placement}. hely</span>}
                {r.score && <span className="text-gray-500">({r.score})</span>}
              </div>
            );
          })}
          {hasOsszetett && (
            <div className="flex items-center gap-1.5 bg-yellow-50 px-2 py-1 rounded col-span-2 sm:col-span-3">
              <span className="text-gray-600 font-medium min-w-[80px]">Összetett:</span>
              {results.osszetett.placement && <span className="font-semibold" style={{ color: placementColor(results.osszetett.placement) }}>{results.osszetett.placement}. hely</span>}
              {results.osszetett.score && <span className="text-gray-500">({results.osszetett.score})</span>}
            </div>
          )}
          {hasCsapat && (
            <div className="flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded col-span-2 sm:col-span-3">
              <span className="text-gray-600 font-medium min-w-[80px]">Csapat:</span>
              {results.csapat.placement && <span className="font-semibold" style={{ color: placementColor(results.csapat.placement) }}>{results.csapat.placement}. hely</span>}
              {results.csapat.score && <span className="text-gray-500">({results.csapat.score})</span>}
            </div>
          )}
        </div>
      )}

      {item.notes && (
        <div className="text-xs text-gray-500 italic mt-1.5">{item.notes}</div>
      )}
    </div>
  );
}

// Szerkesztő űrlap (új vagy meglévő rekord)
function HistoricalResultForm({ supabase, competitorId, item, existingItems, onSaved, onCancel }) {
  const [form, setForm] = useState({
    year: item?.year ?? new Date().getFullYear() - 1,
    competition_name: item?.competition_name ?? '',
    competition_type: item?.competition_type ?? 'egyeni',
    importance: item?.importance ?? 'club',
    kategoria: item?.kategoria ?? '',
    korosztaly: item?.korosztaly ?? '',
    team_name: item?.team_name ?? '',
    notes: item?.notes ?? '',
    results: item?.results ?? {}
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [nameAutocomplete, setNameAutocomplete] = useState([]);

  // Autocomplete: a megadott évre tartozó már létező verseny nevek
  useEffect(() => {
    if (!form.year) return;
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('historical_results')
          .select('competition_name, importance')
          .eq('year', parseInt(form.year, 10));
        if (!active) return;
        // Egyedi nevek
        const uniqueNames = {};
        (data || []).forEach(r => {
          if (!uniqueNames[r.competition_name]) {
            uniqueNames[r.competition_name] = r.importance;
          }
        });
        setNameAutocomplete(Object.keys(uniqueNames).sort());
      } catch (err) {
        console.error(err);
      }
    })();
    return () => { active = false; };
  }, [supabase, form.year]);

  const updateResult = (key, field, value) => {
    setForm(prev => ({
      ...prev,
      results: {
        ...prev.results,
        [key]: { ...(prev.results[key] || {}), [field]: value }
      }
    }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!form.year || !form.competition_name) {
        throw new Error('Az év és a verseny neve kötelező!');
      }
      const year = parseInt(form.year, 10);
      if (isNaN(year) || year < 2000 || year > 2100) {
        throw new Error('Érvényes évet adj meg (2000-2100)!');
      }

      // Üres results tisztítás: csak azok maradnak amikben van adat
      const cleanResults = {};
      Object.entries(form.results || {}).forEach(([key, val]) => {
        if (val && (val.placement || val.score)) {
          cleanResults[key] = {
            placement: val.placement ? parseInt(val.placement, 10) : null,
            score: val.score ? parseFloat(String(val.score).replace(',', '.')) : null
          };
        }
      });

      const userResp = await supabase.auth.getUser();
      const userId = userResp.data?.user?.id;

      const payload = {
        competitor_id: competitorId,
        year,
        competition_name: form.competition_name.trim(),
        competition_type: form.competition_type,
        importance: form.importance,
        kategoria: form.kategoria || null,
        korosztaly: form.korosztaly || null,
        team_name: form.team_name || null,
        notes: form.notes || null,
        results: cleanResults,
        modified_by: userId,
        modified_at: new Date().toISOString()
      };

      if (item) {
        await supabase.from('historical_results').update(payload).eq('id', item.id);
      } else {
        payload.created_by = userId;
        await supabase.from('historical_results').insert(payload);
      }
      
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg p-3 border-2" style={{ borderColor: '#7c3aed', backgroundColor: '#faf5ff' }}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-sm" style={{ color: '#7c3aed' }}>
          {item ? 'Korábbi eredmény szerkesztése' : 'Új korábbi eredmény'}
        </h4>
        <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Év *">
            <Input
              type="number"
              min="2000"
              max="2100"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
            />
          </Field>
          <Field label="Verseny besorolása *">
            <Select value={form.importance} onChange={(e) => setForm({ ...form, importance: e.target.value })}>
              {VERSENY_BESOROLAS_LIST.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Verseny neve *">
          <Input
            list="comp-names"
            value={form.competition_name}
            onChange={(e) => setForm({ ...form, competition_name: e.target.value })}
            placeholder={nameAutocomplete.length > 0 ? `Pl. ${nameAutocomplete[0]}` : "Pl. Magyar Bajnokság"}
          />
          {nameAutocomplete.length > 0 && (
            <datalist id="comp-names">
              {nameAutocomplete.map(n => <option key={n} value={n} />)}
            </datalist>
          )}
        </Field>

        <Field label="Versenyszám típusa *">
          <Select value={form.competition_type} onChange={(e) => setForm({ ...form, competition_type: e.target.value })}>
            {COMPETITION_TYPE_LIST.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Kategória">
            <Select value={form.kategoria} onChange={(e) => setForm({ ...form, kategoria: e.target.value })}>
              <option value="">— válassz —</option>
              {KATEGORIAK.map(k => <option key={k} value={k}>{k}</option>)}
            </Select>
          </Field>
          <Field label="Korosztály">
            <Select value={form.korosztaly} onChange={(e) => setForm({ ...form, korosztaly: e.target.value })}>
              <option value="">— válassz —</option>
              {KOROSZTALYOK.map(k => <option key={k} value={k}>{k}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Csapat neve (opcionális)">
          <Input
            value={form.team_name}
            onChange={(e) => setForm({ ...form, team_name: e.target.value })}
            placeholder="Pl. Csepel A csapat 2010-2011"
          />
        </Field>

        {/* Eredmények szerenként */}
        <div className="bg-white rounded p-2 mt-2">
          <div className="text-xs font-semibold text-gray-700 mb-2">Eredmények (csak amit be akarsz írni)</div>
          <div className="space-y-1.5">
            {APPARATUS_LIST.map(a => (
              <ApparatusResultRow
                key={a.key}
                label={a.label}
                placement={form.results[a.key]?.placement || ''}
                score={form.results[a.key]?.score || ''}
                onPlacementChange={v => updateResult(a.key, 'placement', v)}
                onScoreChange={v => updateResult(a.key, 'score', v)}
              />
            ))}
            <div className="border-t pt-1.5 mt-1.5">
              <ApparatusResultRow
                label="Összetett"
                placement={form.results.osszetett?.placement || ''}
                score={form.results.osszetett?.score || ''}
                onPlacementChange={v => updateResult('osszetett', 'placement', v)}
                onScoreChange={v => updateResult('osszetett', 'score', v)}
                highlight="yellow"
              />
              <ApparatusResultRow
                label="Csapat"
                placement={form.results.csapat?.placement || ''}
                score={form.results.csapat?.score || ''}
                onPlacementChange={v => updateResult('csapat', 'placement', v)}
                onScoreChange={v => updateResult('csapat', 'score', v)}
                highlight="blue"
              />
            </div>
          </div>
        </div>

        <Field label="Megjegyzés (opcionális)">
          <Input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>

        {error && (
          <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded text-white text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: '#7c3aed' }}
          >
            {saving ? <Loader className="w-4 h-4 animate-spin inline" /> : <Save className="w-4 h-4 inline mr-1" />}
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

function ApparatusResultRow({ label, placement, score, onPlacementChange, onScoreChange, highlight }) {
  const bg = highlight === 'yellow' ? '#fefce8' : highlight === 'blue' ? '#eff6ff' : 'transparent';
  return (
    <div className="flex items-center gap-2 p-1.5 rounded" style={{ backgroundColor: bg }}>
      <span className="text-xs text-gray-700 min-w-[80px]">{label}:</span>
      <input
        type="text"
        inputMode="numeric"
        value={placement}
        onChange={(e) => onPlacementChange(e.target.value)}
        placeholder="hely"
        className="w-16 px-1.5 py-0.5 text-xs border border-gray-300 rounded text-center"
      />
      <input
        type="text"
        inputMode="decimal"
        value={score}
        onChange={(e) => onScoreChange(e.target.value)}
        placeholder="pont"
        className="w-20 px-1.5 py-0.5 text-xs border border-gray-300 rounded"
      />
    </div>
  );
}
