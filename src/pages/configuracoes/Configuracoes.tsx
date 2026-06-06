import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store';
import { ChevronLeft, LogOut, Building2, Bell, Wifi, WifiOff, User, Shield } from 'lucide-react';
import { isAdmin } from '../../services/permissions';
import ToggleSwitch from '../../components/ToggleSwitch';

export default function Configuracoes() {
  const { user, config, updateConfig, logout } = useAppStore();
  const navigate = useNavigate();

  const [empresa, setEmpresa] = useState(config.empresa);
  const [unidade, setUnidade] = useState(config.unidade);
  const [saved, setSaved] = useState(false);

  const initials = user?.nome
    ? user.nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : 'FC';

  const handleSave = () => {
    updateConfig({ empresa, unidade });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = () => {
    void logout();
    navigate('/login');
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-24">
      {/* Header */}
      <header className="page-header">
        <button
          onClick={() => navigate('/')}
          className="flex items-center justify-center text-gray-600 hover:text-gray-900 bg-gray-50 rounded-lg p-2 min-h-0 min-w-0"
          type="button"
          aria-label="Voltar"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">Sistema</div>
          <h1 className="text-base sm:text-lg lg:text-xl font-black text-gray-900 uppercase tracking-wide truncate">
            Configurações
          </h1>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Profile card */}
          <div className="card-subtle bg-white space-y-4">
            <span className="label-uppercase block border-b border-gray-50 pb-2">Perfil do Usuário</span>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-md flex-shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-black text-gray-900 truncate flex items-center gap-1.5">
                  <span className="truncate">{user?.nome || 'Inspetor'}</span>
                  {isAdmin(user) && (
                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary text-white flex-shrink-0">
                      Admin
                    </span>
                  )}
                </h3>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{user?.cargo || 'Cargo não definido'}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{config.empresa} · {config.unidade}</p>
              </div>
            </div>
            {isAdmin(user) && (
              <button
                onClick={() => navigate('/admin/usuarios')}
                className="w-full h-10 flex items-center justify-center gap-2 border border-primary/30 text-primary font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-primary/5 transition-all"
                type="button"
              >
                <Shield className="w-4 h-4" />
                Gerenciar Usuários
              </button>
            )}
          </div>

          {/* Company settings */}
          <div className="card-subtle bg-white space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-50 pb-2">
              <Building2 className="w-4 h-4 text-gray-400" />
              <span className="label-uppercase">Empresa & Unidade</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="field-label">Nome da Empresa</label>
                <input
                  type="text"
                  value={empresa}
                  onChange={e => setEmpresa(e.target.value)}
                  className="field-input"
                />
              </div>
              <div>
                <label className="field-label">Unidade / Filial</label>
                <input
                  type="text"
                  value={unidade}
                  onChange={e => setUnidade(e.target.value)}
                  className="field-input"
                />
              </div>
            </div>
            <button
              onClick={handleSave}
              className={`btn-primary ${saved ? 'bg-success' : ''}`}
            >
              {saved ? '✓ Configurações Salvas' : 'Salvar Alterações'}
            </button>
          </div>

          {/* Toggles */}
          <div className="card-subtle bg-white space-y-1">
            <span className="label-uppercase block border-b border-gray-50 pb-2 mb-3">Preferências</span>

            <div className="flex items-center justify-between gap-3 py-3 border-b border-gray-50">
              <div className="flex items-center gap-3 min-w-0">
                {config.offlineMode ? (
                  <WifiOff className="w-5 h-5 text-pending flex-shrink-0" />
                ) : (
                  <Wifi className="w-5 h-5 text-success flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-bold text-gray-800">Modo Offline</div>
                  <div className="text-[11px] text-gray-500 font-medium">
                    {config.offlineMode ? 'Dados salvos localmente' : 'Sincronização ativa'}
                  </div>
                </div>
              </div>
              <ToggleSwitch
                checked={config.offlineMode}
                onChange={() => updateConfig({ offlineMode: !config.offlineMode })}
                ariaLabel="Alternar modo offline"
              />
            </div>

            <div className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <Bell className={`w-5 h-5 flex-shrink-0 ${config.notificationsEnabled ? 'text-primary' : 'text-gray-300'}`} />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-gray-800">Notificações</div>
                  <div className="text-[11px] text-gray-500 font-medium">
                    {config.notificationsEnabled ? 'Lembretes de inspeção ativos' : 'Notificações desativadas'}
                  </div>
                </div>
              </div>
              <ToggleSwitch
                checked={config.notificationsEnabled}
                onChange={() => updateConfig({ notificationsEnabled: !config.notificationsEnabled })}
                ariaLabel="Alternar notificações"
              />
            </div>
          </div>
        </div>

        {/* Sidebar — App info & Logout */}
        <div className="space-y-4 sm:space-y-6">
          <div className="card-subtle bg-white">
            <div className="flex items-center gap-2 border-b border-gray-50 pb-2 mb-3">
              <User className="w-4 h-4 text-gray-400" />
              <span className="label-uppercase">Sobre o App</span>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between gap-2"><span className="font-bold text-gray-500">Versão</span><span className="font-semibold">1.0.0</span></div>
              <div className="flex justify-between gap-2"><span className="font-bold text-gray-500">Build</span><span className="font-semibold">PWA · Vite + React</span></div>
              <div className="flex justify-between gap-2"><span className="font-bold text-gray-500">Banco local</span><span className="font-semibold">IndexedDB (Dexie)</span></div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full h-12 flex items-center justify-center gap-2 border-2 border-critical text-critical font-black text-xs uppercase tracking-wider rounded-xl hover:bg-red-50 transition-all"
          >
            <LogOut className="w-5 h-5" />
            Sair da Conta
          </button>
        </div>
      </div>
    </div>
  );
}
