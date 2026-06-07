import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store';
import {
  ChevronLeft,
  Play,
  User,
  Eye,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  MapPin,
  Calendar,
  Tag,
  Wrench,
  Trash2,
  Lock,
  FileText,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { canEditEquipment, canDeleteEquipment } from '../../services/permissions';
import { showToast } from '../../hooks/useToasts';

type FieldProps = {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  mono?: boolean;
};

function Field({ label, value, icon: Icon, mono = false }: FieldProps) {
  const isEmpty =
    value === null ||
    value === undefined ||
    value === '' ||
    (typeof value === 'string' && (value === 'N/A' || value.trim() === ''));
  return (
    <div className="space-y-1.5 min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        <span>{label}</span>
      </div>
      <div
        className={`text-sm break-words ${
          isEmpty
            ? 'text-gray-400 italic font-medium'
            : mono
              ? 'font-mono font-bold text-gray-800'
              : 'font-bold text-gray-800'
        }`}
      >
        {isEmpty ? 'Não cadastrado' : value}
      </div>
    </div>
  );
}

type DetailSectionProps = {
  title: string;
  icon: LucideIcon;
  cols?: 1 | 2 | 3 | 4;
  children: ReactNode;
};

function DetailSection({ title, icon: Icon, cols = 3, children }: DetailSectionProps) {
  const colsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }[cols];
  return (
    <div className="card-subtle bg-white">
      <div className="flex items-center gap-2.5 border-b border-gray-50 pb-3 mb-5">
        <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </span>
        <h2 className="label-uppercase">{title}</h2>
      </div>
      <div className={`grid ${colsClass} gap-4 sm:gap-5`}>{children}</div>
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

  const getExpirationStatus = (): { subLabel: string; subColor: string } => {
    if (!eq.dataProximaInspecao) {
      return { subLabel: 'Sem data', subColor: 'text-gray-400' };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextInsp = new Date(eq.dataProximaInspecao);
    nextInsp.setHours(0, 0, 0, 0);

    const diffTime = nextInsp.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const days = Math.abs(diffDays);
      return {
        subLabel: `Vencido há ${days} ${days === 1 ? 'dia' : 'dias'}`,
        subColor: 'text-critical',
      };
    }
    if (diffDays === 0) {
      return { subLabel: 'Vence hoje', subColor: 'text-pending' };
    }
    return {
      subLabel: `Em ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`,
      subColor: 'text-gray-500',
    };
  };

  const expStatus = getExpirationStatus();

  const statusConfigs = {
    regular: {
      label: 'EM DIA',
      pillClass: 'bg-green-100 text-success',
      borderClass: 'border-l-success',
      icon: CheckCircle2,
    },
    pendente: {
      label: 'PENDENTE',
      pillClass: 'bg-amber-100 text-pending',
      borderClass: 'border-l-pending',
      icon: AlertTriangle,
    },
    vencido: {
      label: 'VENCIDO',
      pillClass: 'bg-red-100 text-critical',
      borderClass: 'border-l-critical',
      icon: XCircle,
    },
    observacao: {
      label: 'OBSERVAÇÃO',
      pillClass: 'bg-gray-100 text-gray-500',
      borderClass: 'border-l-gray-300',
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
      {/* Page header */}
      <header className="page-header">
        <button
          onClick={() => navigate('/equipamentos')}
          className="flex items-center justify-center text-gray-600 hover:text-gray-900 bg-gray-50 rounded-lg p-2 min-h-0 min-w-0"
          type="button"
          aria-label="Voltar para lista"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">Equipamento</div>
          <h1 className="text-sm sm:text-base font-bold text-gray-700 truncate">Ficha Técnica</h1>
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

      {/* Hero card — code + type + status + location */}
      <div className={`card-subtle border-l-[4px] ${config.borderClass} p-4 sm:p-5 lg:p-6 space-y-3`}>
        <div className="flex items-start justify-between gap-3">
          <span className="font-mono text-xs sm:text-sm font-extrabold text-gray-700 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded tracking-tight">
            {eq.id}
          </span>
          <span className={`pill ${config.pillClass} flex-shrink-0`}>
            <StatusIcon className="w-3 h-3" />
            {config.label}
          </span>
        </div>
        <div>
          <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-gray-900 leading-tight">
            {eq.tipo}
          </h2>
          {eq.subtipo && (
            <p className="text-sm text-gray-500 mt-0.5">{eq.subtipo}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 pt-3 border-t border-gray-50">
          <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
          <span className="truncate">
            {eq.local}
            <span className="text-gray-300 mx-1">·</span>
            {eq.setor}
            {eq.pavimento && (
              <>
                <span className="text-gray-300 mx-1">·</span>
                {eq.pavimento}
              </>
            )}
          </span>
        </div>
      </div>

      {/* Read-only banner */}
      {!editable && (
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 px-3 py-2.5 rounded-lg">
          <div className="w-9 h-9 bg-white border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
            <Lock className="w-4 h-4 text-gray-500" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Modo Somente Leitura
            </div>
            {owner ? (
              <div className="text-xs text-gray-600 truncate">
                Cadastrado por <span className="font-bold text-gray-800">{owner.nome}</span>
              </div>
            ) : (
              <div className="text-xs text-gray-500">
                Você não tem permissão para editar este equipamento.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Primary action */}
      <button
        onClick={handleStartInspection}
        className="btn-primary"
      >
        <Play className="w-4 h-4 fill-white" />
        Iniciar Inspeção
      </button>

      {/* Identificação */}
      <DetailSection title="Identificação" icon={Tag} cols={3}>
        <Field label="Modelo / Subtipo" value={eq.subtipo} />
        <Field label="Fabricante" value={eq.fabricante} />
        <Field label="Nº de Série" value={eq.numSerie} mono />
      </DetailSection>

      {/* Localização */}
      <DetailSection title="Localização" icon={MapPin} cols={3}>
        <Field label="Local" value={eq.local} icon={MapPin} />
        <Field label="Setor" value={eq.setor} />
        <Field label="Pavimento" value={eq.pavimento} />
      </DetailSection>

      {/* Dados Técnicos */}
      <DetailSection title="Dados Técnicos" icon={Wrench} cols={3}>
        <Field label="Tipo de Carga" value={eq.tipoCarga} />
        <Field label="Capacidade" value={eq.capacidade} />
        <Field label="QR Code" value={eq.qrcode} mono />
      </DetailSection>

      {/* Cronograma */}
      <DetailSection title="Cronograma" icon={Calendar} cols={4}>
        <Field label="Fabricação" value={eq.dataFabricacao} icon={Calendar} />
        <Field label="Última Manutenção" value={eq.dataUltimaManutencao} />
        <Field label="Próxima Manutenção" value={eq.dataProximaManutencao} />
        <Field
          label="Próxima Inspeção"
          icon={Calendar}
          value={
            eq.dataProximaInspecao ? (
              <div className="space-y-0.5">
                <div className="text-sm font-bold text-gray-800">{eq.dataProximaInspecao}</div>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${expStatus.subColor}`}>
                  {expStatus.subLabel}
                </div>
              </div>
            ) : undefined
          }
        />
      </DetailSection>

      {/* Observações (only if exists) */}
      {eq.observacoes && (
        <DetailSection title="Observações" icon={FileText} cols={1}>
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {eq.observacoes}
          </div>
        </DetailSection>
      )}

      {/* Histórico de Inspeções */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="label-uppercase">Histórico de Inspeções</span>
          <span className="pill bg-gray-100 text-gray-500">
            {eqInspections.length} {eqInspections.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>
        {eqInspections.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {eqInspections.map((insp) => (
              <div
                key={insp.id}
                className="card-subtle bg-white flex items-start justify-between gap-3"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-gray-800">{insp.data}</span>
                    <span
                      className={`pill ${
                        insp.status === 'regular'
                          ? 'bg-green-100 text-success'
                          : insp.status === 'pendente'
                            ? 'bg-amber-100 text-pending'
                            : insp.status === 'vencido'
                              ? 'bg-red-100 text-critical'
                              : 'bg-blue-100 text-blue-600'
                      }`}
                    >
                      {insp.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                    <User className="w-3.5 h-3.5" />
                    <span className="truncate">{insp.inspetor}</span>
                  </div>
                  {insp.observacoes && (
                    <p className="text-xs text-gray-600 italic mt-1.5 font-medium line-clamp-2">
                      &ldquo;{insp.observacoes}&rdquo;
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    alert(
                      `Inspeção ${insp.id}\nData: ${insp.data}\nInspetor: ${insp.inspetor}\nStatus: ${insp.status}\nLaudo: ${insp.observacoes || 'Nenhum'}`,
                    )
                  }
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
