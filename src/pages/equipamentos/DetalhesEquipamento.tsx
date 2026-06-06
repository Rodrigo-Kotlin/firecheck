import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store';
import { ChevronLeft, Play, User, Eye, CheckCircle2, AlertTriangle, XCircle, Info, MapPin, Calendar, Tag, Hash, Wrench, Trash2, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { canEditEquipment, canDeleteEquipment } from '../../services/permissions';
import { showToast } from '../../hooks/useToasts';

type FieldProps = {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
};

function Field({ label, value, icon: Icon }: FieldProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        <span>{label}</span>
      </div>
      <div className="text-sm font-bold text-gray-800 break-words">{value || 'Não cadastrado'}</div>
    </div>
  );
}

export default function DetalhesEquipamento() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { equipments, inspections, setCurrentTab, user, deleteEquipment, users } = useAppStore();

  const eq = equipments.find((e) => e.id === id);
  if (!eq) {
    return (
      <div className="space-y-4 text-center py-12">
        <div className="w-14 h-14 bg-red-50 text-critical rounded-full flex items-center justify-center mx-auto">
          <XCircle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-gray-800">Equipamento não encontrado</h3>
        <p className="text-sm text-gray-500">O item solicitado não existe no inventário atual.</p>
        <button onClick={() => navigate('/equipamentos')} className="btn-primary max-w-xs mx-auto">
          Voltar para Lista
        </button>
      </div>
    );
  }

  const eqInspections = inspections.filter((i) => i.equipmentId === eq.id);

  const getExpirationStatus = () => {
    if (!eq.dataProximaInspecao) {
      return { label: 'Sem data de inspeção cadastrada', color: 'text-gray-500 bg-gray-50 border-gray-200' };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextInsp = new Date(eq.dataProximaInspecao);
    nextInsp.setHours(0, 0, 0, 0);

    const diffTime = nextInsp.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: `VENCIDO HÁ ${Math.abs(diffDays)} DIAS`, color: 'text-critical bg-red-50 border-red-100' };
    } else if (diffDays === 0) {
      return { label: 'VENCE HOJE', color: 'text-pending bg-amber-50 border-amber-100' };
    } else {
      return { label: `Próxima inspeção em ${diffDays} dias`, color: 'text-success bg-green-50 border-green-100' };
    }
  };

  const expStatus = getExpirationStatus();

  const statusConfigs = {
    regular: {
      label: 'REGULAR / EM DIA',
      colorClass: 'text-success bg-green-50/50 border-success/20',
      badgeClass: 'bg-green-500 text-white',
      icon: CheckCircle2,
    },
    pendente: {
      label: 'MANUTENÇÃO PENDENTE',
      colorClass: 'text-pending bg-amber-50/50 border-pending/20',
      badgeClass: 'bg-amber-500 text-white',
      icon: AlertTriangle,
    },
    vencido: {
      label: 'LAUDO VENCIDO / CRÍTICO',
      colorClass: 'text-critical bg-red-50/50 border-critical/20',
      badgeClass: 'bg-red-600 text-white',
      icon: XCircle,
    },
    observacao: {
      label: 'EM OBSERVAÇÃO',
      colorClass: 'text-blue-500 bg-blue-50/50 border-blue-200',
      badgeClass: 'bg-blue-500 text-white',
      icon: Info,
    },
  };

  const config = statusConfigs[eq.status] || statusConfigs.observacao;
  const StatusIcon = config.icon;

  const handleStartInspection = () => {
    setCurrentTab('inspecionar');
    navigate(`/inspecionar?id=${eq.id}`);
  };

  const editable = canEditEquipment(user, eq);
  const deletable = canDeleteEquipment(user, eq);
  const owner = eq.createdBy ? users.find((u) => u.id === eq.createdBy) : null;

  const handleDelete = () => {
    if (!deletable) return;
    if (!window.confirm(`Excluir o equipamento ${eq.id}? Esta ação também remove as inspeções vinculadas e não pode ser desfeita.`)) {
      return;
    }
    deleteEquipment(eq.id);
    showToast({ kind: 'success', title: 'Equipamento excluído.' });
    navigate('/equipamentos', { replace: true });
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-24">
      {/* Header */}
      <header className="page-header">
        <button
          onClick={() => navigate('/equipamentos')}
          className="flex items-center justify-center text-gray-600 hover:text-gray-900 bg-gray-50 rounded-lg p-2 min-h-0 min-w-0"
          type="button"
          aria-label="Voltar"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">Equipamento</div>
          <h1 className="text-base sm:text-lg lg:text-xl font-black text-gray-900 uppercase tracking-wide truncate">
            {eq.id} · {eq.tipo}
          </h1>
          {eq.subtipo && <p className="text-[11px] sm:text-xs text-gray-500 truncate">{eq.subtipo}</p>}
        </div>
        {deletable && (
          <button
            type="button"
            onClick={handleDelete}
            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-critical hover:bg-red-50 rounded-lg min-h-0 min-w-0"
            aria-label="Excluir equipamento"
            title="Excluir equipamento"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </header>

      {!editable && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 text-amber-800 text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-lg">
          <Lock className="w-4 h-4 flex-shrink-0" />
          <span>
            Somente leitura{owner ? ` · cadastrado por ${owner.nome}` : ''}
          </span>
        </div>
      )}

      {/* Top: status + expiration side-by-side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <div className={`card-subtle border flex flex-col items-center justify-center text-center p-5 sm:p-6 gap-2 ${config.colorClass}`}>
          <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center ${config.badgeClass} shadow-md`}>
            <StatusIcon className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <div>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider block text-gray-500">Status Geral</span>
            <span className="text-sm sm:text-base font-black tracking-wide block mt-0.5">{config.label}</span>
          </div>
        </div>

        <div className={`border p-4 sm:p-5 rounded-xl flex flex-col items-center justify-center text-center text-xs sm:text-sm font-bold uppercase tracking-wider ${expStatus.color}`}>
          <Calendar className="w-6 h-6 mb-1.5 opacity-60" />
          <span className="leading-tight">{expStatus.label}</span>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={handleStartInspection}
        className="btn-primary h-12"
      >
        <Play className="w-4 h-4 fill-white" />
        Iniciar Inspeção
      </button>

      {/* Information grid: 2-col on mobile, 3-col on lg */}
      <div className="card-subtle bg-white space-y-4">
        <span className="label-uppercase block border-b border-gray-50 pb-1">Informações Técnicas</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          <Field label="Tipo" value={eq.tipo} icon={Tag} />
          <Field label="Modelo / Subtipo" value={eq.subtipo || 'N/A'} icon={Wrench} />
          <Field label="Nº de Série" value={eq.numSerie || 'N/A'} icon={Hash} />
          <Field
            label="Carga / Capacidade"
            value={
              (eq.tipoCarga && eq.tipoCarga !== 'N/A') || eq.capacidade ? (
                <>
                  {eq.tipoCarga && eq.tipoCarga !== 'N/A' && `${eq.tipoCarga}`}
                  {eq.capacidade && ` · ${eq.capacidade}`}
                </>
              ) : 'N/A'
            }
            icon={Wrench}
          />
        </div>
      </div>

      <div className="card-subtle bg-white space-y-4">
        <span className="label-uppercase block border-b border-gray-50 pb-1">Localização</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          <Field label="Localização" value={eq.local} icon={MapPin} />
          <Field label="Setor" value={eq.setor} />
          <Field label="Pavimento" value={eq.pavimento || '—'} />
        </div>
      </div>

      <div className="card-subtle bg-white space-y-4">
        <span className="label-uppercase block border-b border-gray-50 pb-1">Cronograma de Datas</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <Field label="Fabricação" value={eq.dataFabricacao || 'Não cadastrada'} icon={Calendar} />
          <Field label="Última Manutenção" value={eq.dataUltimaManutencao || 'Não cadastrada'} />
          <Field label="Próxima Manutenção" value={eq.dataProximaManutencao || 'Não cadastrada'} />
          <Field label="Próxima Inspeção" value={eq.dataProximaInspecao || 'Não cadastrada'} />
        </div>
      </div>

      {/* Inspections History */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="label-uppercase">Histórico de Inspeções</span>
          <span className="pill bg-gray-100 text-gray-500">{eqInspections.length} {eqInspections.length === 1 ? 'registro' : 'registros'}</span>
        </div>
        {eqInspections.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {eqInspections.map((insp) => (
              <div key={insp.id} className="card-subtle bg-white flex items-start justify-between gap-3">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-gray-800">{insp.data}</span>
                    <span className={`pill ${
                      insp.status === 'regular' ? 'bg-green-100 text-success' :
                      insp.status === 'pendente' ? 'bg-amber-100 text-pending' :
                      insp.status === 'vencido' ? 'bg-red-100 text-critical' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      {insp.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                    <User className="w-3.5 h-3.5" />
                    <span className="truncate">{insp.inspetor}</span>
                  </div>
                  {insp.observacoes && (
                    <p className="text-xs text-gray-600 italic mt-1.5 font-medium line-clamp-2">
                      "{insp.observacoes}"
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => alert(
                    `Inspeção ${insp.id}\nData: ${insp.data}\nInspetor: ${insp.inspetor}\nStatus: ${insp.status}\nLaudo: ${insp.observacoes || 'Nenhum'}`
                  )}
                  className="flex-shrink-0 w-9 h-9 flex items-center justify-center border border-gray-100 bg-gray-50 hover:bg-gray-100 rounded-lg min-h-0 min-w-0"
                  aria-label="Ver detalhes da inspeção"
                >
                  <Eye className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="card-subtle bg-white text-center py-8 text-sm text-gray-400">
            Nenhuma inspeção anterior registrada.
          </div>
        )}
      </div>
    </div>
  );
}
