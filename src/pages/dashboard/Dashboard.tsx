import { useMemo, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../../store';
import { AlertTriangle, ShieldAlert, ClipboardList, CheckCircle2, Package, Clock, AlertOctagon, WifiOff, ShieldCheck, Eye, FileText } from 'lucide-react';
import { getControlCenterIndicators, type ControlCenterIndicators } from '../../utils/controlCenterIndicators';
import { getControlCenterCharts, getControlCenterPeriodRange, type ControlCenterChartsResult, type PeriodOption } from '../../utils/controlCenterCharts';
import ControlCenterFilters from '../../components/dashboard/ControlCenterFilters';
import { filterControlCenterData, getControlCenterFilterOptions, hasControlCenterFilters, parseControlCenterFilters, withControlCenterParams, type ControlCenterFilters as FilterState } from '../../utils/controlCenterFilters';
import { formatCivilDate } from '../../utils/dateFormatting';
import type { LucideIcon } from 'lucide-react';
import EquipmentSituationChart from '../../components/charts/EquipmentSituationChart';
import InspectionsByPeriodChart from '../../components/charts/InspectionsByPeriodChart';
import ActionPlansChart from '../../components/charts/ActionPlansChart';
import SectorOccurrencesChart from '../../components/charts/SectorOccurrencesChart';
import PeriodSelector from '../../components/charts/PeriodSelector';
import { getPriorityEmptyStateCopy } from '../../utils/dashboardEmptyState';

type PriorityItem = {
  id: string;
  equipmentId: string;
  tipo: string;
  subtipo?: string;
  local: string;
  setor: string;
  reasons: string[];
  deadlineStatus: 'vencido' | 'proximo_vencimento' | 'em_dia' | 'sem_prazo';
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
    case 'nao_conformidade_sem_plano':
      return { label: 'NC sem plano', icon: AlertOctagon, className: 'bg-orange-50 text-orange-600' };
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

function quantityLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatDeadlineStatus(status: string): { label: string; className: string } {
  switch (status) {
    case 'vencido':
      return { label: 'Vencido', className: 'bg-red-50 text-critical border-red-200' };
    case 'proximo_vencimento':
      return { label: 'Próximo', className: 'bg-amber-50 text-pending border-amber-200' };
    case 'em_dia':
      return { label: 'Prazo vigente', className: 'bg-green-50 text-success border-green-200' };
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
    actionPlanItems,
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
  const priorityEmptyState = getPriorityEmptyStateCopy(filteredView);

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
    () => getControlCenterIndicators(filteredData.equipments, filteredData.inspections, filteredData.actionPlans, {
      todayYmd,
      source: networkUnavailable ? 'local_pending_sync' : 'local_snapshot',
      actionPlanItems,
    }),
    [filteredData, todayYmd, networkUnavailable, actionPlanItems]
  );

  const priorityItems = useMemo<PriorityItem[]>(() => {
    const itemsMap = new Map<string, PriorityItem>();

     const queueIds = new Set([
       ...indicators.equipment.requiresAttention.ids,
       ...indicators.equipment.noInspection.ids,
       ...indicators.equipment.inspectionsOverdue.ids,
       ...indicators.equipment.inspectionsNearDeadline.ids,
     ]);
     for (const eqId of queueIds) {
       const eq = filteredData.equipments.find(e => e.id === eqId);
      if (!eq) continue;

      const reasons = new Set<string>();
      if (indicators.equipment.noInspection.ids.includes(eqId)) reasons.add('sem_inspecao');
      if (indicators.equipment.inObservation.ids.includes(eqId)) reasons.add('observacao');
       if (indicators.equipment.lastInspectionNonConformity.ids.includes(eqId)) reasons.add('nao_conformidade');
       if (indicators.specialCategories.nonConformitiesWithoutPlan.ids.includes(eqId)) reasons.add('nao_conformidade_sem_plano');
      if (indicators.equipment.inspectionsOverdue.ids.includes(eqId)) reasons.add('prazo');
      if (indicators.equipment.inspectionsNearDeadline.ids.includes(eqId)) reasons.add('proximo_prazo');

      let deadlineStatus: PriorityItem['deadlineStatus'] = 'sem_prazo';
      if (indicators.equipment.inspectionsOverdue.ids.includes(eqId)) deadlineStatus = 'vencido';
      else if (indicators.equipment.inspectionsNearDeadline.ids.includes(eqId)) deadlineStatus = 'proximo_vencimento';
      else if (indicators.deadlineClassification.emDia.ids.includes(eqId)) deadlineStatus = 'em_dia';

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
        if (plan.status === 'Vencida' || (plan.prazo && normalizeYmdPlan(plan.prazo) && normalizeYmdPlan(plan.prazo)! < todayYmd)) {
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

     const reasonPriority = (reasons: string[]) => {
       if (reasons.includes('nao_conformidade_sem_plano')) return 0;
       if (reasons.includes('nao_conformidade') || reasons.includes('plano_atrasado')) return 1;
       if (reasons.includes('prazo')) return 2;
       if (reasons.includes('observacao')) return 3;
       if (reasons.includes('sem_inspecao')) return 4;
       if (reasons.includes('proximo_prazo')) return 5;
       return 6;
     };
     const items = Array.from(itemsMap.values()).map(item => ({
       ...item,
       reasons: [...item.reasons].sort((a, b) => reasonPriority([a]) - reasonPriority([b])),
     }));

     items.sort((a, b) => {
       const pa = reasonPriority(a.reasons);
      const pb = reasonPriority(b.reasons);
      if (pa !== pb) return pa - pb;
      return a.equipmentId.localeCompare(b.equipmentId);
    });

    return items.slice(0, 5);
   }, [indicators, filteredData.equipments, filteredData.actionPlans, todayYmd]);

  const mainIndicators = [
    {
      label: 'Cadastrados',
      value: indicators.equipment.registered.count,
      description: 'Equipamentos ativos',
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
      description: `${indicators.equipment.coverage.inspectedIds.length} de ${indicators.equipment.coverage.eligibleIds.length} inspecionados · ${indicators.equipment.noInspection.count} sem inspeção`,
      icon: ClipboardList,
      iconBg: 'bg-blue-50 text-blue-600',
      color: 'text-blue-600',
      accent: 'border-l-blue-500',
       href: withControlCenterParams('/equipamentos', filters, { ccView: 'inspected' }),
    },
    {
      label: 'Em dia',
      description: 'Conformes na última inspeção',
      value: indicators.equipment.upToDate.count,
      icon: CheckCircle2,
      iconBg: 'bg-green-50 text-success',
      color: 'text-success',
      accent: 'border-l-success',
       href: withControlCenterParams('/equipamentos', filters, { ccView: 'up-to-date' }),
    },
    {
      label: 'Requer atenção',
      description: `${quantityLabel(indicators.equipment.inObservation.count, 'observação', 'observações')} · ${quantityLabel(indicators.equipment.lastInspectionNonConformity.count, 'não conformidade', 'não conformidades')}`,
      value: indicators.equipment.requiresAttention.count,
      icon: AlertOctagon,
      iconBg: 'bg-amber-50 text-pending',
      color: 'text-pending',
      accent: 'border-l-pending',
       href: withControlCenterParams('/equipamentos', filters, { ccView: 'attention' }),
    },
  ];

  const charts = useMemo<ControlCenterChartsResult>(
    () => getControlCenterCharts(filteredData.equipments, filteredData.inspections, filteredData.actionPlans, {
      todayYmd,
      period: chartPeriod,
      source: networkUnavailable ? 'local_pending_sync' : 'local_snapshot',
      actionPlanItems,
    }),
    [filteredData, todayYmd, chartPeriod, networkUnavailable, actionPlanItems]
  );

  const navigateEquipmentView = (ccView: string, extra: Record<string, string | null | undefined> = {}) =>
    navigate(withControlCenterParams('/equipamentos', filters, { ccView, ...extra }));

  return (
    <div className="space-y-2.5 sm:space-y-3.5">
      {/* Data source notice when offline */}
      {networkUnavailable && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs sm:text-sm text-amber-800 flex items-center gap-2">
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
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
               {'description' in indicator && indicator.description && <span className="text-[10px] text-gray-500 leading-tight">{indicator.description}</span>}
              {isCoverage && <span className="sr-only">{indicator.value} equipamentos elegíveis com inspeção</span>}
            </Link>
          );
        })}
      </div>

       {/* Management indicators */}
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 sm:gap-3.5">
         <Link
           to={withControlCenterParams('/planodeacao', filters)}
           className="card-subtle bg-white p-3 sm:p-4 flex items-start gap-3 border-l-[3px] border-l-primary hover:border-primary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
           aria-label={`Ver ${quantityLabel(indicators.actionPlans.open.count, 'plano aberto', 'planos abertos')} e ${quantityLabel(indicators.actionPlans.pendingItems.count, 'pendência aberta', 'pendências abertas')}`}
         >
           <span className="kpi-card__icon bg-blue-50 text-blue-600">
             <ClipboardList className="w-4 h-4" />
           </span>
           <span className="min-w-0 flex-1">
             <span className="label-uppercase block">Planos de ação</span>
             <span className="mt-1 block text-2xl font-black text-primary tabular-nums">
               {indicators.actionPlans.open.count}
             </span>
             <span className="text-xs text-gray-500">
               {quantityLabel(indicators.actionPlans.open.count, 'aberto', 'abertos')} · {quantityLabel(indicators.actionPlans.pendingItems.count, 'pendência aberta', 'pendências abertas')}
             </span>
           </span>
         </Link>

         <div className="card-subtle bg-white p-3 sm:p-4 border-l-[3px] border-l-gray-300">
           <div className="flex items-start gap-3">
             <span className="kpi-card__icon bg-gray-100 text-gray-600">
               <Clock className="w-4 h-4" />
             </span>
             <div className="min-w-0 flex-1">
               <span className="label-uppercase block">Prazos de inspeção</span>
               <div className="mt-2 grid grid-cols-2 divide-x divide-gray-100">
                 <Link
                   to={withControlCenterParams('/equipamentos', filters, { ccView: 'inspection-overdue' })}
                   className="pr-3 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                   aria-label={`Ver ${quantityLabel(indicators.equipment.inspectionsOverdue.count, 'equipamento vencido', 'equipamentos vencidos')}`}
                 >
                   <span className={`block text-2xl font-black tabular-nums ${indicators.equipment.inspectionsOverdue.count > 0 ? 'text-critical' : 'text-gray-700'}`}>
                     {indicators.equipment.inspectionsOverdue.count}
                   </span>
                   <span className="text-xs font-semibold text-gray-500">Vencidos</span>
                 </Link>
                 <Link
                   to={withControlCenterParams('/equipamentos', filters, { ccView: 'near-deadline' })}
                   className="pl-3 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                   aria-label={`Ver ${quantityLabel(indicators.equipment.inspectionsNearDeadline.count, 'próximo vencimento', 'próximos vencimentos')}`}
                 >
                   <span className={`block text-2xl font-black tabular-nums ${indicators.equipment.inspectionsNearDeadline.count > 0 ? 'text-pending' : 'text-gray-700'}`}>
                     {indicators.equipment.inspectionsNearDeadline.count}
                   </span>
                   <span className="text-xs font-semibold text-gray-500">Próximos 3 dias</span>
                 </Link>
               </div>
             </div>
           </div>
         </div>
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
             <p className="text-sm font-bold text-gray-700">{priorityEmptyState.title}</p>
             <p className="text-xs text-gray-400 max-w-xs">
               {priorityEmptyState.description}
             </p>
             {filteredView && (
               <button type="button" onClick={clearControlCenterFilters} className="btn-ghost btn-sm btn-auto mt-1">
                 Limpar filtros
               </button>
             )}
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
                   className="card-subtle bg-white border-l-[3px] border-l-gray-200 p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3"
                >
                   <div className="flex items-start gap-2.5 min-w-0 flex-1">
                     <div className={`p-1.5 rounded-lg flex-shrink-0 ${reasonInfo.className}`}>
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
                       <div className="flex flex-wrap gap-1 mt-1">
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
                         <div className="flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-gray-500 mt-1">
                          {item.dataProximaInspecao && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Próx. inspeção: {formatCivilDate(item.dataProximaInspecao)}
                            </span>
                          )}
                          {item.planoPrazo && (
                            <span className="flex items-center gap-1">
                              <ClipboardList className="w-3 h-3" />
                              Prazo plano: {formatCivilDate(item.planoPrazo)}
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
                  <div className="flex flex-wrap items-center justify-end gap-1.5 sm:flex-shrink-0">
                     <Link
                       to={withControlCenterParams(`/equipamentos/${item.equipmentId}`, filters)}
                       className="btn-ghost btn-sm btn-auto priority-action-secondary"
                       aria-label={`Ver equipamento ${item.equipmentId}`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Ver equipamento</span>
                    </Link>
                    {item.planoId && (
                      <Link
                         to={withControlCenterParams('/planodeacao', filters, { planId: item.planoId })}
                         className="btn-ghost btn-sm btn-auto priority-action-secondary"
                         aria-label={`Ver plano de ação ${item.equipmentId}`}
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
                       className="btn-primary btn-sm btn-auto priority-action-primary"
                        aria-label="Inspecionar equipamento"
                        title="Inspecionar equipamento"
                    >
                       <ClipboardList className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Inspecionar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Gráficos da Central de Controle */}
        <section className="space-y-3" aria-labelledby="charts-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="charts-title" className="label-uppercase">Gráficos Gerenciais</h2>
            <PeriodSelector value={chartPeriod} onChange={setChartPeriod} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            <EquipmentSituationChart
              data={charts.equipmentSituation}
              title="Situação dos Equipamentos"
               description="Resultado técnico da última inspeção; prazos são uma dimensão independente"
              onSelectCategory={category => navigateEquipmentView(`situation:${category}`)}
            />
            <InspectionsByPeriodChart
              data={charts.inspectionsByPeriod}
              title="Inspeções por Período"
              description="Volume de inspeções realizadas agrupadas por resultado"
              period={chartPeriod}
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
               title="Resultados das Inspeções por Setor"
               description="Resultados da última inspeção por setor"
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
