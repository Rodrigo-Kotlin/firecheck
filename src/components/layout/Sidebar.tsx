import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Shield, QrCode, FileBarChart, X,
  ClipboardList, Settings, LogOut,
  RefreshCw, Cloud, CloudOff, Users, AlertOctagon,
} from 'lucide-react';
import { useAppStore } from '../../store';
import { isAdmin } from '../../services/permissions';
import { showToast } from '../../hooks/useToasts';
import { SyncNowButton } from './SyncNowButton';

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  isOnline: boolean;
};

export function Sidebar({ open, onClose, isOnline }: SidebarProps) {
  const { user, syncEnabled, syncing, pending, conflictCounts, triggerSync, logout } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();

  const initials = user?.nome
    ? user.nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : 'FC';

  const handleNavigate = (path: string) => {
    onClose();
    navigate(path);
  };

  const handleLogout = () => {
    void logout();
    navigate('/login');
  };

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

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { label: 'Equipamentos', icon: Shield, path: '/equipamentos' },
    { label: 'QR Codes', icon: QrCode, path: '/qrcodes' },
    { label: 'Inspecionar', icon: QrCode, path: '/scan' },
    { label: 'Relatórios', icon: FileBarChart, path: '/relatorios' },
    { label: 'Plano de Ação', icon: ClipboardList, path: '/planodeacao' },
    { label: 'Configurações', icon: Settings, path: '/configuracoes' },
    ...(isAdmin(user) ? [{ label: 'Usuários', icon: Users, path: '/admin/usuarios' }] : []),
  ];

  return (
    <>
      <div
        className={`sidebar-backdrop ${open ? 'block' : 'hidden'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`app-sidebar ${open ? 'open' : ''}`}
        aria-label="Menu principal"
      >
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
            onClick={onClose}
            className="lg:hidden text-white/80 hover:text-white p-1.5 min-h-0 min-w-0 rounded"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-black text-sm flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-black text-gray-900 truncate flex items-center gap-1.5">
              <span className="truncate">{user?.nome}</span>
              {isAdmin(user) && (
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary text-white flex-shrink-0">
                  Admin
                </span>
              )}
            </div>
            <div className="text-[11px] text-gray-400 uppercase font-bold truncate">{user?.cargo}</div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <div className="label-uppercase px-3 py-2">Navegação</div>
          {navItems.map(item => (
            <button
              key={item.path}
              onClick={() => handleNavigate(item.path)}
              className={`w-full flex items-center gap-3 h-11 px-3 rounded-lg font-bold text-sm transition-all text-left ${
                isActive(item.path)
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-primary'
              }`}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive(item.path) ? 'text-white' : 'text-gray-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </nav>

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
              {(conflictCounts.equipments > 0 || conflictCounts.actionPlans > 0) && (
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-critical bg-red-50 rounded-md px-2 py-1.5">
                  <AlertOctagon className="w-3 h-3 flex-shrink-0" />
                  <span>
                    Conflito{conflictCounts.equipments + conflictCounts.actionPlans > 1 ? 's' : ''}: {conflictCounts.equipments + conflictCounts.actionPlans}
                  </span>
                </div>
              )}
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
          <p className="text-[11px] text-slate-400 text-center opacity-70 pb-1">
            by Efetiva SST
          </p>
        </div>
      </aside>
    </>
  );
}
