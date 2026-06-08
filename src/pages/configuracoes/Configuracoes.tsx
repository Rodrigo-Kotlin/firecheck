import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store';
import {
  ChevronLeft,
  LogOut,
  Building2,
  Bell,
  Shield,
  RefreshCw,
  Save,
  Check,
  CheckCircle2,
  Loader2,
  Cloud,
  CloudOff,
  Info,
  Database,
  Smartphone,
  User,
  MapPin,
  Hash,
  Eye,
  Download,
  Share2,
  type LucideIcon,
} from 'lucide-react';
import { isAdmin } from '../../services/permissions';
import ToggleSwitch from '../../components/ToggleSwitch';
import { showToast } from '../../hooks/useToasts';
import { usePwaInstall, type InstallState } from '../../hooks/usePwaInstall';

// ---------------------------------------------------------------------------
// Section shell — consistent header + body used by all 4 config sections.
// ---------------------------------------------------------------------------
type SectionProps = {
  icon: LucideIcon;
  index: number;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
};

function Section({ icon: Icon, index, title, description, action, children }: SectionProps) {
  return (
    <section className="card-subtle bg-white">
      <header className="flex items-start justify-between gap-2 pb-3 mb-4 border-b border-gray-100">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] sm:text-[10px] font-black text-primary uppercase tracking-widest">
                {String(index).padStart(2, '0')}
              </span>
              <h2 className="text-xs sm:text-sm font-black text-gray-900 uppercase tracking-wider truncate">
                {title}
              </h2>
            </div>
            {description && (
              <p className="text-[10px] sm:text-xs text-gray-500 font-medium mt-0.5 leading-snug">
                {description}
              </p>
            )}
          </div>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </header>
      <div className="space-y-3 sm:space-y-4">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// ToggleRow — icon + title + description on the left, ToggleSwitch on the right.
// The label area is a button so users can click anywhere except the switch
// itself; the switch's own button handles its own click without propagation.
// ---------------------------------------------------------------------------
type ToggleRowProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  status: boolean;
  onToggle: () => void;
  onText?: string;
  offText?: string;
};

function ToggleRow({
  icon: Icon,
  title,
  description,
  status,
  onToggle,
  onText = 'ON',
  offText = 'OFF',
}: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 -mx-2 px-2 rounded-lg transition-colors">
      <button
        type="button"
        onClick={onToggle}
        aria-label={`Alternar ${title}`}
        className="flex items-center gap-3 min-w-0 flex-1 text-left"
      >
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
            status ? 'bg-red-50 text-primary' : 'bg-gray-100 text-gray-400'
          }`}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-gray-800">{title}</div>
          <div className="text-[11px] text-gray-500 font-medium leading-snug">
            {description}
          </div>
        </div>
      </button>
      <ToggleSwitch
        checked={status}
        onChange={onToggle}
        ariaLabel={`Alternar ${title}`}
        onText={onText}
        offText={offText}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sync status — derives a label, detail line, and indicator color from store
// state. Updates the rendered copy in real time as the user toggles stuff.
// ---------------------------------------------------------------------------
type SyncBadge = {
  label: string;
  detail: string;
  dotClass: string;
  Icon: LucideIcon;
};

function formatRelative(timestamp: number | null): string {
  if (!timestamp) return 'Nunca sincronizado';
  const diff = Date.now() - timestamp;
  if (diff < 0) return new Date(timestamp).toLocaleString('pt-BR');
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'agora mesmo';
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `há ${hr} h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `há ${day} ${day === 1 ? 'dia' : 'dias'}`;
  return new Date(timestamp).toLocaleDateString('pt-BR');
}

function getSyncBadge(args: {
  syncEnabled: boolean;
  syncing: boolean;
  pending: number;
  lastSyncAt: number | null;
}): SyncBadge {
  const { syncEnabled, syncing, pending, lastSyncAt } = args;
  if (!syncEnabled) {
    return {
      label: 'Sincronização desabilitada',
      detail: 'Supabase não configurado neste ambiente.',
      dotClass: 'bg-gray-400',
      Icon: CloudOff,
    };
  }
  if (syncing) {
    return {
      label: 'Sincronizando...',
      detail: 'Enviando alterações para a nuvem.',
      dotClass: 'bg-blue-500 animate-pulse',
      Icon: RefreshCw,
    };
  }
  if (pending > 0) {
    return {
      label: `${pending} ${pending === 1 ? 'alteração pendente' : 'alterações pendentes'}`,
      detail: 'Toque em "Sincronizar agora" para enviar.',
      dotClass: 'bg-amber-500',
      Icon: Cloud,
    };
  }
  if (lastSyncAt) {
    return {
      label: 'Sincronizado',
      detail: `Última sincronização: ${formatRelative(lastSyncAt)}`,
      dotClass: 'bg-green-500',
      Icon: Cloud,
    };
  }
  return {
    label: 'Pronto para sincronizar',
    detail: 'Nenhuma sincronização realizada ainda.',
    dotClass: 'bg-gray-400',
    Icon: Cloud,
  };
}

