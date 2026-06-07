import { useState, useMemo } from 'react';
import { useAppStore } from '../../store';
import { useNavigate } from 'react-router-dom';
import type { ActionPlanStatus, Criticidade } from '../../types';
import {
  ChevronLeft,
  AlertOctagon,
  AlertTriangle,
  AlertCircle,
  ClipboardCheck,
  CheckCircle,
  CheckCircle2,
  Clock,
  Plus,
  X,
  Trash2,
  Search,
  Lock,
  User,
  MapPin,
  FileText,
  Calendar,
  type LucideIcon,
} from 'lucide-react';
import { canEditActionPlan, canDeleteActionPlan } from '../../services/permissions';

const CRITICIDADE_STYLES: Record<Criticidade, string> = {
  'Crítico': 'bg-red-100 text-critical border-red-200',
  'Alto': 'bg-orange-100 text-orange-600 border-orange-200',
  'Médio': 'bg-amber-100 text-pending border-amber-200',
  'Baixo': 'bg-gray-100 text-gray-500 border-gray-200',
};

const CRITICIDADE_BORDER: Record<Criticidade, string> = {
  'Crítico': 'border-l-critical',
  'Alto': 'border-l-orange-500',
  'Médio': 'border-l-pending',
  'Baixo': 'border-l-gray-300',
};

const CRITICIDADE_ICON_BG: Record<Criticidade, string> = {
  'Crítico': 'bg-red-50 text-critical',
  'Alto': 'bg-orange-50 text-orange-600',
  'Médio': 'bg-amber-50 text-pending',
  'Baixo': 'bg-gray-100 text-gray-500',
};

const CRITICIDADE_ICONS: Record<Criticidade, LucideIcon> = {
  'Crítico': AlertOctagon,
  'Alto': AlertTriangle,
  'Médio': AlertCircle,
  'Baixo': CheckCircle,
};

const STATUS_STYLES: Record<ActionPlanStatus, string> = {
  'Aberta': 'bg-red-50 text-critical',
  'Em andamento': 'bg-amber-50 text-pending',
  'Concluída': 'bg-green-50 text-success',
  'Vencida': 'bg-gray-100 text-gray-500',
};

const STATUS_ICONS: Record<ActionPlanStatus, LucideIcon> = {
  'Aberta': AlertCircle,
  'Em andamento': Clock,
  'Concluída': CheckCircle2,
  'Vencida': AlertTriangle,
};

const STATUS_OPTIONS: ActionPlanStatus[] = ['Aberta', 'Em andamento', 'Concluída', 'Vencida'];
const CRITICIDADE_OPTIONS: Criticidade[] = ['Crítico', 'Alto', 'Médio', 'Baixo'];

type PrazoWarning = {
  label: string;
  color: string;
  isVencido: boolean;
};

