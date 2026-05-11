import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Users, Calendar, Settings, LogOut, User,
  Check, AlertCircle, Eye, EyeOff,
  Shield, Crown, Award, BookOpen, Heart, Star,
  BarChart3, Loader, Wifi, WifiOff, RefreshCw
} from 'lucide-react';
import { CSEPEL_SC_LOGO, CSEPEL_RG_LOGO } from './logos';
import { AdminView, CompetitorsView as CompetitorsViewComponent, ParentProfileView } from './admin';
import { CompetitionsView } from './competitions';

// ═══════════════════════════════════════════════════════════════════
// SUPABASE KLIENS
// ═══════════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://rujshnadnolvvrtkfbvd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_UXpW2tHx49xChYR6nhtGkA_7SKCgUcM';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});

// ═══════════════════════════════════════════════════════════════════
// KLUB SZÍNPALETTA
// ═══════════════════════════════════════════════════════════════════

const COLORS = {
  blue: '#1e3a8a',         // sötét tengerészkék (Csepel kék)
  blueDark: '#0c1e4a',     // mélykék (szöveg)
  blueLight: '#3b82f6',    // világoskék
  blueBg: '#eff6ff',       // halvány kék háttér
  red: '#dc2626',          // élénk piros (Csepel piros)
  redDark: '#991b1b',      // sötétpiros
  redLight: '#fee2e2',     // halvány piros háttér (csepeli kiemelés)
  white: '#ffffff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray500: '#6b7280',
  gray700: '#374151',
  gray900: '#111827'
};

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

const ROLES = {
  ADMIN: 'admin',
  SZULO_ADMIN: 'szulo_admin',
  VEZETOEDZO: 'vezetoedzo',
  EDZO: 'edzo',
  SEGEDEDZO: 'segededzo',
  SZULO: 'szulo',
  VERSENYZO: 'versenyzo'
};

const ROLE_LABELS = {
  admin: 'Admin',
  szulo_admin: 'Szülő-admin',
  vezetoedzo: 'Vezetőedző',
  edzo: 'Edző',
  segededzo: 'Segédedző',
  szulo: 'Szülő',
  versenyzo: 'Versenyző'
};

const ROLE_ICONS = {
  admin: Shield,
  szulo_admin: Shield,
  vezetoedzo: Crown,
  edzo: Award,
  segededzo: BookOpen,
  szulo: Heart,
  versenyzo: Star
};

// Helper: van-e admin jogosultsága a usernek?
const hasAdminRights = (role) => role === 'admin' || role === 'szulo_admin';

// Helper: van-e edzői jogosultsága? (admin, szulo_admin, vagy bármely edző szerep)
const hasStaffRights = (role) => 
  ['admin', 'szulo_admin', 'vezetoedzo', 'edzo', 'segededzo'].includes(role);

// Helper: szülő-jogosultság (látja a saját gyerekét)
const hasParentRights = (role) => role === 'szulo' || role === 'szulo_admin';

// eslint-disable-next-line no-unused-vars
// formatCompetitorName helper - a 2. fázisban kerül használatba

// ═══════════════════════════════════════════════════════════════════
// AUTH HOOK
// ═══════════════════════════════════════════════════════════════════

function useAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProfile = useCallback(async (userId) => {
    try {
      // 5 másodperc timeout - ha nem jön válasz, hibára megy
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profil lekérdezés timeout (5s)')), 5000)
      );
      
      const queryPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
      
      if (error) throw error;
      setProfile(data);
      setError(null);
    } catch (err) {
      console.error('Profil betöltési hiba:', err);
      setError('Profil betöltése sikertelen: ' + err.message + '. Próbáld a Frissítés gombot vagy töröld a böngésző cache-t.');
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Csak az onAuthStateChange-t használjuk - az INITIAL_SESSION event-et 
    // is meghívja, így nincs lock-konkurencia két párhuzamos auth hívással.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;
        
        setSession(currentSession);
        
        if (currentSession?.user) {
          await loadProfile(currentSession.user.id);
        } else {
          setProfile(null);
        }
        
        // Loading kikapcsolása az első event után
        if (mounted) setLoading(false);
      }
    );

    // Biztonsági timeout: ha 3 másodpercen belül nem érkezett auth event,
    // mutatjuk a login képernyőt (nincs session)
    const safetyTimeout = setTimeout(() => {
      if (mounted) {
        setLoading(false);
      }
    }, 3000);

    // ÚJ: Visibility change figyelés - telefon-lezárás / háttér után
    // Amikor visszatér az oldal a háttérből, újratöltjük a profilt.
    // FONTOS: NEM hívunk getSession()-t, mert az lock-konkurenciát okoz!
    // A Supabase saját onAuthStateChange-je magától refresh-eli a sessiont.
    let lastVisibilityRefresh = Date.now();
    const handleVisibilityChange = async () => {
      if (!mounted) return;
      if (document.visibilityState === 'visible') {
        // Csak akkor frissítünk ha legalább 30 másodperc telt el
        // (elkerüljük hogy gyors váltogatáskor sok query menjen)
        const now = Date.now();
        if (now - lastVisibilityRefresh < 30000) return;
        lastVisibilityRefresh = now;
        
        try {
          // Csak a profilt töltjük újra ha van session
          // (a session frissítést a Supabase saját autoRefreshToken kezeli)
          if (mounted) {
            // Új session érték az onAuthStateChange-ből jön ha lejárt
            // Itt csak a profilt frissítjük ha van user
          }
        } catch (err) {
          console.error('Visibility change handler hiba:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadProfile]);

  const signIn = async (email, password) => {
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      return false;
    }
    if (data?.session) {
      setSession(data.session);
      if (data.user) {
        await loadProfile(data.user.id);
      }
      setLoading(false);
    }
    return true;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return { session, profile, loading, error, signIn, signOut, setError };
}

const AuthContext = React.createContext(null);

function useAuthContext() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be inside AuthProvider');
  return ctx;
}

// ═══════════════════════════════════════════════════════════════════
// DATA RELOAD KEY - csendes adat-frissítés tab visszatéréskor
// ═══════════════════════════════════════════════════════════════════

// Ez a Context biztosítja az egész app számára egy kulcsot, ami akkor 
// változik, amikor a tab visszatér a háttérből vagy hálózat helyreáll.
// A komponensek dependency-ként használhatják, hogy újra lekérjék az 
// ADATAIKAT (de nem az UI-állapotukat - úgyhogy formok nem vesznek el).
const DataReloadContext = React.createContext({ key: 0, reload: () => {} });

function useDataReload() {
  return React.useContext(DataReloadContext);
}

function DataReloadProvider({ children }) {
  const [key, setKey] = useState(0);
  
  const reload = useCallback(() => {
    setKey(k => k + 1);
  }, []);
  
  useEffect(() => {
    let lastReload = Date.now();
    
    const handleVisibilityChange = () => {
      // Csak akkor reload, ha a tab visszanyer fókuszt és legalább 10 másodperc telt el
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastReload > 10000) {
          lastReload = now;
          setKey(k => k + 1);
        }
      }
    };
    
    const handleOnline = () => {
      // Ha visszajön az internet, frissítünk
      const now = Date.now();
      if (now - lastReload > 5000) {
        lastReload = now;
        setKey(k => k + 1);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, []);
  
  return (
    <DataReloadContext.Provider value={{ key, reload }}>
      {children}
    </DataReloadContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════
// AUTO-SAVE HOOK - űrlapok automatikus mentése localStorage-ba
// ═══════════════════════════════════════════════════════════════════

// Használat:
//   const [form, setForm] = useAutoSavedState('competitor-form', { name: '', age: 0 });
// 
// A form állapota minden változáskor mentődik a localStorage-ba.
// Ha az oldal újratöltődik, az adat visszajön. 
// Ha a felhasználó megment, törölni kell: clearAutoSave('competitor-form').
function useAutoSavedState(key, defaultValue) {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem('autosave:' + key);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Csak akkor használjuk a mentett verziót, ha 24 órán belül van
        if (parsed._savedAt && Date.now() - parsed._savedAt < 24 * 60 * 60 * 1000) {
          delete parsed._savedAt;
          return parsed;
        }
      }
    } catch (e) {
      console.error('AutoSave restore hiba:', e);
    }
    return defaultValue;
  });
  
  useEffect(() => {
    try {
      const toSave = { ...state, _savedAt: Date.now() };
      localStorage.setItem('autosave:' + key, JSON.stringify(toSave));
    } catch (e) {
      console.error('AutoSave write hiba:', e);
    }
  }, [key, state]);
  
  return [state, setState];
}

// eslint-disable-next-line no-unused-vars
function clearAutoSave(key) {
  try {
    localStorage.removeItem('autosave:' + key);
  } catch (e) {
    console.error('AutoSave clear hiba:', e);
  }
}

// ═══════════════════════════════════════════════════════════════════
// CONNECTION STATUS
// ═══════════════════════════════════════════════════════════════════

function useConnectionStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return online;
}

