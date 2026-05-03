import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Users, Calendar, Settings, LogOut, User,
  Check, AlertCircle, Eye, EyeOff,
  Shield, Crown, Award, BookOpen, Heart, Star,
  BarChart3, Loader, Wifi, WifiOff
} from 'lucide-react';
import { CSEPEL_SC_LOGO, CSEPEL_RG_LOGO } from './logos';
import { AdminView, CompetitorsView as CompetitorsViewComponent, ParentProfileView } from './admin';

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
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      setProfile(data);
      setError(null);  // sikeres töltéskor töröljük a régi hibát
    } catch (err) {
      console.error('Profile betöltési hiba:', err);
      setError('Profil betöltése sikertelen: ' + err.message);
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
    // Manuálisan is meghívjuk a loadProfile-t és a setSession-t,
    // mert az onAuthStateChange néha nem triggerelődik gyorsan
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
// CLUB BANNER
// ═══════════════════════════════════════════════════════════════════

function ClubBanner() {
  return (
    <div className="w-full overflow-hidden shadow-md">
      {/* Felső sáv - kék */}
      <div 
        className="px-4 py-3 flex items-center gap-3"
        style={{ backgroundColor: COLORS.blue }}
      >
        <img 
          src={CSEPEL_SC_LOGO} 
          alt="Csepel SC" 
          className="h-10 w-10 sm:h-12 sm:w-12 object-contain flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-lg sm:text-2xl tracking-wide leading-tight">
            Pontregiszter
          </h1>
          <div className="text-blue-100 text-xs sm:text-sm">
            Csepel SC · Ritmikus Gimnasztika
          </div>
        </div>
      </div>
      
      {/* Alsó sáv - piros */}
      <div 
        className="flex items-center justify-center py-2 px-4"
        style={{ backgroundColor: COLORS.red }}
      >
        <img 
          src={CSEPEL_RG_LOGO}
          alt="Csepeli RG Klub"
          className="h-12 sm:h-16 object-contain"
        />
      </div>
    </div>
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
          <ParentProfileView supabase={supabase} parentUserId={profile.id} />
        )}
        {activeView === 'profile' && profile.role === 'versenyzo' && (
          <PlaceholderView title="Profil" message="A 4. fázisban készül el — saját eredmények, fejlődési grafikon." />
        )}
        {activeView === 'competitors' && <CompetitorsViewComponent supabase={supabase} />}
        {activeView === 'competitions' && <PlaceholderView title="Versenyek" message="A 3. fázisban készül el — startlista, pontozás." />}
        {activeView === 'admin' && <AdminView supabase={supabase} userRole={profile.role} />}
      </main>

      <footer className="bg-white border-t border-gray-200 py-3 px-4 text-center text-xs text-gray-500">
        Pontregiszter v0.8 · Csepel SC RG · MRGSZ 2025–2028
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════

function DashboardView() {
  const { profile } = useAuthContext();
  const [stats, setStats] = useState({ competitors: null, competitions: null, parents: null });
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    
    const loadStats = async () => {
      try {
        // Külön kérések - így ha az egyik hibára megy, a többi még megy
        const competitorsPromise = supabase
          .from('competitors')
          .select('id', { count: 'exact', head: true })
          .then(({ count, error }) => ({ count: count ?? 0, error }));
          
        const competitionsPromise = supabase
          .from('competitions')
          .select('id', { count: 'exact', head: true })
          .then(({ count, error }) => ({ count: count ?? 0, error }));
        
        // szülő fiókok = szulo + szulo_admin
        const parentsPromise = supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .in('role', ['szulo', 'szulo_admin'])
          .then(({ count, error }) => ({ count: count ?? 0, error }));
        
        const [comp, competitions, parents] = await Promise.all([
          competitorsPromise, competitionsPromise, parentsPromise
        ]);
        
        if (!mounted) return;
        
        // Részleges hiba: ha az egyik elromlott, mutassuk a többit
        const errors = [];
        if (comp.error) errors.push('Versenyzők: ' + comp.error.message);
        if (competitions.error) errors.push('Versenyek: ' + competitions.error.message);
        if (parents.error) errors.push('Szülők: ' + parents.error.message);
        
        setStats({
          competitors: comp.count,
          competitions: competitions.count,
          parents: parents.count
        });
        
        if (errors.length > 0) {
          setError(errors.join(' · '));
        }
      } catch (err) {
        if (mounted) setError('Statisztikák betöltése sikertelen: ' + err.message);
      }
    };
    
    loadStats();
    
    // Biztonsági timeout: ha 8 másodpercen belül nem érkezik adat,
    // mutatjuk hogy 0 (nem hagyjuk forgatva a spinnert)
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
  }, []);

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

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard icon={Users} label="Versenyzők" value={stats.competitors} accent="blue" />
        <StatCard icon={Calendar} label="Versenyek" value={stats.competitions} accent="red" />
        <StatCard icon={Heart} label="Szülő fiókok" value={stats.parents} accent="blue" />
      </div>

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
      {auth.session && auth.profile ? <AppShell /> : <LoginScreen />}
    </AuthContext.Provider>
  );
}
