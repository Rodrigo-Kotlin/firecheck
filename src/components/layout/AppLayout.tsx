import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAppStore } from '../../store';
import {
  LayoutDashboard, Shield, QrCode, FileBarChart,
  WifiOff, Wifi, X, ClipboardList, Settings, LogOut, Menu, User,
  RefreshCw, Cloud, CloudOff, Users, Download, type LucideIcon,
} from 'lucide-react';
import { isAdmin } from '../../services/permissions';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { showToast } from '../../hooks/useToasts';

// ---------------------------------------------------------------------------
// OfflineBanner — sticky amber strip shown when the browser is offline.
// Two visual variants: compact (mobile) and full (desktop).
// ---------------------------------------------------------------------------
type OfflineBannerProps = {
  pending: number;
  variant: 'mobile' | 'desktop';
};

function OfflineBanner({ pending, variant }: OfflineBannerProps) {
  const classes = variant === 'mobile'
    ? 'lg:hidden offline-banner'
    : 'hidden lg:flex offline-banner';

  return (
    <div className={classes} role="status" aria-live="polite">
      <WifiOff className="offline-banner__icon" />
      <div className="offline-banner__body">
        <div className="offline-banner__title">Modo Offline</div>
        {variant === 'desktop' && (
          <div className="offline-banner__sub">
            Suas alterações estão sendo salvas localmente. Sincronizamos automaticamente ao reconectar.
          </div>
        )}
      </div>
      {pending > 0 && (
        <span className="offline-banner__pill" title="Alterações aguardando envio">
          {pending} pendente{pending === 1 ? '' : 's'}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SyncStatusBadge — compact pill for the top bar. Renders one of four states:
// syncing (blue, spinning dot) / online-synced (green, static) /
// online-pending (amber, pulsing) / offline (red, pulsing).
// ---------------------------------------------------------------------------
type SyncStatusBadgeProps = {
  isOnline: boolean;
  syncing: boolean;
  pending: number;
  onClick: () => void;
};

function SyncStatusBadge({ isOnline, syncing, pending, onClick }: SyncStatusBadgeProps) {
  let label: string;
  let variant: string;
  let dotClass: string;
  let Icon: LucideIcon | null = null;

  if (syncing) {
    label = 'Sincronizando...';
    variant = 'syncing';
    dotClass = 'status-dot status-dot--spin';
  } else if (!isOnline) {
    label = 'Offline';
    variant = 'offline';
    dotClass = 'status-dot status-dot--pulse';
  } else if (pending > 0) {
    label = `${pending} pendente${pending === 1 ? '' : 's'}`;
    variant = 'pending';
    dotClass = 'status-dot status-dot--pulse';
  } else {
    label = 'Sincronizado';
    variant = 'online';
    dotClass = 'status-dot';
  }

  // In syncing state we show a RefreshCw icon instead of the dot, to reinforce
  // the action; in all other states the dot is enough.
  if (syncing) Icon = RefreshCw;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={syncing}
      className={`status-pill status-pill--clickable status-pill--${variant}`}
      title={isOnline ? 'Sincronizar com a nuvem' : 'Aguardando conexão'}
      aria-label={label}
    >
      {Icon ? (
        <Icon className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <span className={dotClass} />
      )}
      <span>{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// SyncNowButton — larger sidebar CTA. State-aware colours and inline pending
// count make it crystal-clear what the button will do.
// ---------------------------------------------------------------------------
type SyncNowButtonProps = {
  isOnline: boolean;
  syncing: boolean;
  pending: number;
  onClick: () => void;
};

function SyncNowButton({ isOnline, syncing, pending, onClick }: SyncNowButtonProps) {
  let label: string;
  let variant: string;
  let Icon: LucideIcon;

  if (syncing) {
    label = 'Sincronizando...';
    variant = 'syncing';
    Icon = RefreshCw;
  } else if (!isOnline) {
    label = 'Sem conexão';
    variant = 'offline';
    Icon = WifiOff;
  } else if (pending > 0) {
    label = 'Sincronizar agora';
    variant = 'pending';
    Icon = RefreshCw;
  } else {
    label = 'Sincronizado';
    variant = 'idle';
    Icon = Cloud;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isOnline || syncing}
      className={`sync-now ${variant !== 'idle' ? `sync-now--${variant}` : ''}`}
      title={!isOnline ? 'Aguardando conexão para sincronizar' : 'Enviar alterações para a nuvem'}
    >
      <Icon className={`sync-now__icon ${syncing ? 'animate-spin' : ''}`} />
      <span className="flex-1 text-left">{label}</span>
      {pending > 0 && !syncing && (
        <span className="sync-now__count">{pending}</span>
      )}
    </button>
  );
}

export default function AppLayout() {
  const { user, authReady, currentTab, setCurrentTab, logout, pending, syncing, syncEnabled, triggerSync } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const install = usePwaInstall();
  // Mirror of the current online status, used to dedupe browser connectivity
  // events that can fire repeatedly for momentary flickers.
  const lastConnectivityRef = useRef(isOnline);

  // Route auth guard — wait for the initial session check (which may clear
  // an orphan legacy user) before deciding to bounce to /login.
  useEffect(() => {
    if (authReady && !user) {
      navigate('/login');
    }
  }, [authReady, user, navigate]);

  // Sync route path with Zustand store tab selection
  useEffect(() => {
    const path = location.pathname;
    if (path === '/') {
      setCurrentTab('dashboard');
    } else if (path.startsWith('/equipamentos')) {
      setCurrentTab('equipamentos');
    } else if (path === '/inspecionar' || path === '/scan') {
      setCurrentTab('inspecionar');
    } else if (path === '/relatorios' || path === '/planodeacao') {
      setCurrentTab('relatorios');
    }
  }, [location, setCurrentTab]);

  // Keep the ref in sync with the latest state.
  useEffect(() => {
    lastConnectivityRef.current = isOnline;
  }, [isOnline]);

  // Track online status — emits a toast whenever the connection toggles so
  // the user gets instant feedback (e.g. "Conexão restabelecida"). Browsers
  // can fire the same event repeatedly for momentary flickers, so we keep a
  // ref of the last known status and dedupe accordingly.
  useEffect(() => {
    const handleOnline = () => {
      if (lastConnectivityRef.current) return;
      lastConnectivityRef.current = true;
      setIsOnline(true);
      showToast({
        kind: 'success',
        title: 'Conexão restabelecida',
        description: 'Pronto para enviar suas alterações para a nuvem.',
        icon: Wifi,
        duration: 4000,
      });
    };
    const handleOffline = () => {
      if (!lastConnectivityRef.current) return;
      lastConnectivityRef.current = false;
      setIsOnline(false);
      showToast({
        kind: 'warning',
        title: 'Você está offline',
        description: 'Suas alterações continuam sendo salvas localmente e serão sincronizadas ao reconectar.',
        icon: WifiOff,
        duration: 6000,
      });
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Trigger the deferred PWA install prompt and report the outcome.
  const handleInstallClick = async () => {
    if (installing) return;
    setInstalling(true);
    const outcome = await install.promptInstall();
    setInstalling(false);
    if (outcome === 'accepted') {
      // `appinstalled` will fire and usePwaUpdate will show the success toast.
    } else if (outcome === 'dismissed') {
      showToast({
        kind: 'info',
        title: 'Instalação cancelada',
        description: 'Você pode tentar novamente quando quiser.',
        duration: 3000,
      });
    } else if (outcome === 'error') {
      showToast({
        kind: 'error',
        title: 'Não foi possível instalar',
        description: 'Tente novamente em alguns instantes.',
        duration: 4000,
      });
    }
  };

  // Close the mobile side menu on route change
  const [prevPath, setPrevPath] = useState(location.pathname);
  if (location.pathname !== prevPath) {
    setPrevPath(location.pathname);
    setSideMenuOpen(false);
  }

  const tabs = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { id: 'equipamentos' as const, label: 'Equipamentos', icon: Shield, path: '/equipamentos' },
    { id: 'inspecionar' as const, label: 'Inspecionar', icon: QrCode, path: '/scan' },
    { id: 'relatorios' as const, label: 'Relatórios', icon: FileBarChart, path: '/relatorios' },
  ];

  const handleLogout = () => {
    void logout();
    navigate('/login');
  };

  // User-initiated sync. We show a transient info toast so the click feels
  // acknowledged; the badge and "Sincronizar agora" button will reflect the
  // ongoing state and the result via `syncing`/`pending` from the store.
  const handleTriggerSync = () => {
    if (!syncEnabled) {
      showToast({
        kind: 'info',
        title: 'Sincronização indisponível',
        description: 'A nuvem não está configurada neste ambiente.',
        duration: 3500,
      });
      return;
    }
    if (!isOnline) {
      showToast({
        kind: 'warning',
        title: 'Sem conexão',
        description: 'A sincronização será retomada quando você voltar a ficar online.',
        duration: 4000,
      });
      return;
    }
    if (syncing) return;
    void triggerSync();
  };

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const initials = user?.nome
    ? user.nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : 'FC';

  const currentTitle = tabs.find(t => t.id === currentTab)?.label ?? 'FireCheck';

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutralBg">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" aria-label="Carregando" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="app-shell">
      {/* Mobile backdrop (hidden on desktop) */}
      <div
        className={`sidebar-backdrop ${sideMenuOpen ? 'block' : 'hidden'}`}
        onClick={() => setSideMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar / Mobile drawer */}
      <aside
        className={`app-sidebar ${sideMenuOpen ? 'open' : ''}`}
        aria-label="Menu principal"
      >
        {/* Menu Header */}
        <div className="bg-primary p-5 lg:p-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-white font-black text-lg leading-none">FireCheck</div>
              <div className="text-red-100 text-[10px] font-bold uppercase tracking-wider mt-0.5">Sistema de Inspeção</div>
            </div>
          </div>
          <button
            onClick={() => setSideMenuOpen(false)}
            className="lg:hidden text-white/80 hover:text-white p-1.5 min-h-0 min-w-0 rounded"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User info */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-black text-sm flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-black text-gray-900 truncate flex items-center gap-1.5">
              <span className="truncate">{user.nome}</span>
              {isAdmin(user) && (
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary text-white flex-shrink-0">
                  Admin
                </span>
              )}
            </div>
            <div className="text-[11px] text-gray-400 uppercase font-bold truncate">{user.cargo}</div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <div className="label-uppercase px-3 py-2">Navegação</div>
          {[
            { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
            { label: 'Equipamentos', icon: Shield, path: '/equipamentos' },
            { label: 'Inspecionar', icon: QrCode, path: '/scan' },
            { label: 'Relatórios', icon: FileBarChart, path: '/relatorios' },
            { label: 'Plano de Ação', icon: ClipboardList, path: '/planodeacao' },
            { label: 'Configurações', icon: Settings, path: '/configuracoes' },
            ...(isAdmin(user) ? [{ label: 'Usuários', icon: Users, path: '/admin/usuarios' }] : []),
          ].map(item => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <button
                key={item.path}
                onClick={() => handleNavigate(item.path)}
                className={`w-full flex items-center gap-3 h-11 px-3 rounded-lg font-bold text-sm transition-all text-left ${
                  isActive
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-primary'
                }`}
              >
                <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sync status + Logout */}
        <div className="px-3 pb-3 flex-shrink-0 space-y-2">
          {syncEnabled ? (
            <div className="bg-gray-50 rounded-lg p-2.5 space-y-2">
              <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${
                isOnline ? 'text-success' : 'text-pending'
              }`}>
                {isOnline ? <Cloud className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
                <span>Supabase</span>
                {syncing ? (
                  <RefreshCw className="w-3 h-3 ml-auto animate-spin" />
                ) : (
                  <span className="ml-auto text-[10px] opacity-70">
                    {pending > 0 ? `${pending} pendente${pending === 1 ? '' : 's'}` : 'Em dia'}
                  </span>
                )}
              </div>
              <SyncNowButton
                isOnline={isOnline}
                syncing={syncing}
                pending={pending}
                onClick={handleTriggerSync}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-lg bg-gray-50 text-gray-400">
              <CloudOff className="w-4 h-4" />
              <span>Modo local</span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 h-11 px-3 rounded-lg text-critical font-bold text-sm hover:bg-red-50 transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="app-content flex flex-col min-h-screen">
        {/* Offline banner — only on mobile/tablet top */}
        {!isOnline && <OfflineBanner pending={pending} variant="mobile" />}

        {/* Top bar (mobile header + desktop top bar) */}
        <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 sticky top-0 z-20">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setSideMenuOpen(true)}
              className="lg:hidden flex items-center justify-center text-gray-600 hover:text-gray-900 bg-gray-50 rounded-lg p-2 min-h-0 min-w-0"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">FireCheck</div>
              <h1 className="text-sm sm:text-base font-black text-gray-900 uppercase tracking-wide truncate">{currentTitle}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* PWA install chip — only visible when the browser is offering
                the deferred install prompt. Clicking it triggers it. */}
            {install.state === 'available' && (
              <button
                onClick={() => { void handleInstallClick(); }}
                disabled={installing}
                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label="Adicionar à tela inicial"
                title="Adicionar à tela inicial"
              >
                {installing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">
                  {installing ? 'Instalando…' : 'Instalar'}
                </span>
              </button>
            )}
            {/* Sync indicator on desktop top bar — pill with state-aware
                colors. Visible on md+; mobile users rely on the bottom nav. */}
            {syncEnabled && (
              <div className="hidden md:block">
                <SyncStatusBadge
                  isOnline={isOnline}
                  syncing={syncing}
                  pending={pending}
                  onClick={handleTriggerSync}
                />
              </div>
            )}
            <button
              onClick={() => navigate('/configuracoes')}
              className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 bg-gray-50 rounded-lg min-h-0 min-w-0"
              aria-label="Configurações"
            >
              <User className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Offline banner — desktop-only top placement */}
        {!isOnline && <OfflineBanner pending={pending} variant="desktop" />}

        {/* Page content */}
        <main className="app-main">
          <Outlet context={{ openSideMenu: () => setSideMenuOpen(true) }} />
        </main>

        {/* Bottom Navigation (mobile/tablet only) */}
        <nav className="app-bottom-nav">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.path)}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors px-1 ${
                  isActive ? 'text-primary' : 'text-gray-400 hover:text-gray-600'
                }`}
                aria-label={tab.label}
              >
                <Icon className="w-5 h-5 mb-0.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider leading-tight text-center">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
