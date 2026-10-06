import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, CheckCircle2, RotateCcw, Search, Shield, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { setRuntimeMode } from '../../runtime/runtimeMode';
import { useSimulatorStore } from '../../simulator/simulatorStore';
import type { EquipmentStatus } from '../../types';

const STATUS_LABELS: Record<EquipmentStatus, string> = {
  regular: 'Regular', pendente: 'Pendente', vencido: 'Não conforme', observacao: 'Em observação',
  em_manutencao: 'Em manutenção', inativo: 'Inativo', substituido: 'Substituído', extraviado: 'Extraviado',
};

const STATUS_OPTIONS: EquipmentStatus[] = ['regular', 'observacao', 'vencido'];

export default function Simulador() {
  const navigate = useNavigate();
  const { equipment, selectedEquipmentId, selectEquipment, updateEquipmentStatus, reset } = useSimulatorStore();
  const [query, setQuery] = useState('');
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    setRuntimeMode('simulator');
    return () => setRuntimeMode('operational');
  }, []);

  const filteredEquipment = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return equipment;
    return equipment.filter((item) => `${item.id} ${item.tipo} ${item.modelo} ${item.local}`.toLowerCase().includes(normalized));
  }, [equipment, query]);
  const selectedEquipment = equipment.find((item) => item.id === selectedEquipmentId);

  const leaveSimulator = () => {
    reset();
    navigate('/');
  };

  const confirmReset = () => {
    reset();
    setResetOpen(false);
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-20">
      <section className="rounded-2xl bg-slate-900 text-white p-5 sm:p-7 shadow-lg border border-slate-700" aria-label="Modo treinamento">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
          <div className="flex gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-400/15 text-emerald-300 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Modo treinamento</span>
              <h2 className="text-xl sm:text-2xl font-black mt-1">Ambiente de simulação</h2>
              <p className="text-sm text-slate-300 mt-2 max-w-2xl">Nenhum dado desta sessão será salvo no sistema real. Pratique os fluxos do EfetivaFire com equipamentos fictícios.</p>
            </div>
          </div>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-200 whitespace-nowrap">100% em memória</span>
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-label="Recursos do simulador">
        {[
          { title: 'Equipamentos simulados', detail: `${equipment.length} disponíveis`, Icon: Shield },
          { title: 'Inspeção simulada', detail: 'Em breve', Icon: CheckCircle2 },
          { title: 'Plano de ação', detail: 'Em breve', Icon: BookOpen },
          { title: 'Cenários', detail: 'Em preparação', Icon: Sparkles },
        ].map(({ title, detail, Icon }) => (
          <div key={title} className="card-subtle bg-white p-4 border border-slate-100">
            <Icon className="w-5 h-5 text-primary mb-3" />
            <p className="text-xs font-black text-slate-800">{title}</p>
            <p className="text-[11px] text-slate-500 mt-1">{detail}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)] gap-4">
        <div className="card-subtle bg-white p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="label-uppercase">Catálogo fictício</span>
              <h2 className="text-lg font-black text-slate-900 mt-1">Equipamentos simulados</h2>
            </div>
            <label className="relative w-full sm:w-64">
              <span className="sr-only">Pesquisar equipamento simulado</span>
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="field-input pl-9" placeholder="Buscar por TAG ou local" />
            </label>
          </div>
          <div className="space-y-2">
            {filteredEquipment.map((item) => (
              <button key={item.id} type="button" onClick={() => selectEquipment(item.id)} className={`w-full text-left rounded-xl border p-3 transition-colors ${selectedEquipmentId === item.id ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-primary/40 hover:bg-slate-50'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 truncate">{item.id}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{item.tipo} · {item.modelo}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{item.local}</p>
                  </div>
                  <span className="pill text-[10px] bg-slate-100 text-slate-600 whitespace-nowrap">{STATUS_LABELS[item.status]}</span>
                </div>
              </button>
            ))}
            {filteredEquipment.length === 0 && <p className="text-sm text-slate-500 py-6 text-center">Nenhum equipamento simulado encontrado.</p>}
          </div>
        </div>

        <div className="card-subtle bg-white p-4 sm:p-5 min-h-64">
          {selectedEquipment ? (
            <div className="space-y-4">
              <div>
                <span className="label-uppercase">Detalhe simulado</span>
                <h2 className="text-lg font-black text-slate-900 mt-1">{selectedEquipment.id}</h2>
                <p className="text-sm text-slate-600 mt-1">{selectedEquipment.descricao}</p>
              </div>
              <div>
                <label htmlFor="sim-status" className="field-label">Alterar estado em memória</label>
                <select id="sim-status" value={selectedEquipment.status} onChange={(event) => updateEquipmentStatus(selectedEquipment.id, event.target.value as EquipmentStatus)} className="field-input">
                  {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                </select>
              </div>
              <p className="rounded-lg bg-emerald-50 text-emerald-800 px-3 py-2 text-xs font-bold">Alterações desta atividade vivem somente nesta sessão.</p>
            </div>
          ) : (
            <div className="h-full min-h-56 flex flex-col items-center justify-center text-center">
              <Shield className="w-8 h-8 text-slate-300 mb-3" />
              <p className="text-sm font-black text-slate-700">Selecione um equipamento</p>
              <p className="text-xs text-slate-500 mt-1">Explore os dados fictícios do treinamento.</p>
            </div>
          )}
        </div>
      </section>

      <section className="flex flex-col sm:flex-row justify-between gap-3 border-t border-slate-200 pt-4">
        <button type="button" onClick={() => setResetOpen(true)} className="btn-ghost btn-auto"><RotateCcw className="w-4 h-4" /> Reiniciar simulação</button>
        <button type="button" onClick={leaveSimulator} className="btn-primary btn-auto"><ArrowLeft className="w-4 h-4" /> Sair do modo treinamento</button>
      </section>

      {resetOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="sim-reset-title">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-xl space-y-4">
            <div><h2 id="sim-reset-title" className="text-lg font-black text-slate-900">Reiniciar a simulação?</h2><p className="text-sm text-slate-600 mt-1">Todos os dados desta atividade serão descartados.</p></div>
            <div className="flex gap-2 justify-end"><button type="button" className="btn-ghost btn-auto" onClick={() => setResetOpen(false)}>Cancelar</button><button type="button" className="btn-primary btn-auto" onClick={confirmReset}>Reiniciar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
