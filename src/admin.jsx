import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, UserPlus, Edit2, Plus, Check, AlertCircle, Heart, Award,
  Save, ArrowLeft, ChevronRight, Loader, Search, Copy,
  ToggleLeft, ToggleRight
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

export const KATEGORIAK = ['VSK I', 'VSK II', 'SZK', 'BNK'];
export const KOROSZTALYOK = ['gyermek', 'serdülő', 'junior', 'felnőtt', 'master'];

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

export function AdminView({ supabase, userRole }) {
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
          {tab === 'competitors' && <AdminCompetitors supabase={supabase} />}
          {tab === 'parents' && <AdminParents supabase={supabase} />}
          {tab === 'staff' && <AdminStaff supabase={supabase} userRole={userRole} />}
          {tab === 'links' && <AdminLinks supabase={supabase} />}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VERSENYZŐK
// ═══════════════════════════════════════════════════════════════════

function AdminCompetitors({ supabase }) {
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

  useEffect(() => { load(); }, [load]);

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
        borderColor: COLORS.gray200,
        opacity: competitor.is_active ? 1 : 0.5
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="font-semibold flex items-center gap-2" style={{ color: COLORS.blueDark }}>
          {formatCompetitorName(competitor)}
          {!competitor.is_active && (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600">Inaktív</span>
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

function CompetitorForm({ supabase, competitor, onSaved, onCancel }) {
  const isNew = !competitor;
  const [form, setForm] = useState(() => {
    if (competitor) {
      return {
        ...competitor,
        birth_date: competitor.birth_date || ''
      };
    }
    return {
      full_name: '',
      nickname: '',
      birth_date: '',
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
      const payload = {
        full_name: form.full_name.trim(),
        nickname: form.nickname.trim() || null,
        birth_date: form.birth_date,
        birth_year: birthYear,
        kategoria: form.kategoria,
        korosztaly: form.korosztaly,
        email: form.email.trim() || null,
        is_active: form.is_active,
        is_club_member: form.is_club_member
      };

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
// SZÜLŐK
// ═══════════════════════════════════════════════════════════════════

function AdminParents({ supabase }) {
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

  useEffect(() => { load(); }, [load]);

  if (editing !== null) {
    return (
      <ParentForm
        supabase={supabase}
        parent={editing === 'new' ? null : editing}
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

function ParentForm({ supabase, parent, onSaved, onCancel }) {
  const isNew = !parent;
  const [form, setForm] = useState({
    full_name: parent?.full_name || '',
    email: parent?.email || ''
  });
  const [competitors, setCompetitors] = useState([]);
  const [linkedChildIds, setLinkedChildIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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

  const save = async () => {
    setError(null);
    if (!form.full_name.trim()) {
      setError('A név kötelező');
      return;
    }
    if (!form.email.trim()) {
      setError('Az email kötelező');
      return;
    }

    setSaving(true);
    try {
      let userId = parent?.id;
      let generatedPassword = null;

      if (isNew) {
        // Új user: Edge Function-ön keresztül (admin sessionje érintetlen marad)
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
              role: 'szulo'
            })
          }
        );
        
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Felhasználó létrehozása sikertelen');
        }
        
        userId = result.user_id;
        generatedPassword = result.password;
      } else {
        // Frissítés: csak a profile-t
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: form.full_name.trim(),
            email: form.email.trim()
          })
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

      onSaved(generatedPassword ? { 
        email: form.email.trim(), 
        password: generatedPassword,
        name: form.full_name.trim()
      } : null);
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
        <h3 className="font-semibold" style={{ color: COLORS.blueDark }}>
          {isNew ? 'Új szülő fiók' : 'Szülő szerkesztése'}
        </h3>
      </div>

      {isNew && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-900">
          <strong>Új szülő fiók:</strong> a mentés után megjelenik egy biztonságos generált jelszó, 
          amit egyszer látsz. Másold ki, és add át a szülőnek (email/SMS/papír).
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
            value={form.email}
            onChange={(e) => setForm({...form, email: e.target.value})}
            disabled={!isNew}
            placeholder="szulo@example.com"
          />
        </Field>

        {isNew && (
          <div className="text-xs bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-900">
            <strong>Jelszó:</strong> Mentés után automatikusan generálódik egy biztonságos jelszó, 
            ami megjelenik a képernyőn — másold ki és add át a szülőnek.
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
        
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mb-4 text-sm text-amber-900">
          <strong>FONTOS:</strong> Ez a jelszó CSAK MOST jelenik meg. Másold ki és küldd el a szülőnek
          (email/SMS/papír). A bezárás után már nem tudod visszanézni!
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

function AdminStaff({ supabase, userRole }) {
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

  useEffect(() => { load(); }, [load]);

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
    titulus: member?.titulus || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Csak admin (nem szulo_admin) hozhat létre szulo_admin fiókot
  const canCreateSzuloAdmin = userRole === 'admin';

  const save = async () => {
    setError(null);
    if (!form.full_name.trim() || !form.email.trim()) {
      setError('Név és email kötelező');
      return;
    }

    setSaving(true);
    try {
      let generatedPassword = null;

      if (isNew) {
        // Új user: Edge Function-ön keresztül (admin sessionje érintetlen marad)
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
              titulus: form.titulus.trim() || null
            })
          }
        );
        
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Felhasználó létrehozása sikertelen');
        }
        
        generatedPassword = result.password;
      } else {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: form.full_name.trim(),
            role: form.role,
            titulus: form.titulus.trim() || null
          })
          .eq('id', member.id);
        if (error) throw error;
      }

      onSaved(generatedPassword ? { 
        email: form.email.trim(), 
        password: generatedPassword,
        name: form.full_name.trim()
      } : null);
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
        <h3 className="font-semibold" style={{ color: COLORS.blueDark }}>
          {isNew ? 'Új edző / admin' : 'Szerkesztés'}
        </h3>
      </div>

      {isNew && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-900">
          <strong>Új fiók:</strong> a mentés után megjelenik egy biztonságos generált jelszó, 
          amit egyszer látsz. Másold ki, és add át a felhasználónak.
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

function AdminLinks({ supabase }) {
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
  }, [supabase]);

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

export function CompetitorsView({ supabase }) {
  const [competitors, setCompetitors] = useState(null);
  const [filter, setFilter] = useState({ kategoria: 'all', search: '' });

  useEffect(() => {
    supabase
      .from('competitors')
      .select('*')
      .eq('is_active', true)
      .order('full_name')
      .then(({ data }) => setCompetitors(data || []));
  }, [supabase]);

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
          </div>

          <div className="space-y-2">
            {filtered.map(c => {
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

export function ParentProfileView({ supabase, parentUserId }) {
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

  useEffect(() => { load(); }, [load]);

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
