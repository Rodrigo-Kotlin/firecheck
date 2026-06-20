import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAppStore } from '../../store';
import { Menu, User, Download, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { showToast } from '../../hooks/useToasts';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { useAutoSync } from '../../hooks/useAutoSync';
import { OfflineBanner } from './OfflineBanner';
import { SyncStatusBadge } from './SyncStatusBadge';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';

export default function AppLayout() {
  useAutoSync();
  const { user, authReady, setCurrentTab, pending, syncing, syncEnabled, triggerSync } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const install = usePwaInstall();
  const lastConnectivityRef = useRef(isOnline);

  useEffect(() => {
    if (authReady && !user) navigate('/login');
  }, [authReady, user, navigate]);

  useEffect(() => {
    const path = location.pathname;
    if (path === '/') setCurrentTab('dashboard');
    else if (path.startsWith('/equipamentos')) setCurrentTab('equipamentos');
    else if (path === '/qrcodes') setCurrentTab('qrcodes');
    else if (path === '/inspecionar' || path === '/scan') setCurrentTab('inspecionar');
    else if (path === '/relatorios' || path === '/planodeacao') setCurrentTab('relatorios');
  }, [location, setCurrentTab]);

  useEffect(() => { lastConnectivityRef.current = isOnline; }, [isOnline]);

  useEffect(() => {
    const handleOnline = () => {
      if (lastConnectivityRef.current) return;
      lastConnectivityRef.current = true;
      setIsOnline(true);
      showToast({ kind: 'success', title: 'Conexão restabelecida', description: 'Pronto para enviar suas alterações para a nuvem.', icon: Wifi, duration: 4000 });
    };
    const handleOffline = () => {
      if (!lastConnectivityRef.current) return;
      lastConnectivityRef.current = false;
      setIsOnline(false);
      showToast({ kind: 'warning', title: 'Você está offline', description: 'Suas alterações continuam sendo salvas localmente e serão sincronizadas ao reconectar.', icon: WifiOff, duration: 6000 });
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  const handleInstallClick = async () => {
    if (installing) return;
    setInstalling(true);
    const outcome = await install.promptInstall();
    setInstalling(false);
    if (outcome === 'dismissed') {
      showToast({ kind: 'info', title: 'Instalação cancelada', description: 'Você pode tentar novamente quando quiser.', duration: 3000 });
    } else if (outcome === 'error') {
      showToast({ kind: 'error', title: 'Não foi possível instalar', description: 'Tente novamente em alguns instantes.', duration: 4000 });
    }
  };

  const handleTriggerSync = () => {
    if (!syncEnabled) {
      showToast({ kind: 'info', title: 'Sincronização indisponível', description: 'A nuvem não está configurada neste ambiente.', duration: 3500 });
      return;
    }
    if (!isOnline) {
      showToast({ kind: 'warning', title: 'Sem conexão', description: 'A sincronização será retomada quando você voltar a ficar online.', duration: 4000 });
      return;
    }
    if (syncing) return;
    void triggerSync();
  };

  const currentTitle = location.pathname === '/qrcodes' ? 'QR Codes'
    : location.pathname === '/planodeacao' ? 'Plano de Ação'
    : location.pathname === '/admin/usuarios' ? 'Usuários'
    : location.pathname === '/configuracoes' ? 'Configurações'
    : location.pathname === '/' ? 'Dashboard'
    : location.pathname === '/equipamentos' || location.pathname.startsWith('/equipamentos/') ? 'Equipamentos'
    : location.pathname === '/inspecionar' ? 'Inspecionar'
    : location.pathname === '/scan' ? 'Escanear QR'
    : 'FireCheck';

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
      <Sidebar open={sideMenuOpen} onClose={() => setSideMenuOpen(false)} isOnline={isOnline} />

      <div className="app-content flex flex-col min-h-screen">
        {!isOnline && <OfflineBanner pending={pending} variant="mobile" />}

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
            {install.state === 'available' && (
              <button
                onClick={() => { void handleInstallClick(); }}
                disabled={installing}
                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label="Adicionar à tela inicial"
              >
                {installing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">{installing ? 'Instalando…' : 'Instalar'}</span>
              </button>
            )}
            {syncEnabled && (
              <div className="hidden md:block">
                <SyncStatusBadge isOnline={isOnline} syncing={syncing} pending={pending} onClick={handleTriggerSync} />
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

        {!isOnline && <OfflineBanner pending={pending} variant="desktop" />}

        <main className="app-main">
          <Outlet context={{ openSideMenu: () => setSideMenuOpen(true) }} />
        </main>

        <BottomNav onOpenSideMenu={() => setSideMenuOpen(true)} />
      </div>
    </div>
  );
}
