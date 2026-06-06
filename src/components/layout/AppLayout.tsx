import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAppStore } from '../../store';
import { LayoutDashboard, Shield, QrCode, FileBarChart, WifiOff, X, ClipboardList, Settings, LogOut, Menu, User, RefreshCw, Cloud, CloudOff } from 'lucide-react';

export default function AppLayout() {
  const { user, currentTab, setCurrentTab, logout, pending, syncing, lastSyncAt, syncEnabled, triggerSync } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);

  // Route auth guard
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

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

  // Track online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
    logout();
    navigate('/login');
  };

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const initials = user?.nome
    ? user.nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : 'FC';

  const currentTitle = tabs.find(t => t.id === currentTab)?.label ?? 'FireCheck';

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
          <div className="min-w-0">
            <div className="text-sm font-black text-gray-900 truncate">{user.nome}</div>
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
              <button
                onClick={() => { void triggerSync(); }}
                disabled={!isOnline || syncing}
                className="w-full flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-white border border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando…' : 'Sincronizar agora'}
              </button>
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
        {!isOnline && (
          <div className="lg:hidden bg-amber-500 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 py-2 px-4">
            <WifiOff className="w-4 h-4" />
            Modo offline — dados serão sincronizados quando houver conexão
          </div>
        )}

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
            {/* Sync indicator on desktop top bar */}
            {syncEnabled && (
              <button
                onClick={() => { void triggerSync(); }}
                disabled={!isOnline || syncing}
                className={`hidden md:flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg transition-colors ${
                  pending > 0 ? 'bg-amber-50 text-pending hover:bg-amber-100' : 'bg-green-50 text-success hover:bg-green-100'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={lastSyncAt ? `Última sync: ${new Date(lastSyncAt).toLocaleTimeString('pt-BR')}` : 'Sincronizar com Supabase'}
              >
                {syncing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : isOnline ? (
                  <Cloud className="w-3.5 h-3.5" />
                ) : (
                  <CloudOff className="w-3.5 h-3.5" />
                )}
                <span>
                  {syncing ? 'Sync…' : pending > 0 ? `${pending} pendente${pending === 1 ? '' : 's'}` : 'Sincronizado'}
                </span>
              </button>
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
        {!isOnline && (
          <div className="hidden lg:flex bg-amber-500 text-white text-xs font-bold uppercase tracking-wider items-center justify-center gap-2 py-2 px-4">
            <WifiOff className="w-4 h-4" />
            Modo offline — dados serão sincronizados quando houver conexão
          </div>
        )}

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
