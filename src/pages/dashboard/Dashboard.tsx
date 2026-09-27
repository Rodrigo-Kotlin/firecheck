import { useMemo, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../../store';
import { Plus, AlertTriangle, ShieldAlert, ClipboardList, CheckCircle2, Package, Clock, AlertOctagon, WifiOff, ShieldCheck, Eye, FileText } from 'lucide-react';
import { getControlCenterIndicators, type ControlCenterIndicators } from '../../utils/controlCenterIndicators';
import { getControlCenterCharts, getControlCenterPeriodRange, type ControlCenterChartsResult, type PeriodOption } from '../../utils/controlCenterCharts';
import ControlCenterFilters from '../../components/dashboard/ControlCenterFilters';
import { filterControlCenterData, getControlCenterFilterOptions, hasControlCenterFilters, parseControlCenterFilters, withControlCenterParams, type ControlCenterFilters as FilterState } from '../../utils/controlCenterFilters';
import type { LucideIcon } from 'lucide-react';
import EquipmentSituationChart from '../../components/charts/EquipmentSituationChart';
import InspectionsByPeriodChart from '../../components/charts/InspectionsByPeriodChart';
import ActionPlansChart from '../../components/charts/ActionPlansChart';
import SectorOccurrencesChart from '../../components/charts/SectorOccurrencesChart';
import PeriodSelector from '../../components/charts/PeriodSelector';

type PriorityItem = {
  id: string;
  equipmentId: string;
  tipo: string;
  subtipo?: string;
  local: string;
  setor: string;
  reasons: string[];
  deadlineStatus: 'vencido' | 'proximo_vencimento' | 'sem_prazo';
  dataProximaInspecao?: string;
  planoId?: string;
  planoStatus?: string;
  planoPrazo?: string;
  planoResponsavel?: string;
  planoCriticidade?: string;
};

function formatReason(reason: string): { label: string; icon: LucideIcon; className: string } {
  switch (reason) {
    case 'nao_conformidade':
      return { label: 'Não conformidade', icon: AlertTriangle, className: 'bg-amber-50 text-pending' };
    case 'observacao':
      return { label: 'Observação', icon: AlertTriangle, className: 'bg-gray-50 text-gray-600' };
    case 'prazo':
      return { label: 'Prazo vencido', icon: ShieldAlert, className: 'bg-red-50 text-critical' };
    case 'proximo_prazo':
      return { label: 'Próximo vencimento', icon: Clock, className: 'bg-amber-50 text-pending' };
    case 'sem_inspecao':
      return { label: 'Sem inspeção', icon: FileText, className: 'bg-blue-50 text-blue-600' };
    case 'plano_atrasado':
      return { label: 'Plano atrasado', icon: ClipboardList, className: 'bg-red-50 text-critical' };
    default:
      return { label: reason, icon: AlertTriangle, className: 'bg-gray-50 text-gray-600' };
  }
}

function formatDeadlineStatus(status: string): { label: string; className: string } {
  switch (status) {
    case 'vencido':
      return { label: 'Vencido', className: 'bg-red-50 text-critical border-red-200' };
    case 'proximo_vencimento':
      return { label: 'Próximo', className: 'bg-amber-50 text-pending border-amber-200' };
    case 'sem_prazo':
      return { label: 'Sem prazo', className: 'bg-gray-50 text-gray-500 border-gray-200' };
    default:
      return { label: status, className: 'bg-gray-50 text-gray-500 border-gray-200' };
  }
}

export default function Dashboard() {
  const {
    equipments,
    inspections,
    actionPlans,
    networkUnavailable,
    setCurrentTab,
  } = useAppStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [now, setNow] = useState(() => new Date());
  const [chartPeriod, setChartPeriod] = useState<PeriodOption>('6m');

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const todayYmd = useMemo(() => {
    const d = now;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [now]);

  const filterOptions = useMemo(() => getControlCenterFilterOptions(equipments), [equipments]);
  const filters = useMemo<FilterState>(() => parseControlCenterFilters(searchParams, filterOptions), [searchParams, filterOptions]);
  const filteredData = useMemo(
    () => filterControlCenterData(equipments, inspections, actionPlans, filters),
    [equipments, inspections, actionPlans, filters],
  );
  const filteredView = hasControlCenterFilters(filters);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    let changed = false;
    for (const key of ['setor', 'local', 'tipo'] as const) {
      const raw = searchParams.get(key);
      if (raw && !filters[key]) {
        next.delete(key);
        changed = true;
      } else if (raw && raw !== filters[key]) {
        next.set(key, filters[key]);
        changed = true;
      }
    }
    if (changed) setSearchParams(next, { replace: true });
  }, [searchParams, filters, setSearchParams]);

  const updateFilter = (key: keyof FilterState, value: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    });
  };

  const clearControlCenterFilters = () => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('setor');
      next.delete('local');
      next.delete('tipo');
      return next;
    });
  };

  const indicators = useMemo<ControlCenterIndicators>(
    () => getControlCenterIndicators(filteredData.equipments, filteredData.inspections, filteredData.actionPlans, { todayYmd }),
    [filteredData, todayYmd]
  );

  const priorityItems = useMemo<PriorityItem[]>(() => {
    const itemsMap = new Map<string, PriorityItem>();

    for (const eqId of indicators.equipment.requiresAttention.ids) {
       const eq = filteredData.equipments.find(e => e.id === eqId);
      if (!eq) continue;

      const reasons = new Set<string>();
      if (indicators.equipment.noInspection.ids.includes(eqId)) reasons.add('sem_inspecao');
      if (indicators.equipment.inObservation.ids.includes(eqId)) reasons.add('observacao');
      if (indicators.equipment.lastInspectionNonConformity.ids.includes(eqId)) reasons.add('nao_conformidade');
      if (indicators.equipment.inspectionsOverdue.ids.includes(eqId)) reasons.add('prazo');
      if (indicators.equipment.inspectionsNearDeadline.ids.includes(eqId)) reasons.add('proximo_prazo');

      let deadlineStatus: PriorityItem['deadlineStatus'] = 'sem_prazo';
      if (indicators.equipment.inspectionsOverdue.ids.includes(eqId)) deadlineStatus = 'vencido';
      else if (indicators.equipment.inspectionsNearDeadline.ids.includes(eqId)) deadlineStatus = 'proximo_vencimento';

      let planoId: string | undefined;
      let planoStatus: string | undefined;
      let planoPrazo: string | undefined;
      let planoResponsavel: string | undefined;
      let planoCriticidade: string | undefined;

       const plan = filteredData.actionPlans.find(p => p.equipmentId === eqId && !p.deletedAt && p.status !== 'Concluída');
      if (plan) {
        planoId = plan.id;
        planoStatus = plan.status;
        planoPrazo = plan.prazo;
        planoResponsavel = plan.responsavel;
        planoCriticidade = plan.criticidade;
        if (plan.status === 'Vencida' || (plan.prazo && normalizeYmdPlan(plan.prazo) && isBeforeToday(normalizeYmdPlan(plan.prazo)!))) {
          reasons.add('plano_atrasado');
        }
      }

      itemsMap.set(eqId, {
        id: eqId,
        equipmentId: eqId,
        tipo: eq.tipo,
        subtipo: eq.subtipo,
        local: eq.local,
        setor: eq.setor,
        reasons: Array.from(reasons),
        deadlineStatus,
        dataProximaInspecao: eq.dataProximaInspecao,
        planoId,
        planoStatus,
        planoPrazo,
        planoResponsavel,
        planoCriticidade,
      });
    }

    const items = Array.from(itemsMap.values());

    items.sort((a, b) => {
      const reasonPriority = (reasons: string[]) => {
        if (reasons.includes('nao_conformidade') || reasons.includes('plano_atrasado')) return 0;
        if (reasons.includes('prazo')) return 1;
        if (reasons.includes('proximo_prazo')) return 2;
        if (reasons.includes('observacao')) return 3;
        if (reasons.includes('sem_inspecao')) return 4;
        return 5;
      };
      const pa = reasonPriority(a.reasons);
      const pb = reasonPriority(b.reasons);
      if (pa !== pb) return pa - pb;
      return a.equipmentId.localeCompare(b.equipmentId);
    });

    return items.slice(0, 5);
  }, [indicators, filteredData.equipments, filteredData.actionPlans]);

  const mainIndicators = [
    {
      label: 'Cadastrados',
      value: indicators.equipment.registered.count,
      icon: Package,
      iconBg: 'bg-gray-100 text-gray-500',
      color: 'text-gray-700',
      accent: 'border-l-gray-300',
       href: withControlCenterParams('/equipamentos', filters, { view: 'registered' }),
    },
    {
      label: 'Cobertura',
      value: `${indicators.equipment.coverage.inspectedIds.length} / ${indicators.equipment.coverage.eligibleIds.length}`,
      percent: `${indicators.equipment.coverage.percentage}%`,
      icon: ClipboardList,
      iconBg: 'bg-blue-50 text-blue-600',
      color: 'text-blue-600',
      accent: 'border-l-blue-500',
       href: withControlCenterParams('/equipamentos', filters, { ccView: 'inspected' }),
    },
    {
      label: 'Em dia',
      value: indicators.equipment.upToDate.count,
      icon: CheckCircle2,
      iconBg: 'bg-green-50 text-success',
      color: 'text-success',
      accent: 'border-l-success',
       href: withControlCenterParams('/equipamentos', filters, { ccView: 'up-to-date' }),
    },
    {
      label: 'Atenção imediata',
      value: indicators.equipment.requiresAttention.count,
      icon: AlertOctagon,
      iconBg: 'bg-red-50 text-critical',
      color: 'text-critical',
      accent: 'border-l-critical',
       href: withControlCenterParams('/equipamentos', filters, { ccView: 'attention' }),
    },
  ];

  const secondaryIndicators = [
    {
      label: 'Sem inspeção',
      count: indicators.equipment.noInspection.count,
      icon: FileText,
      iconBg: 'bg-blue-50 text-blue-600',
      color: 'text-blue-600',
       href: withControlCenterParams('/equipamentos', filters, { ccView: 'no-inspection' }),
    },
    {
      label: 'Em observação',
      count: indicators.equipment.inObservation.count,
      icon: AlertTriangle,
      iconBg: 'bg-gray-50 text-gray-500',
      color: 'text-gray-600',
       href: withControlCenterParams('/equipamentos', filters, { ccView: 'observation' }),
    },
    {
      label: 'Inspeções atrasadas',
      count: indicators.equipment.inspectionsOverdue.count,
      icon: ShieldAlert,
      iconBg: 'bg-red-50 text-critical',
      color: 'text-critical',
       href: withControlCenterParams('/equipamentos', filters, { ccView: 'inspection-overdue' }),
    },
    {
      label: 'Planos atrasados',
      count: indicators.actionPlans.overdue.count,
      icon: ClipboardList,
      iconBg: 'bg-red-50 text-critical',
      color: 'text-critical',
       href: withControlCenterParams('/planodeacao', filters, { overdue: '1' }),
    },
    {
      label: 'Próximos vencimentos',
      count: indicators.equipment.inspectionsNearDeadline.count,
      icon: Clock,
      iconBg: 'bg-amber-50 text-pending',
      color: 'text-pending',
       href: withControlCenterParams('/equipamentos', filters, { ccView: 'near-deadline' }),
    },
    {
      label: 'NC sem plano',
      count: indicators.specialCategories.nonConformitiesWithoutPlan.count,
      icon: AlertOctagon,
      iconBg: 'bg-orange-50 text-orange-600',
      color: 'text-orange-600',
       href: withControlCenterParams('/equipamentos', filters, { ccView: 'no-conformity-plan' }),
    },
  ];

  const charts = useMemo<ControlCenterChartsResult>(
    () => getControlCenterCharts(filteredData.equipments, filteredData.inspections, filteredData.actionPlans, { todayYmd, period: chartPeriod }),
    [filteredData, todayYmd, chartPeriod]
  );

  const navigateEquipmentView = (ccView: string, extra: Record<string, string | null | undefined> = {}) =>
    navigate(withControlCenterParams('/equipamentos', filters, { ccView, ...extra }));

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Data source notice when offline */}
      {networkUnavailable && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-center gap-2">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <span>Offline — exibindo dados deste dispositivo. Algumas informações podem estar desatualizadas.</span>
        </div>
      )}

      <ControlCenterFilters
        options={filterOptions}
        value={filters}
        active={filteredView}
        onChange={updateFilter}
        onClear={clearControlCenterFilters}
      />

      {/* Main Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {mainIndicators.map((indicator, idx) => {
          const Icon = indicator.icon;
          const isCoverage = idx === 1;
          return (
            <Link
              key={indicator.label}
              to={indicator.href}
              aria-label={`Ver ${indicator.label.toLowerCase()}${isCoverage ? `: ${indicator.percent}, ${indicator.value} equipamentos` : `: ${indicator.value}`}`}
              className={`kpi-card kpi-card--compact border-l-[3px] ${indicator.accent} cursor-pointer no-underline hover:border-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.99]`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="label-uppercase">{indicator.label}</span>
                <span className={`kpi-card__icon ${indicator.iconBg}`}>
                  <Icon className="w-4 h-4" />
                </span>
              </div>
              <span className={`kpi-card__value ${indicator.color}`}>{isCoverage ? indicator.percent : indicator.value}</span>
              {isCoverage && <span className="sr-only">{indicator.value} equipamentos elegíveis com inspeção</span>}
            </Link>
          );
        })}
      </div>

      {/* Secondary Indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {secondaryIndicators.map(indicator => {
          const Icon = indicator.icon;
          return (
            <Link
              key={indicator.label}
              to={indicator.href}
              className="card-subtle bg-white p-2.5 sm:p-3 flex flex-col gap-1.5 hover:border-primary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <div className="flex items-center gap-2">
                <span className={`kpi-card__icon ${indicator.iconBg}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <span className="label-uppercase text-[10px] flex-1 leading-tight min-h-[2.25rem]">{indicator.label}</span>
              </div>
              <span className={`text-xl font-black ${indicator.color}`}>{indicator.count}</span>
            </Link>
          );
        })}
      </div>

      {/* Priority Queue */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="label-uppercase">Prioridades que exigem atenção</span>
          {priorityItems.length > 0 && (
            <span className="pill bg-red-100 text-critical">{priorityItems.length}</span>
          )}
        </div>

        {priorityItems.length === 0 ? (
          <div className="card-subtle bg-white flex flex-col items-center justify-center py-8 text-center gap-2">
            <div className="w-12 h-12 bg-green-50 text-success rounded-full flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-gray-700">Nenhuma prioridade identificada</p>
            <p className="text-xs text-gray-400 max-w-xs">
              Todos os equipamentos operacionais estão em conformidade.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {priorityItems.map(item => {
              const mainReason = item.reasons[0];
              const reasonInfo = formatReason(mainReason);
              const ReasonIcon = reasonInfo.icon;
              const deadlineInfo = formatDeadlineStatus(item.deadlineStatus);

              return (
                <div
                  key={item.id}
                  className="card-subtle bg-white border-l-[3px] border-l-gray-200 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`p-2 rounded-lg flex-shrink-0 ${reasonInfo.className}`}>
                      <ReasonIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-extrabold text-gray-900 bg-gray-50 px-1.5 py-0.5 rounded tracking-tight">
                          {item.equipmentId}
                        </span>
                        <span className="text-sm font-bold text-gray-800 truncate">
                          {item.tipo}{item.subtipo && ` · ${item.subtipo}`}
                        </span>
                        <span className={`pill border ${deadlineInfo.className}`}>
                          {deadlineInfo.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 font-medium mt-0.5 truncate">
                        {item.local} · {item.setor}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {item.reasons.slice(0, 3).map((reason) => {
                          const r = formatReason(reason);
                          const RIcon = r.icon;
                          return (
                            <span key={reason} className={`pill text-[9px] font-medium ${r.className} border flex items-center gap-1`}>
                              <RIcon className="w-2.5 h-2.5" />
                              {r.label}
                            </span>
                          );
                        })}
                        {item.reasons.length > 3 && (
                          <span className="pill text-[9px] font-medium bg-gray-50 text-gray-500 border">
                            +{item.reasons.length - 3}
                          </span>
                        )}
                      </div>
                      {(item.dataProximaInspecao || item.planoPrazo) && (
                        <div className="flex flex-wrap gap-2 text-[10px] text-gray-500 mt-1.5">
                          {item.dataProximaInspecao && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Próx. inspeção: {item.dataProximaInspecao}
                            </span>
                          )}
                          {item.planoPrazo && (
                            <span className="flex items-center gap-1">
                              <ClipboardList className="w-3 h-3" />
                              Prazo plano: {item.planoPrazo}
                            </span>
                          )}
                          {item.planoResponsavel && (
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              Resp.: {item.planoResponsavel}
                            </span>
                          )}
                          {item.planoCriticidade && (
                            <span className="pill bg-gray-50 text-gray-500 border">
                              {item.planoCriticidade}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
                     <Link
                       to={withControlCenterParams(`/equipamentos/${item.equipmentId}`, filters)}
                      className="btn-ghost btn-sm btn-auto"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Ver equipamento</span>
                    </Link>
                    {item.planoId && (
                      <Link
                         to={withControlCenterParams('/planodeacao', filters, { planId: item.planoId })}
                        className="btn-ghost btn-sm btn-auto"
                      >
                        <ClipboardList className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Ver plano</span>
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        setCurrentTab('inspecionar');
                        navigate(`/inspecionar?id=${item.equipmentId}`);
                      }}
                      className="btn-primary btn-sm btn-auto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Inspecionar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Gráficos da Central de Controle */}
        <section className="space-y-4" aria-labelledby="charts-title">
          <div className="flex items-center justify-between">
            <h2 id="charts-title" className="label-uppercase">Gráficos Gerenciais</h2>
            <PeriodSelector value={chartPeriod} onChange={setChartPeriod} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <EquipmentSituationChart
              data={charts.equipmentSituation}
              title="Situação dos Equipamentos"
              description="Distribuição operacional baseada na última inspeção e prazos vigentes"
              onSelectCategory={category => navigateEquipmentView(`situation:${category}`)}
            />
            <InspectionsByPeriodChart
              data={charts.inspectionsByPeriod}
              title="Inspeções por Período"
              description="Volume de inspeções realizadas agrupadas por resultado"
              period={chartPeriod}
              onSelectPeriod={() => {
                const range = getControlCenterPeriodRange(todayYmd, chartPeriod);
                navigate(withControlCenterParams('/relatorios', filters, { from: range.startYmd, to: range.endYmd }));
              }}
              onSelectStatus={status => {
                const range = getControlCenterPeriodRange(todayYmd, chartPeriod);
                navigate(withControlCenterParams('/relatorios', filters, { from: range.startYmd, to: range.endYmd, status }));
              }}
            />
            <ActionPlansChart
              data={charts.actionPlans}
              overdueData={charts.overduePlans}
              title="Planos de Ação"
              description="Distribuição por status e planos com prazo ultrapassado"
              onSelectStatus={status => navigate(withControlCenterParams('/planodeacao', filters, { status }))}
              onSelectOverdue={() => navigate(withControlCenterParams('/planodeacao', filters, { overdue: '1' }))}
            />
            <SectorOccurrencesChart
              data={charts.sectorOccurrences}
              title="Não Conformidades por Setor"
              description="Equipamentos com última inspeção pendente ou vencida, agrupados por setor"
              onSelectSector={sector => navigateEquipmentView('sector', { sector })}
            />
          </div>
        </section>
      </section>
    </div>
  );
}

function normalizeYmdPlan(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (y < 1 || y > 9999 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${year}-${month}-${day}`;
}

function isBeforeToday(ymd: string): boolean {
  const today = new Date();
  const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return ymd < todayYmd;
}