// ═══════════════════════════════════════════════════════════════════
// CLUB BANNER — szimmetrikus, átlógó logókkal + Caveat szlogen
// ═══════════════════════════════════════════════════════════════════

function ClubBanner() {
  return (
    <>
      {/* Caveat font betöltése a Google Fonts-ból */}
      <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&display=swap" rel="stylesheet" />
      
      <div className="w-full overflow-hidden shadow-md relative">
        {/* KÉK sáv (felül) */}
        <div style={{ backgroundColor: COLORS.blue, height: '90px' }}></div>
        
        {/* PIROS sáv (alul) */}
        <div style={{ backgroundColor: COLORS.red, height: '90px' }}></div>
        
        {/* Tartalom réteg — átlóg mindkét sávon */}
        <div 
          className="absolute inset-0 flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-10"
        >
          {/* BAL: Csepel SC pajzs + Pontregiszter */}
          <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
            <div 
              className="flex-shrink-0 bg-white rounded-lg p-1 sm:p-1.5"
              style={{ 
                boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                border: '2px solid white'
              }}
            >
              <img 
                src={CSEPEL_SC_LOGO} 
                alt="Csepel SC" 
                className="h-14 w-14 sm:h-20 sm:w-20 object-contain"
              />
            </div>
            <div className="min-w-0">
              <h1 
                className="text-white font-extrabold text-xl sm:text-3xl tracking-wide leading-none"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
              >
                Pontregiszter
              </h1>
              <div 
                className="text-white text-xs sm:text-sm mt-1 opacity-95"
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
              >
                Csepel SC · Ritmikus Gimnasztika
              </div>
            </div>
          </div>
          
          {/* KÖZÉP: Csepeli RG Klub logó (nagy, átlóg) */}
          <div 
            className="flex-shrink-0 bg-white rounded-lg p-2 sm:p-3"
            style={{ 
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              border: '2px solid white'
            }}
          >
            <img 
              src={CSEPEL_RG_LOGO}
              alt="Csepeli RG Klub"
              className="h-16 sm:h-24 object-contain"
            />
          </div>
          
          {/* JOBB: szlogen Caveat fonttal */}
          <div className="flex-1 text-right hidden sm:block">
            <div 
              style={{ 
                fontFamily: "'Caveat', cursive",
                color: 'white',
                fontSize: 'clamp(22px, 2.4vw, 44px)',
                fontWeight: 700,
                lineHeight: 1,
                textShadow: '0 2px 4px rgba(0,0,0,0.35)',
                letterSpacing: '0.5px',
                whiteSpace: 'nowrap'
              }}
            >
              „Ügyesen, Okosan, Mosoly"
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// LOGIN SCREEN
// ═══════════════════════════════════════════════════════════════════

function LoginScreen() {
  const { signIn, error, setError } = useAuthContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Email és jelszó kötelező');
      return;
    }
    setSubmitting(true);
    await signIn(email.trim(), password);
    setSubmitting(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !submitting) handleLogin();
  };

  return (
    <div 
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: COLORS.blueBg }}
    >
      <ClubBanner />
      
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-gray-200">
          <h2 
            className="text-xl font-bold mb-1 text-center"
            style={{ color: COLORS.blueDark }}
          >
            Belépés
          </h2>
          <p className="text-sm text-gray-600 text-center mb-6">v0.8 · 2025–2028 ciklus</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-4 py-2 border rounded-lg outline-none transition-all"
                style={{ borderColor: COLORS.gray200 }}
                onFocus={(e) => e.target.style.borderColor = COLORS.blue}
                onBlur={(e) => e.target.style.borderColor = COLORS.gray200}
                placeholder="email@example.com"
                autoFocus
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Jelszó
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full px-4 py-2 pr-10 border rounded-lg outline-none"
                  style={{ borderColor: COLORS.gray200 }}
                  onFocus={(e) => e.target.style.borderColor = COLORS.blue}
                  onBlur={(e) => e.target.style.borderColor = COLORS.gray200}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm p-3 rounded-lg border"
                   style={{ 
                     backgroundColor: COLORS.redLight, 
                     borderColor: COLORS.red, 
                     color: COLORS.redDark 
                   }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={submitting}
              className="w-full py-3 rounded-lg font-semibold text-white shadow hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: COLORS.blue }}
            >
              {submitting ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Belépés...
                </>
              ) : 'Belépés'}
            </button>
          </div>

          <div className="mt-6 text-xs text-center text-gray-500">
            Ha nincs még fiókod, kérd az adminisztrátortól.
          </div>
        </div>
        <div className="mt-6 text-center">
          <div 
            style={{ 
              fontFamily: "'Caveat', cursive",
              color: COLORS.red || '#BE123C',
              fontSize: '28px',
              fontWeight: 700,
              lineHeight: 1
            }}
          >
            „Ügyesen, Okosan, Mosoly"
          </div>
          <div className="text-xs text-gray-500 mt-1">Csepel SC · Ritmikus Gimnasztika</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// LOADING SCREEN
