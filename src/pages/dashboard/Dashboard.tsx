import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store';
import { Plus, QrCode, AlertTriangle, ShieldAlert, ArrowRight, TrendingUp, ClipboardList, CheckCircle2, Package, Clock, AlertOctagon } from 'lucide-react';
import { isAdmin } from '../../services/permissions';
import type { LucideIcon } from 'lucide-react';

export default function Dashboard() {
  const { user, stats, equipments, actionPlans, conflictCounts, setCurrentTab } = useAppStore();
  const navigate = useNavigate();

  const alertEquipments = equipments.filter(eq => eq.status === 'vencido' || eq.status === 'pendente').slice(0, 3);

  const vencidos = equipments.filter(eq => eq.status === 'vencido');
  const pendentes = equipments.filter(eq => eq.status === 'pendente');
  const planosAbertos = actionPlans.filter(
    p => p.status === 'Aberta' || p.status === 'Em andamento' || p.status === 'Vencida',
  );
  const totalAlertsImportantes = vencidos.length + pendentes.length + planosAbertos.length;

  const alertCategories = [
    {
      title: 'Vencidos',
      count: vencidos.length,
      items: vencidos.slice(0, 3).map(eq => ({
        id: eq.id,
        primary: `${eq.tipo}${eq.subtipo ? ` · ${eq.subtipo}` : ''}`,
        secondary: `${eq.local} · ${eq.setor}`,
        onClick: () => navigate(`/equipamentos/${eq.id}`),
      })),
      headerIcon: ShieldAlert,
      headerIconClass: 'bg-red-50 text-critical',
      countClass: 'bg-red-100 text-critical',
      emptyMessage: 'Nenhum item vencido',
      onSeeAll: () => navigate('/equipamentos'),
    },
    {
      title: 'Pendentes',
      count: pendentes.length,
      items: pendentes.slice(0, 3).map(eq => ({
        id: eq.id,
        primary: `${eq.tipo}${eq.subtipo ? ` · ${eq.subtipo}` : ''}`,
        secondary: `${eq.local} · ${eq.setor}`,
        onClick: () => navigate(`/equipamentos/${eq.id}`),
      })),
      headerIcon: AlertTriangle,
      headerIconClass: 'bg-amber-50 text-pending',
      countClass: 'bg-amber-100 text-pending',
      emptyMessage: 'Nenhum item pendente',
      onSeeAll: () => navigate('/equipamentos'),
    },
    {
      title: 'Planos de Ação',
      count: planosAbertos.length,
      items: planosAbertos.slice(0, 3).map(p => ({
        id: p.id,
        primary: p.equipmentId,
        secondary: p.local,
        onClick: () => navigate('/planodeacao'),
      })),
      headerIcon: ClipboardList,
      headerIconClass: 'bg-blue-50 text-blue-600',
      countClass: 'bg-blue-100 text-blue-600',
      emptyMessage: 'Nenhum plano em aberto',
      onSeeAll: () => navigate('/planodeacao'),
    },
  ];

  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (stats.conformidade / 100) * circumference;

  const handleNewInspection = () => {
    setCurrentTab('inspecionar');
    navigate('/scan');
  };

  const initials = user?.nome
    ? user.nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : 'FC';

  const safeTotal = stats.total > 0 ? stats.total : 1;
  const pctOfTotal = (n: number) => Math.round((n / safeTotal) * 100);
  const hasData = stats.total > 0;

  const statusCards: {
    key: string;
    label: string;
    value: number;
    color: string;
    accent: string;
    icon: LucideIcon;
    iconBg: string;
    sub: string;
  }[] = [
    {
      key: 'total',
      label: 'Total',
      value: stats.total,
      color: 'text-gray-700',
      accent: 'border-l-gray-300',
      icon: Package,
      iconBg: 'bg-gray-100 text-gray-500',
      sub: 'Equipamentos cadastrados',
    },
    {
      key: 'emDia',
      label: 'Em Dia',
      value: stats.emDia,
      color: 'text-success',
      accent: 'border-l-success',
      icon: CheckCircle2,
      iconBg: 'bg-green-50 text-success',
      sub: hasData ? `${pctOfTotal(stats.emDia)}% do total` : 'Sem dados',
    },
    {
      key: 'pendentes',
      label: 'Pendentes',
      value: stats.pendentes,
      color: 'text-pending',
      accent: 'border-l-pending',
      icon: Clock,
      iconBg: 'bg-amber-50 text-pending',
      sub: hasData ? `${pctOfTotal(stats.pendentes)}% do total` : 'Sem dados',
    },
    {
      key: 'vencidos',
      label: 'Vencidos',
      value: stats.vencidos,
      color: 'text-critical',
      accent: 'border-l-critical',
      icon: ShieldAlert,
      iconBg: 'bg-red-50 text-critical',
      sub: hasData ? `${pctOfTotal(stats.vencidos)}% do total` : 'Sem dados',
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Welcome + Compliance (hero) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Greeting card — slim, single-row on desktop */}
        <div className="lg:col-span-2 card-subtle bg-white p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
          <div className="w-11 h-11 sm:w-12 sm:h-12 bg-primary rounded-xl flex items-center justify-center text-white font-black text-sm sm:text-base shadow-sm flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg lg:text-xl font-black text-gray-900 truncate">
                Olá, {user?.nome?.split(' ')[0] || 'Inspetor'}!
              </h2>
              {isAdmin(user) && (
                <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary text-white flex-shrink-0">
                  Admin
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 truncate">
              {user?.cargo || 'Inspetor'} · {stats.total} equipamentos · {stats.conformidade}% conformidade
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex-shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            Online
          </div>
        </div>

        {/* Compliance — focal card with donut + breakdown */}
        <div className="card-subtle bg-white p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="label-uppercase">Conformidade Geral</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              {stats.conformidade}% regular
            </span>
          </div>
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 mx-auto">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                className="text-gray-100"
                strokeWidth="12"
                stroke="currentColor"
                fill="transparent"
                r={radius}
                cx="50"
                cy="50"
              />
              <circle
                className="text-success transition-all duration-1000 ease-out"
                strokeWidth="12"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r={radius}
                cx="50"
                cy="50"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl sm:text-3xl font-extrabold text-gray-800 tabular-nums leading-none">
                {stats.conformidade}%
              </span>
              <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider mt-1">
                Em dia
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-50">
            <div className="text-center">
              <span className="block text-base font-extrabold text-success tabular-nums">{stats.emDia}</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Em dia</span>
            </div>
            <div className="text-center border-x border-gray-50">
              <span className="block text-base font-extrabold text-pending tabular-nums">{stats.pendentes}</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pend.</span>
            </div>
            <div className="text-center">
              <span className="block text-base font-extrabold text-critical tabular-nums">{stats.vencidos}</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Venc.</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI cards — 2-col on mobile, 4-col on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statusCards.map(card => {
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              className={`kpi-card border-l-[3px] ${card.accent}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="label-uppercase">{card.label}</span>
                <span className={`kpi-card__icon ${card.iconBg}`}>
                  <Icon className="w-4 h-4" />
                </span>
              </div>
              <span className={`kpi-card__value ${card.color}`}>{card.value}</span>
              <span className="kpi-card__sub">{card.sub}</span>
            </div>
          );
        })}
      </div>

      {/* Quick actions — split on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
        <div
          onClick={handleNewInspection}
          className="border-2 border-dashed border-gray-300 rounded-xl p-5 lg:p-6 flex flex-row lg:flex-col items-center justify-start lg:justify-center gap-4 bg-gray-50/50 hover:bg-gray-50 cursor-pointer transition-all active:scale-[0.99]"
        >
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary flex-shrink-0">
            <QrCode className="w-6 h-6" />
          </div>
          <div className="text-left lg:text-center">
            <span className="text-sm font-bold text-gray-800 uppercase tracking-wide block">
              Escanear QR Code
            </span>
            <span className="text-xs text-gray-500 mt-0.5 block">
              Aponte para a etiqueta do equipamento
            </span>
          </div>
        </div>
        <button
          onClick={handleNewInspection}
          className="btn-primary h-auto lg:h-full min-h-[5rem] lg:min-h-0 py-4 lg:py-0"
        >
          <Plus className="w-5 h-5" />
          Nova Inspeção Manual
        </button>
      </div>

      {/* Conflitos de sincronização */}
      {(conflictCounts.equipments > 0 || conflictCounts.actionPlans > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-critical flex-shrink-0" />
            <span className="text-sm font-black text-critical uppercase tracking-wider">
              Conflito{conflictCounts.equipments + conflictCounts.actionPlans > 1 ? 's' : ''} de sincronização
            </span>
          </div>
          <p className="text-xs sm:text-sm text-red-800 font-medium">
            {conflictCounts.equipments > 0 && `${conflictCounts.equipments} equipamento${conflictCounts.equipments > 1 ? 's' : ''}`}
            {conflictCounts.equipments > 0 && conflictCounts.actionPlans > 0 && ' e '}
            {conflictCounts.actionPlans > 0 && `${conflictCounts.actionPlans} plano${conflictCounts.actionPlans > 1 ? 's' : ''} de ação`}
            {' '}com alterações conflitantes. Os registros foram preservados localmente e o sync automático foi bloqueado. Revise e resolva os conflitos manualmente.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {conflictCounts.equipments > 0 && (
              <button
                onClick={() => navigate('/equipamentos')}
                className="btn-sm bg-white border border-red-200 text-critical font-bold hover:bg-red-50"
              >
                Ver equipamentos
              </button>
            )}
            {conflictCounts.actionPlans > 0 && (
              <button
                onClick={() => navigate('/planodeacao')}
                className="btn-sm bg-white border border-red-200 text-critical font-bold hover:bg-red-50"
              >
                Ver planos de ação
              </button>
            )}
          </div>
        </div>
      )}

      {/* Alertas Importantes — resumo por categoria */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="label-uppercase">Alertas Importantes</span>
          {totalAlertsImportantes > 0 && (
            <span className="pill bg-red-100 text-critical">
              {totalAlertsImportantes} {totalAlertsImportantes === 1 ? 'alerta' : 'alertas'}
            </span>
          )}
        </div>

        {totalAlertsImportantes === 0 ? (
          <div className="card-subtle bg-white flex flex-col items-center justify-center py-10 text-center gap-2">
            <div className="w-14 h-14 bg-green-50 text-success rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <p className="text-sm font-bold text-gray-700">Tudo em conformidade</p>
            <p className="text-xs text-gray-400 max-w-xs">
              Nenhum equipamento vencido, pendente ou plano de ação em aberto.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {alertCategories.map(cat => {
              const HeaderIcon = cat.headerIcon;
              return (
                <div key={cat.title} className="card-subtle bg-white p-0 overflow-hidden flex flex-col">
                  <button
                    onClick={cat.onSeeAll}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border-b border-gray-50 hover:bg-gray-50/60 transition-colors text-left min-h-[44px]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`p-1.5 rounded-lg flex-shrink-0 ${cat.headerIconClass}`}>
                        <HeaderIcon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-600 truncate">
                        {cat.title}
                      </span>
                    </div>
                    <span className={`pill flex-shrink-0 ${cat.countClass}`}>{cat.count}</span>
                  </button>

                  {cat.count === 0 ? (
                    <p className="text-xs text-gray-400 font-medium px-3 py-5 text-center">
                      {cat.emptyMessage}
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-50">
                      {cat.items.map(item => (
                        <li key={item.id}>
                          <button
                            onClick={item.onClick}
                            className="w-full text-left px-3 py-2.5 hover:bg-gray-50/60 transition-colors flex items-center justify-between gap-2 min-h-[44px]"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-gray-800 truncate">{item.primary}</p>
                              <p className="text-[10px] text-gray-400 truncate">{item.secondary}</p>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {cat.count > 3 && (
                    <button
                      onClick={cat.onSeeAll}
                      className="w-full text-[11px] font-bold uppercase tracking-wider text-gray-500 hover:text-primary hover:bg-gray-50/60 transition-colors py-2 border-t border-gray-50 min-h-[36px]"
                    >
                      Ver todos ({cat.count})
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Critical Alerts */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="label-uppercase">Alertas Críticos</span>
          {alertEquipments.length > 0 && (
            <span className="pill bg-red-100 text-critical">
              {alertEquipments.length} {alertEquipments.length === 1 ? 'item' : 'itens'}
            </span>
          )}
        </div>
        {alertEquipments.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {alertEquipments.map(eq => (
              <div key={eq.id} className="card-subtle bg-white flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex gap-2 min-w-0">
                    <div className={`p-1.5 rounded-lg flex-shrink-0 ${eq.status === 'vencido' ? 'bg-red-50 text-critical' : 'bg-amber-50 text-pending'}`}>
                      {eq.status === 'vencido' ? <ShieldAlert className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-gray-800 truncate">{eq.tipo} {eq.subtipo && `· ${eq.subtipo}`}</h4>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{eq.local} · {eq.setor}</p>
                    </div>
                  </div>
                  <span className={`pill flex-shrink-0 ${
                    eq.status === 'vencido' ? 'bg-red-100 text-critical' : 'bg-amber-100 text-pending'
                  }`}>
                    {eq.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    onClick={() => navigate(`/equipamentos/${eq.id}`)}
                    className="btn-ghost btn-sm btn-auto"
                  >
                    Ver Detalhes
                  </button>
                  <button
                    onClick={() => {
                      setCurrentTab('inspecionar');
                      navigate(`/inspecionar?id=${eq.id}`);
                    }}
                    className="btn-primary btn-sm btn-auto"
                  >
                    Inspecionar
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card-subtle bg-white flex flex-col items-center justify-center py-8 text-center gap-2">
            <div className="w-12 h-12 bg-green-50 text-success rounded-full flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-gray-500">Nenhum alerta pendente</p>
            <p className="text-xs text-gray-400">Todos os equipamentos estão em conformidade.</p>
          </div>
        )}
      </div>
    </div>
  );
}