function getPrazoWarning(prazo: string, status: ActionPlanStatus): PrazoWarning | null {
  if (!prazo || status === 'Concluída') return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const prazoDate = new Date(prazo);
  prazoDate.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((prazoDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const days = Math.abs(diffDays);
    return {
      label: `VENCIDO HÁ ${days} ${days === 1 ? 'DIA' : 'DIAS'}`,
      color: 'bg-red-50 border-red-100 text-critical',
      isVencido: true,
    };
  }
  if (diffDays === 0) {
    return {
      label: 'VENCE HOJE',
      color: 'bg-amber-50 border-amber-100 text-pending',
      isVencido: false,
    };
  }
  return null;
}

export default function PlanoDeAcao() {
  const { actionPlans, addActionPlan, updateActionPlan, deleteActionPlan, equipments, user, users } = useAppStore();
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState<'Todos' | ActionPlanStatus>('Todos');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formEquipmentId, setFormEquipmentId] = useState('');
  const [formLocal, setFormLocal] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formCriticidade, setFormCriticidade] = useState<Criticidade>('Médio');
  const [formResponsavel, setFormResponsavel] = useState('');
  const [formPrazo, setFormPrazo] = useState('');
  const [formStatus, setFormStatus] = useState<ActionPlanStatus>('Aberta');

  const filtered = useMemo(() => {
    return actionPlans.filter(p => {
      const matchStatus = statusFilter === 'Todos' || p.status === statusFilter;
      const term = search.toLowerCase();
      const matchSearch = !term ||
        p.equipmentId.toLowerCase().includes(term) ||
        p.local.toLowerCase().includes(term) ||
        p.descricao.toLowerCase().includes(term) ||
        (p.responsavel && p.responsavel.toLowerCase().includes(term));
      return matchStatus && matchSearch;
    });
  }, [actionPlans, statusFilter, search]);

  const counts = useMemo(() => {
    return STATUS_OPTIONS.reduce<Record<ActionPlanStatus, number>>((acc, s) => {
      acc[s] = actionPlans.filter(p => p.status === s).length;
      return acc;
    }, {} as Record<ActionPlanStatus, number>);
  }, [actionPlans]);

  const hasActiveFilters = statusFilter !== 'Todos' || search.length > 0;

  const clearFilters = () => {
    setStatusFilter('Todos');
    setSearch('');
  };

  const resetForm = () => {
    setFormEquipmentId('');
    setFormLocal('');
    setFormDescricao('');
    setFormCriticidade('Médio');
    setFormResponsavel('');
    setFormPrazo('');
    setFormStatus('Aberta');
  };

  const handleEquipmentChange = (id: string) => {
    setFormEquipmentId(id);
    const eq = equipments.find(e => e.id === id);
    if (eq) {
      setFormLocal(`${eq.local} (${eq.setor})`);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEquipmentId || !formLocal.trim() || !formDescricao.trim()) return;
    addActionPlan({
      equipmentId: formEquipmentId,
      local: formLocal.trim(),
      descricao: formDescricao.trim(),
      criticidade: formCriticidade,
      responsavel: formResponsavel.trim(),
      prazo: formPrazo,
      status: formStatus,
    });
    resetForm();
    setShowForm(false);
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-24">
      {/* Header */}
      <header className="page-header">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center text-gray-600 hover:text-gray-900 bg-gray-50 rounded-lg p-2 min-h-0 min-w-0"
          type="button"
          aria-label="Voltar"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">Ações Corretivas</div>
          <h1 className="text-base sm:text-lg lg:text-xl font-black text-gray-900 uppercase tracking-wide truncate">
            Plano de Ação
          </h1>
        </div>
        <span className="pill bg-red-100 text-critical flex-shrink-0">
          <AlertCircle className="w-3 h-3" />
          {counts['Aberta']} abertas
        </span>
      </header>

      {/* New Action Plan button */}
      <button
        onClick={() => setShowForm(true)}
        className="btn-primary"
        type="button"
      >
        <Plus className="w-5 h-5" />
        Novo Plano de Ação
      </button>

      {/* Search */}
      <div className="relative" role="search">
        <label htmlFor="plan-search" className="sr-only">
          Buscar planos de ação
        </label>
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400" aria-hidden="true">
          <Search className="w-4 h-4" />
        </span>
        <input
          id="plan-search"
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por equipamento, local, responsável..."
          className="field-input pl-11"
        />
      </div>

      {/* Status filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 sm:mx-0 px-4 sm:px-0 scrollbar-none">
        {(['Todos', ...STATUS_OPTIONS] as const).map(s => {
          const isActive = statusFilter === s;
          const count = s === 'Todos' ? actionPlans.length : counts[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`flex-none px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-black uppercase whitespace-nowrap border transition-all ${
                isActive
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {s} ({count})
            </button>
          );
        })}
      </div>

      {/* Action Plan Cards — 1 col mobile, 2 col xl */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {filtered.map(plan => {
          const editable = canEditActionPlan(user, plan);
          const deletable = canDeleteActionPlan(user, plan);
          const owner = plan.userId ? users.find((u) => u.id === plan.userId) : null;
          const CriticidadeIcon = CRITICIDADE_ICONS[plan.criticidade];
          const StatusIcon = STATUS_ICONS[plan.status];
          const prazoWarning = getPrazoWarning(plan.prazo, plan.status);

          return (
            <div
              key={plan.id}
              className={`card-subtle bg-white space-y-3 sm:space-y-4 border-l-[4px] ${CRITICIDADE_BORDER[plan.criticidade]} ${!editable ? 'opacity-95' : ''}`}
            >
              {/* Top row: criticidade icon + ID + criticidade pill | Leitura + status pill */}
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${CRITICIDADE_ICON_BG[plan.criticidade]}`}>
                    <CriticidadeIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-gray-900">{plan.equipmentId}</span>
                      <span className={`pill border ${CRITICIDADE_STYLES[plan.criticidade]}`}>
                        {plan.criticidade}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 font-semibold mt-0.5 truncate">{plan.local}</div>
                    {owner && (
                      <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">
                        <User className="w-3 h-3" />
                        <span>por {owner.nome}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                  {!editable && (
                    <span
                      title="Somente leitura — você não é o responsável"
                      className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded"
                    >
                      <Lock className="w-3 h-3" />
                      Leitura
                    </span>
                  )}
                  <span className={`pill ${STATUS_STYLES[plan.status]}`}>
                    <StatusIcon className="w-3 h-3" />
                    {plan.status}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-700 font-medium bg-gray-50 p-3 rounded-lg border border-gray-100 leading-relaxed">
                {plan.descricao}
              </p>

              {/* Prazo warning — destaque quando vencido ou vence hoje */}
              {prazoWarning && (
                <div className={`flex items-center gap-2 ${prazoWarning.color} text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-lg border`}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{prazoWarning.label}</span>
                </div>
              )}

              {/* Fields: Responsável + Prazo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`plan-${plan.id}-responsavel`} className="field-label">Responsável</label>
                  <input
                    id={`plan-${plan.id}-responsavel`}
                    type="text"
                    value={plan.responsavel}
                    onChange={e => editable && updateActionPlan(plan.id, { responsavel: e.target.value })}
                    readOnly={!editable}
                    placeholder="Nome do responsável..."
                    className="field-input"
                    style={{ height: '2.75rem' }}
                  />
                </div>
                <div>
                  <label htmlFor={`plan-${plan.id}-prazo`} className="field-label">Prazo</label>
                  <input
                    id={`plan-${plan.id}-prazo`}
                    type="date"
                    value={plan.prazo}
                    onChange={e => editable && updateActionPlan(plan.id, { prazo: e.target.value })}
                    readOnly={!editable}
                    className={`field-input ${prazoWarning?.isVencido ? 'border-critical focus:border-critical' : ''}`}
                    style={{ height: '2.75rem' }}
                  />
                </div>
              </div>

              {/* Status buttons */}
              <div role="group" aria-labelledby={`plan-${plan.id}-status-label`}>
                <span id={`plan-${plan.id}-status-label`} className="field-label">Status</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {STATUS_OPTIONS.map(s => {
                    const BtnIcon = STATUS_ICONS[s];
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={!editable}
                        aria-pressed={plan.status === s}
                        onClick={() => editable && updateActionPlan(plan.id, { status: s })}
                        className={`h-10 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border flex items-center justify-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed ${
                          plan.status === s
                            ? STATUS_STYLES[s] + ' border-current'
                            : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <BtnIcon className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{s}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer: metadata + delete — wraps gracefully on 320px */}
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-[10px] sm:text-[11px] text-gray-400 font-bold uppercase tracking-wider pt-3 border-t border-gray-50">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0 flex-1">
                  <span className="truncate">
                    <span className="hidden sm:inline">Criado: </span>
                    {plan.createdAt}
                  </span>
                  <span className="font-mono truncate max-w-full" title={plan.id}>
                    <span className="hidden sm:inline">ID: </span>
                    {plan.id}
                  </span>
                </div>
                {deletable && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Excluir este plano de ação?')) deleteActionPlan(plan.id);
                    }}
                    className="flex items-center gap-1 text-gray-400 hover:text-critical transition-colors min-h-0 min-w-0 px-1.5 py-1 rounded flex-shrink-0"
                    aria-label="Excluir plano de ação"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="xl:col-span-2 card-subtle bg-white text-center py-12 px-6 space-y-4">
            <div className="w-16 h-16 bg-green-50 text-success rounded-full flex items-center justify-center mx-auto">
              <ClipboardCheck className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-black text-gray-700 uppercase tracking-wider">
                {actionPlans.length === 0
                  ? 'Nenhum plano de ação cadastrado'
                  : 'Nenhum resultado para o filtro'}
              </p>
              <p className="text-xs text-gray-400 mt-1.5 max-w-md mx-auto leading-relaxed">
                {actionPlans.length === 0
                  ? 'Planos de ação são criados após inspeções reprovadas ou manualmente pelo botão "Novo Plano de Ação" acima.'
                  : 'Tente ajustar a busca ou selecionar outro status para ver mais registros.'}
              </p>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="btn-ghost btn-sm btn-auto"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* New Plan Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-plan-title"
        >
          <form
            onSubmit={handleCreate}
            className="bg-white w-full max-w-lg rounded-2xl p-5 sm:p-6 space-y-5 sm:space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between sticky top-0 bg-white pb-3 -mt-1 border-b border-gray-100 z-10">
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ações Corretivas</div>
                <h3 id="new-plan-title" className="text-base font-black text-gray-900 uppercase tracking-wider mt-0.5">
                  Novo Plano de Ação
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm(); }}
                className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg min-h-0 min-w-0"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-start gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5">
              <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-[11px] sm:text-xs text-gray-600 font-medium leading-relaxed">
                Campos com <span className="text-critical font-bold" aria-hidden="true">*</span> são obrigatórios.
                Responsável e Prazo podem ser preenchidos após a criação.
              </p>
            </div>

            <div>
              <label htmlFor="new-plan-equipment" className="field-label">
                1. Equipamento <span className="text-critical" aria-hidden="true">*</span>
              </label>
              <select
                id="new-plan-equipment"
                required
                value={formEquipmentId}
                onChange={e => handleEquipmentChange(e.target.value)}
                className="field-input"
              >
                <option value="">Selecione um equipamento...</option>
                {equipments.map(eq => (
                  <option key={eq.id} value={eq.id}>
                    [{eq.id}] {eq.tipo} — {eq.local}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="new-plan-local" className="field-label">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
                  2. Local <span className="text-critical" aria-hidden="true">*</span>
                </span>
              </label>
              <input
                id="new-plan-local"
                type="text"
                required
                value={formLocal}
                onChange={e => setFormLocal(e.target.value)}
                placeholder="Ex.: Bloco A — 2º andar — Corredor leste"
                className="field-input"
              />
              <span className="field-hint">
                Preenchido automaticamente a partir do equipamento. Edite se necessário.
              </span>
            </div>

            <div>
              <label htmlFor="new-plan-descricao" className="field-label">
                3. Descrição da Não Conformidade <span className="text-critical" aria-hidden="true">*</span>
              </label>
              <textarea
                id="new-plan-descricao"
                required
                value={formDescricao}
                onChange={e => setFormDescricao(e.target.value)}
                rows={4}
                placeholder="Detalhe a irregularidade, o ponto afetado e a evidência observada..."
                className="field-textarea"
              />
            </div>

            <div role="group" aria-labelledby="new-plan-criticidade-label">
              <span id="new-plan-criticidade-label" className="field-label">
                4. Criticidade <span className="text-critical" aria-hidden="true">*</span>
              </span>
              <span className="field-hint mb-2 block">Selecione o nível de urgência para a correção.</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CRITICIDADE_OPTIONS.map(c => {
                  const Icon = CRITICIDADE_ICONS[c];
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormCriticidade(c)}
                      aria-pressed={formCriticidade === c}
                      className={`h-12 sm:h-14 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all border flex flex-col items-center justify-center gap-0.5 ${
                        formCriticidade === c
                          ? CRITICIDADE_STYLES[c] + ' border-current'
                          : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{c}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="new-plan-responsavel" className="field-label">
                  <span className="inline-flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
                    5. Responsável
                  </span>
                </label>
                <input
                  id="new-plan-responsavel"
                  type="text"
                  value={formResponsavel}
                  onChange={e => setFormResponsavel(e.target.value)}
                  placeholder="Nome de quem executará a ação"
                  className="field-input"
                />
              </div>
              <div>
                <label htmlFor="new-plan-prazo" className="field-label">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
                    6. Prazo
                  </span>
                </label>
                <input
                  id="new-plan-prazo"
                  type="date"
                  value={formPrazo}
                  onChange={e => setFormPrazo(e.target.value)}
                  className="field-input"
                />
              </div>
            </div>

            <div role="group" aria-labelledby="new-plan-status-label">
              <span id="new-plan-status-label" className="field-label">
                7. Status <span className="text-critical" aria-hidden="true">*</span>
              </span>
              <span className="field-hint mb-2 block">Planos novos iniciam como <strong className="font-bold">Aberta</strong>. Ajuste apenas se já houver andamento.</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {STATUS_OPTIONS.map(s => {
                  const BtnIcon = STATUS_ICONS[s];
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={formStatus === s}
                      onClick={() => setFormStatus(s)}
                      className={`h-12 sm:h-14 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all border flex flex-col items-center justify-center gap-0.5 ${
                        formStatus === s
                          ? STATUS_STYLES[s] + ' border-current'
                          : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <BtnIcon className="w-4 h-4" />
                      <span>{s}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm(); }}
                className="btn-ghost btn-auto flex-1"
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primary btn-auto flex-1">
                Criar Plano
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