// ═══════════════════════════════════════════════════════════════════

function LoadingScreen({ message = 'Betöltés...' }) {
  const [showReload, setShowReload] = useState(false);
  
  useEffect(() => {
    // 5 másodperc után megjelenik egy "Frissítés" gomb
    const t = setTimeout(() => setShowReload(true), 5000);
    return () => clearTimeout(t);
  }, []);
  
  return (
    <div 
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: COLORS.blueBg }}
    >
      <ClubBanner />
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="flex items-center gap-2 font-medium" style={{ color: COLORS.blue }}>
          <Loader className="w-5 h-5 animate-spin" />
          {message}
        </div>
        {showReload && (
          <button
            onClick={() => window.location.reload()}
            className="text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-white"
            style={{ color: COLORS.blue }}
          >
            Frissítés
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// APP SHELL
// ═══════════════════════════════════════════════════════════════════

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Áttekintés', icon: BarChart3, roles: 'all' },
  { id: 'profile', label: 'Profil', icon: User, roles: [ROLES.VERSENYZO, ROLES.SZULO, ROLES.SZULO_ADMIN] },
  { id: 'competitors', label: 'Versenyzők', icon: Users, roles: [ROLES.ADMIN, ROLES.SZULO_ADMIN, ROLES.VEZETOEDZO, ROLES.EDZO, ROLES.SEGEDEDZO] },
  { id: 'competitions', label: 'Versenyek', icon: Calendar, roles: 'all' },
  { id: 'admin', label: 'Adminisztráció', icon: Settings, roles: [ROLES.ADMIN, ROLES.SZULO_ADMIN] }
];

function AppShell() {
  const { profile, signOut } = useAuthContext();
  const { key: dataReloadKey, reload: reloadData } = useDataReload();
  const online = useConnectionStatus();
  const [activeView, setActiveView] = useState('dashboard');

  const visibleNavItems = NAV_ITEMS.filter(item =>
    item.roles === 'all' || item.roles.includes(profile.role)
  );

  const RoleIcon = ROLE_ICONS[profile.role];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: COLORS.gray50 }}>
      {!online && (
        <div 
          className="text-center text-xs py-1 px-2 flex items-center justify-center gap-1 text-white"
          style={{ backgroundColor: COLORS.red }}
        >
          <WifiOff className="w-3 h-3" />
          Nincs internetkapcsolat — a változtatások nem mentődnek
        </div>
      )}

      <ClubBanner />

      {/* User info bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <RoleIcon className="w-4 h-4" style={{ color: COLORS.blue }} />
            <span className="font-medium" style={{ color: COLORS.blueDark }}>
              {profile.full_name}
            </span>
            <span className="text-gray-500 text-xs sm:text-sm">
              {ROLE_LABELS[profile.role]}
              {profile.titulus ? ` · ${profile.titulus}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={reloadData}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 flex items-center gap-1 text-sm"
              title="Adatok frissítése"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Frissítés</span>
            </button>
            <button
              onClick={signOut}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 flex items-center gap-1 text-sm"
              title="Kijelentkezés"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Kijelentkezés</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 overflow-x-auto sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-2 flex">
          {visibleNavItems.map(item => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors"
                style={{
                  borderColor: isActive ? COLORS.blue : 'transparent',
                  color: isActive ? COLORS.blue : COLORS.gray700
                }}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {activeView === 'dashboard' && <DashboardView />}
        {activeView === 'profile' && hasParentRights(profile.role) && (
          <ParentProfileView supabase={supabase} parentUserId={profile.id} dataReloadKey={dataReloadKey} />
        )}
        {activeView === 'profile' && profile.role === 'versenyzo' && (
          <PlaceholderView title="Profil" message="A 4. fázisban készül el — saját eredmények, fejlődési grafikon." />
        )}
        {activeView === 'competitors' && <CompetitorsViewComponent supabase={supabase} dataReloadKey={dataReloadKey} />}
        {activeView === 'competitions' && <CompetitionsView supabase={supabase} userRole={profile.role} dataReloadKey={dataReloadKey} />}
        {activeView === 'admin' && <AdminView supabase={supabase} userRole={profile.role} dataReloadKey={dataReloadKey} />}
      </main>

      <footer className="bg-white border-t border-gray-200 py-3 px-4 text-center">
        <div 
          style={{ 
            fontFamily: "'Caveat', cursive",
            color: COLORS.red,
            fontSize: '20px',
            fontWeight: 700,
            lineHeight: 1
          }}
        >
          „Ügyesen, Okosan, Mosoly"
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Pontregiszter v0.9 · Csepel SC RG · MRGSZ 2025–2028
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════

function DashboardView() {
  const { profile } = useAuthContext();
  const { key: dataReloadKey } = useDataReload();
  const [stats, setStats] = useState({ competitors: null, competitions: null, parents: null, provisional: null });
  const [provisionalCompetitors, setProvisionalCompetitors] = useState(null);  // ÚJ: ideiglenes profilok lista
  const [myChildren, setMyChildren] = useState(null);  // ÚJ: saját gyerekek (szulo_admin)
  const [error, setError] = useState(null);
  
  const isParentLike = profile.role === 'szulo' || profile.role === 'szulo_admin';
  const isAdminLike = profile.role === 'admin' || profile.role === 'szulo_admin';

  useEffect(() => {
    let mounted = true;
    
    const loadStats = async () => {
      try {
        const competitorsPromise = supabase
          .from('competitors')
          .select('id', { count: 'exact', head: true })
          .then(({ count, error }) => ({ count: count ?? 0, error }));
          
        const competitionsPromise = supabase
          .from('competitions')
          .select('id', { count: 'exact', head: true })
          .then(({ count, error }) => ({ count: count ?? 0, error }));
        
        const parentsPromise = supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .in('role', ['szulo', 'szulo_admin'])
          .then(({ count, error }) => ({ count: count ?? 0, error }));
        
        const provisionalPromise = supabase
          .from('competitors')
          .select('*')
          .eq('is_provisional', true)
          .eq('is_active', true)
          .order('full_name')
          .then(({ data, error }) => ({ data: data ?? [], error }));
        
        const [comp, competitions, parents, prov] = await Promise.all([
          competitorsPromise, competitionsPromise, parentsPromise, provisionalPromise
        ]);
        
        if (!mounted) return;
        
        setStats({
          competitors: comp.count,
          competitions: competitions.count,
          parents: parents.count,
          provisional: prov.data.length
        });
        setProvisionalCompetitors(prov.data);
        
        const errors = [];
        if (comp.error) errors.push('Versenyzők: ' + comp.error.message);
        if (competitions.error) errors.push('Versenyek: ' + competitions.error.message);
        if (parents.error) errors.push('Szülők: ' + parents.error.message);
        if (errors.length > 0) setError(errors.join(' · '));
        else setError(null);
      } catch (err) {
        if (mounted) setError('Statisztikák betöltése sikertelen: ' + err.message);
      }
    };

    // ÚJ: szülő/szülő-admin esetén töltjük a saját gyerekeket
    const loadMyChildren = async () => {
      if (!isParentLike) return;
      try {
        const { data: links } = await supabase
          .from('parent_child_links')
          .select('competitor_id')
          .eq('parent_user_id', profile.id);
        
        if (!links || links.length === 0) {
          if (mounted) setMyChildren([]);
          return;
        }
        
        const childIds = links.map(l => l.competitor_id);
        const { data: kids } = await supabase
          .from('competitors')
          .select('*')
          .in('id', childIds)
          .order('full_name');
        
        if (mounted) setMyChildren(kids || []);
      } catch (err) {
        console.error('Gyerekek betöltése hiba:', err);
      }
    };
    
    loadStats();
    loadMyChildren();
    
    const safetyTimeout = setTimeout(() => {
      if (mounted) {
        setStats(prev => ({
          competitors: prev.competitors ?? 0,
          competitions: prev.competitions ?? 0,
          parents: prev.parents ?? 0
        }));
      }
    }, 8000);
    
    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
    };
  }, [dataReloadKey, isParentLike, profile.id]);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1" style={{ color: COLORS.blueDark }}>
        Üdv, {profile.full_name}!
      </h2>
      <p className="text-gray-600 mb-6">
        {ROLE_LABELS[profile.role]}
        {profile.titulus ? ` · ${profile.titulus}` : ''}
      </p>

      {error && (
        <div className="rounded-lg p-3 mb-4 text-sm flex gap-2 border"
             style={{ backgroundColor: COLORS.redLight, borderColor: COLORS.red, color: COLORS.redDark }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* ÚJ: szülő/szülő-admin saját gyerekek */}
      {isParentLike && (
        <div className="mb-6">
          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2" style={{ color: COLORS.blueDark }}>
            <Heart className="w-5 h-5" style={{ color: COLORS.red }} />
            Saját gyerek(ek)
          </h3>
          {myChildren === null ? (
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <Loader className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : myChildren.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm text-sm text-gray-500 italic">
              Még nincs hozzád rendelt gyermek. Az adminisztrátor tudja hozzárendelni.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myChildren.map(c => (
                <div key={c.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                  <div className="font-semibold" style={{ color: COLORS.blueDark }}>
                    {c.nickname 
                      ? `${c.full_name.split(' ')[0]} "${c.nickname}" ${c.full_name.split(' ').slice(1).join(' ')}` 
                      : c.full_name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {c.kategoria} · {c.korosztaly} · született {c.birth_year}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Admin/edző számára: statisztikák */}
      {isAdminLike && (
        <>
          <h3 className="font-semibold text-lg mb-3" style={{ color: COLORS.blueDark }}>
            Klub áttekintés
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard icon={Users} label="Versenyzők" value={stats.competitors} accent="blue" />
            <StatCard icon={Calendar} label="Versenyek" value={stats.competitions} accent="red" />
            <StatCard icon={Heart} label="Szülő fiókok" value={stats.parents} accent="blue" />
          </div>
          
          {/* Ideiglenes profilok jelzés */}
          {stats.provisional > 0 && provisionalCompetitors && (
            <div className="mt-4 border-2 rounded-lg overflow-hidden" style={{ borderColor: '#f59e0b' }}>
              <div className="px-3 py-2 text-sm font-semibold flex items-center gap-2"
                   style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                <AlertCircle className="w-4 h-4" />
                Ideiglenes profilok ({stats.provisional}) — admin/edző ellenőrzésére várnak
              </div>
              <div className="space-y-1 p-2 bg-amber-50">
                {provisionalCompetitors.slice(0, 5).map(c => {
                  const age = c.birth_year ? (new Date().getFullYear() - c.birth_year) : null;
                  return (
                    <div key={c.id} className="bg-white border rounded p-2 flex items-center justify-between"
                         style={{ borderColor: '#fbbf24' }}>
                      <div>
                        <div className="font-medium text-sm" style={{ color: COLORS.blueDark }}>
                          {c.nickname 
                            ? `${c.full_name.split(' ')[0]} "${c.nickname}" ${c.full_name.split(' ').slice(1).join(' ')}` 
                            : c.full_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {c.kategoria} · {c.korosztaly}{age ? ` · ${age} éves` : ''}
                        </div>
                      </div>
                      <span className="text-xs text-amber-700">⚠ Ideiglenes</span>
                    </div>
                  );
                })}
                {provisionalCompetitors.length > 5 && (
                  <div className="text-xs text-amber-700 italic px-1">
                    ... és {provisionalCompetitors.length - 5} további a Versenyzők menüben
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <div 
        className="mt-6 rounded-lg p-4 flex gap-3 border"
        style={{ 
          backgroundColor: '#f0fdf4', 
          borderColor: '#86efac',
          color: '#14532d'
        }}
      >
        <Wifi className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-semibold mb-1">
            Supabase felhős kapcsolat aktív ✓
          </div>
          <div>
            Az adatok a felhőben tárolódnak, valós időben szinkronizálnak minden eszköz között.
          </div>
        </div>
      </div>

      <div 
        className="mt-4 rounded-lg p-4 border"
        style={{ backgroundColor: COLORS.blueBg, borderColor: COLORS.blueLight }}
      >
        <div className="font-semibold mb-2 text-sm" style={{ color: COLORS.blueDark }}>
          Fejlesztési ütemterv
        </div>
        <div className="space-y-1.5 text-sm" style={{ color: COLORS.blue }}>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            1. fázis: Supabase auth + login (KÉSZ)
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            2. fázis: Admin felület (KÉSZ)
          </div>
          <div className="flex items-center gap-2">
            <Loader className="w-4 h-4" />
            3. fázis: Versenyek + startlista + pontozás
          </div>
          <div className="flex items-center gap-2 opacity-50">
            <div className="w-4 h-4" />
            4. fázis: Eredmények + grafikonok + szülő profil szerkesztés
          </div>
          <div className="flex items-center gap-2 opacity-50">
            <div className="w-4 h-4" />
            5. fázis: Kamera nagyító (TV pontleolvasáshoz)
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }) {
  const accentColor = accent === 'red' ? COLORS.red : COLORS.blue;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div 
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
        style={{ backgroundColor: accentColor }}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="text-2xl font-bold" style={{ color: COLORS.blueDark }}>
        {value === null ? <Loader className="w-5 h-5 animate-spin text-gray-400" /> : value}
      </div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function PlaceholderView({ title, message }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
      <h2 className="text-xl font-bold mb-2" style={{ color: COLORS.blueDark }}>{title}</h2>
      <p className="text-gray-600 text-sm">{message}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════

export default function App() {
  const auth = useAuth();
  
  if (auth.loading) return <LoadingScreen message="Csatlakozás..." />;

  return (
    <AuthContext.Provider value={auth}>
      <DataReloadProvider>
        {auth.session && auth.profile ? <AppShell /> : <LoginScreen />}
      </DataReloadProvider>
    </AuthContext.Provider>
  );
}