// ---------------------------------------------------------------------------
// PreviewBlock — mini "report cover" showing how the saved data will appear
// inside generated PDFs. Highlights in green for 2s after a successful save.
// ---------------------------------------------------------------------------
type PreviewBlockProps = {
  empresa: string;
  unidade: string;
  saved: boolean;
};

function PreviewBlock({ empresa, unidade, saved }: PreviewBlockProps) {
  return (
    <div
      className={`rounded-lg border-2 p-4 transition-all ${
        saved ? 'border-success bg-green-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-center gap-1.5 mb-3">
        <Eye className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Prévia do cabeçalho de relatório
        </span>
        {saved && (
          <CheckCircle2 className="w-3.5 h-3.5 text-success ml-auto" />
        )}
      </div>
      <div className="bg-gray-50 rounded border border-gray-100 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black text-primary uppercase tracking-widest">
            FireCheck
          </span>
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
            Relatório
          </span>
        </div>
        <div className="h-px bg-gray-200" />
        <div>
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
            Emitido para
          </div>
          <div className="text-sm font-black text-gray-900 mt-0.5">
            {empresa || (
              <span className="text-gray-300 italic font-medium">Razão Social não definida</span>
            )}
          </div>
          <div className="text-xs text-gray-500 font-medium mt-0.5">
            {unidade || (
              <span className="text-gray-300 italic">Endereço não definido</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InstallCard — install-state surface for the PWA. Renders a compact
// notice + CTA (or iOS instructions) depending on the current browser
// capability. Mirrors the design tokens used elsewhere on the page.
// ---------------------------------------------------------------------------
type InstallCardProps = {
  state: InstallState;
  isIos: boolean;
  installing: boolean;
  onInstall: () => void;
};

function InstallCard({ state, isIos, installing, onInstall }: InstallCardProps) {
  if (state === 'installed') {
    return (
      <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
        <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-gray-900">App instalado</div>
          <div className="text-[11px] text-gray-600 font-medium leading-snug">
            Você está usando o FireCheck direto da tela inicial do seu dispositivo.
          </div>
        </div>
      </div>
    );
  }

  if (state === 'available') {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
          <Download className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-gray-900">Instalação disponível</div>
            <div className="text-[11px] text-gray-600 font-medium leading-snug">
              Adicione à tela inicial para acesso rápido, mesmo offline.
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onInstall}
          disabled={installing}
          className="btn-primary"
        >
          {installing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {installing ? 'Instalando...' : 'Adicionar à tela inicial'}
        </button>
      </div>
    );
  }

  // state === 'unavailable'
  if (isIos) {
    return (
      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
        <Smartphone className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-gray-800">Instalar no iPhone / iPad</div>
          <div className="text-[11px] text-gray-600 font-medium leading-snug">
            No Safari, toque em{' '}
            <Share2 className="w-3 h-3 inline -mt-0.5 text-gray-700" />{' '}
            <span className="font-bold text-gray-700">Compartilhar</span> e selecione{' '}
            <span className="font-bold text-gray-700">"Adicionar à Tela Inicial"</span>.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
      <Info className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-gray-800">Indisponível neste navegador</div>
        <div className="text-[11px] text-gray-600 font-medium leading-snug">
          A instalação está disponível em Chrome, Edge, Samsung Internet e outros navegadores compatíveis.
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Configuracoes() {
  const { user, config, updateConfig, logout, syncing, pending, lastSyncAt, syncEnabled, triggerSync } = useAppStore();
  const navigate = useNavigate();
  const install = usePwaInstall();

  const [empresa, setEmpresa] = useState(config.empresa);
  const [unidade, setUnidade] = useState(config.unidade);
  const [saved, setSaved] = useState(false);
  const [installing, setInstalling] = useState(false);

  const initials = user?.nome
    ? user.nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : 'FC';

  const hasChanges = empresa !== config.empresa || unidade !== config.unidade;
  const canSave = hasChanges && empresa.trim().length > 0 && unidade.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const trimmedEmpresa = empresa.trim();
    const trimmedUnidade = unidade.trim();
    updateConfig({ empresa: trimmedEmpresa, unidade: trimmedUnidade });
    setSaved(true);
    showToast({
      kind: 'success',
      title: 'Dados da empresa salvos',
      description: `${trimmedEmpresa} — ${trimmedUnidade}`,
      duration: 4000,
    });
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSync = async () => {
    if (!syncEnabled || syncing) return;
    try {
      await triggerSync();
      showToast({
        kind: 'success',
        title: 'Sincronização concluída',
        description: pending > 0
          ? `${pending} alteração(ões) enviada(s).`
          : 'Nenhuma alteração pendente.',
      });
    } catch {
      showToast({
        kind: 'error',
        title: 'Falha na sincronização',
        description: 'Tente novamente em alguns instantes.',
      });
    }
  };

  const handleLogout = () => {
    void logout();
    navigate('/login');
  };

  const handleInstall = async () => {
    if (installing) return;
    setInstalling(true);
    try {
      const outcome = await install.promptInstall();
      if (outcome === 'accepted') {
        showToast({
          kind: 'success',
          title: 'App instalado',
          description: 'O FireCheck foi adicionado à sua tela inicial.',
        });
      } else if (outcome === 'dismissed') {
        showToast({
          kind: 'info',
          title: 'Instalação cancelada',
          description: 'Você pode tentar novamente quando quiser.',
        });
      } else if (outcome === 'error') {
        showToast({
          kind: 'error',
          title: 'Não foi possível instalar',
          description: 'Tente novamente em alguns instantes.',
        });
      }
    } finally {
      setInstalling(false);
    }
  };

  const syncBadge = getSyncBadge({ syncEnabled, syncing, pending, lastSyncAt });
  const SyncBadgeIcon = syncBadge.Icon;

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

      {/* Profile card — full width, compact */}
      <div className="card-subtle bg-white">
        <div className="flex items-center gap-3 sm:gap-4">
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
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              {user?.cargo || 'Cargo não definido'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {config.empresa} · {config.unidade}
            </p>
          </div>
          {isAdmin(user) && (
            <button
              onClick={() => navigate('/admin/usuarios')}
              className="btn-ghost btn-sm btn-auto flex-shrink-0"
              type="button"
            >
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Usuários</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Main column — sections 1, 2, 3 */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* 01 — Dados da empresa */}
          <Section
            icon={Building2}
            index={1}
            title="Dados da Empresa"
            description="Identificação exibida no cabeçalho dos relatórios e na sincronização."
            action={
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave && !saved}
                className={`btn-primary btn-sm btn-auto ${saved ? 'bg-success hover:bg-success' : ''}`}
              >
                {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saved ? 'Salvo' : 'Salvar'}
              </button>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="field-label">
                  <span className="inline-flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-gray-400" />
                    1. Razão Social
                  </span>
                </label>
                <input
                  type="text"
                  value={empresa}
                  onChange={e => setEmpresa(e.target.value)}
                  placeholder="Ex.: Acme Indústria e Comércio Ltda."
                  className="field-input"
                />
                <span className="field-hint">
                  Nome legal / fantasia exibido na capa dos relatórios.
                </span>
              </div>
              <div>
                <label className="field-label">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    2. Endereço / Unidade
                  </span>
                </label>
                <input
                  type="text"
                  value={unidade}
                  onChange={e => setUnidade(e.target.value)}
                  placeholder="Ex.: Av. Paulista, 1000 — Bela Vista — São Paulo / SP"
                  className="field-input"
                />
                <span className="field-hint">
                  Endereço completo ou nome da filial/unidade.
                </span>
              </div>
            </div>

            {!hasChanges && !saved && (
              <p className="text-[11px] text-gray-400 font-medium">
                Nenhuma alteração pendente.
              </p>
            )}

            {saved && (
              <div className="flex items-center gap-2 text-success text-xs font-bold uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" />
                <span>Dados atualizados com sucesso</span>
              </div>
            )}

            <PreviewBlock
              empresa={config.empresa}
              unidade={config.unidade}
              saved={saved}
            />
          </Section>

          {/* 02 — Preferências do aplicativo */}
          <Section
            icon={Bell}
            index={2}
            title="Preferências do Aplicativo"
            description="Comportamento do app no dispositivo."
          >
            <div className="divide-y divide-gray-100">
              <ToggleRow
                icon={config.offlineMode ? CloudOff : Cloud}
                title="Modo Offline"
                description={
                  config.offlineMode
                    ? 'Alterações ficam apenas no dispositivo até sincronizar.'
                    : 'Sincronização ativa com a nuvem.'
                }
                status={config.offlineMode}
                onToggle={() => {
                  updateConfig({ offlineMode: !config.offlineMode });
                  showToast({
                    kind: 'info',
                    title: config.offlineMode ? 'Modo online' : 'Modo offline',
                    description: config.offlineMode
                      ? 'Sincronização reativada.'
                      : 'Dados serão salvos localmente.',
                  });
                }}
              />
              <ToggleRow
                icon={Bell}
                title="Notificações"
                description={
                  config.notificationsEnabled
                    ? 'Lembretes de inspeção ativos.'
                    : 'Notificações desativadas.'
                }
                status={config.notificationsEnabled}
                onToggle={() => {
                  updateConfig({ notificationsEnabled: !config.notificationsEnabled });
                  showToast({
                    kind: 'info',
                    title: config.notificationsEnabled ? 'Notificações desativadas' : 'Notificações ativadas',
                    description: config.notificationsEnabled
                      ? 'Você não receberá lembretes.'
                      : 'Lembretes de inspeção ativos.',
                  });
                }}
              />
            </div>
          </Section>

          {/* 03 — Sincronização */}
          <Section
            icon={RefreshCw}
            index={3}
            title="Sincronização"
            description="Status e ações de envio para a nuvem."
          >
            {/* Status row */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${syncBadge.dotClass}`} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-gray-800">{syncBadge.label}</div>
                <div className="text-[11px] text-gray-500 font-medium leading-snug">
                  {syncBadge.detail}
                </div>
              </div>
              <SyncBadgeIcon className={`w-4 h-4 flex-shrink-0 ${syncing ? 'animate-spin text-blue-500' : 'text-gray-400'}`} />
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <div className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Pendentes
                </div>
                <div className={`text-lg sm:text-xl font-black mt-0.5 ${pending > 0 ? 'text-pending' : 'text-gray-900'}`}>
                  {pending}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <div className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Última Sync
                </div>
                <div className="text-xs sm:text-sm font-bold text-gray-700 mt-0.5 truncate">
                  {formatRelative(lastSyncAt)}
                </div>
              </div>
            </div>

            {/* Manual sync button */}
            <button
              type="button"
              onClick={handleSync}
              disabled={!syncEnabled || syncing}
              className="btn-ghost"
            >
              {syncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
            </button>
          </Section>
        </div>

        {/* Sidebar — section 4 + logout */}
        <div className="space-y-4 sm:space-y-6 lg:sticky lg:top-24 self-start">
          {/* 04 — Informações do PWA */}
          <Section
            icon={Info}
            index={4}
            title="Informações do PWA"
            description="Versão e recursos do app instalado."
          >
            <InstallCard
              state={install.state}
              isIos={install.isIos}
              installing={installing}
              onInstall={handleInstall}
            />
            <div className="h-px bg-gray-100" />
            <dl className="divide-y divide-gray-100">
              <div className="flex items-center justify-between gap-2 py-2.5">
                <dt className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  Versão
                </dt>
                <dd className="text-sm font-bold text-gray-900">1.0.0</dd>
              </div>
              <div className="flex items-center justify-between gap-2 py-2.5">
                <dt className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  Build
                </dt>
                <dd className="text-sm font-bold text-gray-900">PWA · Vite + React</dd>
              </div>
              <div className="flex items-center justify-between gap-2 py-2.5">
                <dt className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" />
                  Banco local
                </dt>
                <dd className="text-sm font-bold text-gray-900">IndexedDB (Dexie)</dd>
              </div>
              <div className="flex items-center justify-between gap-2 py-2.5">
                <dt className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Usuário
                </dt>
                <dd className="text-sm font-bold text-gray-900 truncate max-w-[10rem]">
                  {user?.nome || '—'}
                </dd>
              </div>
            </dl>
          </Section>

          <button
            type="button"
            onClick={handleLogout}
            className="btn-danger"
          >
            <LogOut className="w-5 h-5" />
            Sair da Conta
          </button>
        </div>
      </div>
    </div>
  );
}
