import { useState, useMemo } from 'react';
import { useAppStore } from '../../store';
import { useNavigate } from 'react-router-dom';
import type { ActionPlanStatus, Criticidade } from '../../types';
import { ChevronLeft, AlertOctagon, ClipboardCheck, Plus, X, Trash2, Search } from 'lucide-react';

const CRITICIDADE_STYLES: Record<Criticidade, string> = {
  'Crítico': 'bg-red-100 text-[#DC2626] border-red-200',
  'Alto': 'bg-orange-100 text-orange-600 border-orange-200',
  'Médio': 'bg-amber-100 text-[#D97706] border-amber-200',
  'Baixo': 'bg-gray-100 text-gray-500 border-gray-200',
};

const STATUS_STYLES: Record<ActionPlanStatus, string> = {
  'Aberta': 'bg-red-50 text-[#DC2626]',
  'Em andamento': 'bg-amber-50 text-[#D97706]',
  'Concluída': 'bg-green-50 text-[#16A34A]',
  'Vencida': 'bg-gray-100 text-gray-500',
};

const STATUS_OPTIONS: ActionPlanStatus[] = ['Aberta', 'Em andamento', 'Concluída', 'Vencida'];
const CRITICIDADE_OPTIONS: Criticidade[] = ['Crítico', 'Alto', 'Médio', 'Baixo'];

export default function PlanoDeAcao() {
  const { actionPlans, addActionPlan, updateActionPlan, deleteActionPlan, equipments } = useAppStore();
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState<'Todos' | ActionPlanStatus>('Todos');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formEquipmentId, setFormEquipmentId] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formCriticidade, setFormCriticidade] = useState<Criticidade>('Médio');
  const [formResponsavel, setFormResponsavel] = useState('');
  const [formPrazo, setFormPrazo] = useState('');

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

  const resetForm = () => {
    setFormEquipmentId('');
    setFormDescricao('');
    setFormCriticidade('Médio');
    setFormResponsavel('');
    setFormPrazo('');
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEquipmentId || !formDescricao.trim()) return;
    const eq = equipments.find(e => e.id === formEquipmentId);
    addActionPlan({
      equipmentId: formEquipmentId,
      local: eq ? `${eq.local} (${eq.setor})` : 'Local não especificado',
      descricao: formDescricao.trim(),
      criticidade: formCriticidade,
      responsavel: formResponsavel.trim(),
      prazo: formPrazo,
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
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
          <Search className="w-4 h-4" />
        </span>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por equipamento, local, responsável..."
          className="field-input pl-10"
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
              className={`px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-black uppercase whitespace-nowrap border transition-all ${
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
        {filtered.map(plan => (
          <div key={plan.id} className="card-subtle bg-white space-y-4 relative">
            <button
              type="button"
              onClick={() => {
                if (confirm('Excluir este plano de ação?')) deleteActionPlan(plan.id);
              }}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-gray-300 hover:text-critical hover:bg-red-50 rounded-lg min-h-0 min-w-0 transition-all"
              aria-label="Excluir plano"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Top row */}
            <div className="flex items-start justify-between gap-2 pr-10">
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                <div className={`p-2 rounded-lg flex-shrink-0 ${plan.criticidade === 'Crítico' ? 'bg-red-50 text-critical' : plan.criticidade === 'Alto' ? 'bg-orange-50 text-orange-600' : 'bg-amber-50 text-pending'}`}>
                  {plan.criticidade === 'Crítico' ? <AlertOctagon className="w-5 h-5" /> : <ClipboardCheck className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-gray-900">{plan.equipmentId}</span>
                    <span className={`pill border ${CRITICIDADE_STYLES[plan.criticidade]}`}>
                      {plan.criticidade}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 font-semibold mt-0.5 truncate">{plan.local}</div>
                </div>
              </div>
              <span className={`pill flex-shrink-0 ${STATUS_STYLES[plan.status]}`}>
                {plan.status}
              </span>
            </div>

            <p className="text-sm text-gray-700 font-medium bg-gray-50 p-3 rounded-lg border border-gray-100 leading-relaxed">
              {plan.descricao}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="field-label">Responsável</label>
                <input
                  type="text"
                  value={plan.responsavel}
                  onChange={e => updateActionPlan(plan.id, { responsavel: e.target.value })}
                  placeholder="Nome do responsável..."
                  className="field-input"
                  style={{ height: '2.75rem' }}
                />
              </div>
              <div>
                <label className="field-label">Prazo</label>
                <input
                  type="date"
                  value={plan.prazo}
                  onChange={e => updateActionPlan(plan.id, { prazo: e.target.value })}
                  className="field-input"
                  style={{ height: '2.75rem' }}
                />
              </div>
            </div>

            <div>
              <label className="field-label">Status</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => updateActionPlan(plan.id, { status: s })}
                    className={`h-10 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border ${
                      plan.status === s
                        ? STATUS_STYLES[s] + ' border-current'
                        : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-gray-400 font-bold uppercase tracking-wider pt-2 border-t border-gray-50">
              <span>Criado em: {plan.createdAt}</span>
              <span className="font-mono">ID: {plan.id}</span>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="xl:col-span-2 card-subtle bg-white text-center py-12 space-y-3">
            <div className="w-14 h-14 bg-green-50 text-success rounded-full flex items-center justify-center mx-auto">
              <ClipboardCheck className="w-8 h-8" />
            </div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">
              {actionPlans.length === 0
                ? 'Nenhuma não conformidade aberta'
                : 'Nenhum plano de ação corresponde ao filtro'}
            </p>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              {actionPlans.length === 0
                ? 'Planos de ação são criados automaticamente após inspeções reprovadas ou manualmente pelo botão acima.'
                : 'Ajuste os filtros para ver outros registros.'}
            </p>
          </div>
        )}
      </div>

      {/* New Plan Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <form
            onSubmit={handleCreate}
            className="bg-white w-full max-w-lg rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between sticky top-0 bg-white pb-2 border-b border-gray-100 -mt-1">
              <h3 className="text-base font-black text-gray-900 uppercase tracking-wider">
                Novo Plano de Ação
              </h3>
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm(); }}
                className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg min-h-0 min-w-0"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="field-label">Equipamento *</label>
              <select
                required
                value={formEquipmentId}
                onChange={e => setFormEquipmentId(e.target.value)}
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
              <label className="field-label">Descrição da Não Conformidade *</label>
              <textarea
                required
                value={formDescricao}
                onChange={e => setFormDescricao(e.target.value)}
                rows={3}
                placeholder="Descreva detalhadamente a não conformidade identificada..."
                className="field-textarea"
              />
            </div>

            <div>
              <label className="field-label">Criticidade</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {CRITICIDADE_OPTIONS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFormCriticidade(c)}
                    className={`h-10 rounded-lg text-xs font-black uppercase tracking-wider transition-all border ${
                      formCriticidade === c
                        ? CRITICIDADE_STYLES[c] + ' border-current'
                        : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="field-label">Responsável</label>
                <input
                  type="text"
                  value={formResponsavel}
                  onChange={e => setFormResponsavel(e.target.value)}
                  placeholder="Nome..."
                  className="field-input"
                />
              </div>
              <div>
                <label className="field-label">Prazo</label>
                <input
                  type="date"
                  value={formPrazo}
                  onChange={e => setFormPrazo(e.target.value)}
                  className="field-input"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm(); }}
                className="flex-1 h-12 border-2 border-gray-200 text-gray-600 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button type="submit" className="flex-1 h-12 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-primary-dark">
                Criar Plano
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
