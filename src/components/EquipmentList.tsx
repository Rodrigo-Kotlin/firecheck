import { Eye, Lock, MapPin, Trash2 } from 'lucide-react';
import type { Equipment, Inspector } from '../types';
import { canDeleteEquipment } from '../services/permissions';
import { formatDateBR } from '../utils/date';
import {
  DEADLINE_RESULT_META,
  OPERATIONAL_STATUS_LABEL,
  TECHNICAL_RESULT_META,
  type EquipmentPresentation,
} from '../utils/equipmentView';

interface EquipmentListProps {
  equipments: Equipment[];
  presentations: ReadonlyMap<string, EquipmentPresentation>;
  user: Inspector | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function EquipmentList({ equipments, presentations, user, onOpen, onDelete }: EquipmentListProps) {
  return (
    <div className="space-y-2 pb-20">
      <div className="hidden md:grid md:grid-cols-[minmax(7rem,1fr)_minmax(10rem,1.4fr)_minmax(11rem,1.4fr)_minmax(8rem,1fr)_minmax(9rem,1fr)_auto] gap-3 items-center px-4 py-2 text-[10px] font-black uppercase tracking-wider text-gray-400" role="row">
        <span>Tag</span>
        <span>Equipamento</span>
        <span>Setor / Local</span>
        <span>Resultado</span>
        <span>Próxima inspeção</span>
        <span className="text-right">Ações</span>
      </div>

      {equipments.map((equipment) => {
        const presentation = presentations.get(equipment.id);
        if (!presentation) return null;
        const technical = TECHNICAL_RESULT_META[presentation.technicalResult];
        const deadline = DEADLINE_RESULT_META[presentation.deadlineResult];
        const deletable = canDeleteEquipment(user, equipment);
        const operationalLabel = OPERATIONAL_STATUS_LABEL[equipment.status];

        return (
          <div key={equipment.id} className="card-subtle bg-white border-l-[3px] border-l-gray-200 overflow-hidden" role="row">
            <div className="hidden md:grid md:grid-cols-[minmax(7rem,1fr)_minmax(10rem,1.4fr)_minmax(11rem,1.4fr)_minmax(8rem,1fr)_minmax(9rem,1fr)_auto] gap-3 items-center px-4 py-3">
              <button type="button" onClick={() => onOpen(equipment.id)} className="font-mono text-sm font-extrabold text-gray-900 text-left hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded">
                {equipment.id}
              </button>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">{equipment.tipo}</p>
                {equipment.subtipo && <p className="text-xs text-gray-500 truncate">{equipment.subtipo}</p>}
              </div>
              <div className="min-w-0 text-xs text-gray-500">
                <p className="font-semibold truncate">{equipment.setor || 'Setor não informado'}</p>
                <p className="truncate">{equipment.local || 'Local não informado'}</p>
              </div>
              <div className="flex flex-col items-start gap-1">
                <span className={`pill ${technical.pill}`}>{technical.label}</span>
                {operationalLabel && <span className="text-[10px] text-gray-500">{operationalLabel}</span>}
              </div>
              <div className="flex flex-col items-start gap-1">
                <span className="text-xs font-semibold text-gray-700">{formatDateBR(presentation.nextInspectionYmd)}</span>
                <span className={`pill ${deadline.pill}`}>{deadline.label}</span>
              </div>
              <EquipmentListActions equipment={equipment} deletable={deletable} onOpen={onOpen} onDelete={onDelete} />
            </div>

            <div className="md:hidden p-3 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={() => onOpen(equipment.id)} className="font-mono text-sm font-extrabold text-gray-900 text-left hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded">
                  {equipment.id}
                </button>
                <div className="flex items-center gap-1.5">
                  <span className={`pill ${technical.pill}`}>{technical.label}</span>
                  {!canDeleteEquipment(user, equipment) && <Lock className="w-3.5 h-3.5 text-gray-400" aria-label="Somente leitura" />}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 mt-0.5 text-gray-400 shrink-0" aria-hidden="true" />
                <div className="min-w-0 text-xs text-gray-500">
                  <p className="font-bold text-gray-800 truncate">{equipment.tipo}{equipment.subtipo ? ` · ${equipment.subtipo}` : ''}</p>
                  <p className="truncate">{equipment.setor || 'Setor não informado'} · {equipment.local || 'Local não informado'}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500">Próx.: {formatDateBR(presentation.nextInspectionYmd)}</span>
                  <span className={`pill ${deadline.pill}`}>{deadline.label}</span>
                </div>
                <EquipmentListActions equipment={equipment} deletable={deletable} onOpen={onOpen} onDelete={onDelete} compact />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EquipmentListActions({
  equipment,
  deletable,
  onOpen,
  onDelete,
  compact = false,
}: {
  equipment: Equipment;
  deletable: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center justify-end gap-1.5 ${compact ? '' : 'min-w-[7rem]'}`}>
      <button type="button" onClick={() => onOpen(equipment.id)} className="btn-ghost btn-sm btn-auto" aria-label={`Ver ${equipment.id}`}>
        <Eye className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">Ver</span>
      </button>
      {deletable && (
        <button type="button" onClick={() => onDelete(equipment.id)} className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-critical hover:bg-red-50 rounded-lg min-h-0 min-w-0" aria-label={`Excluir ${equipment.id}`} title="Excluir equipamento">
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
