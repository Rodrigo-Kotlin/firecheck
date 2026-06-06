import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store';
import { Search, QrCode, Plus, Calendar, AlertCircle, MapPin, Lock } from 'lucide-react';
import { canEditEquipment } from '../../services/permissions';

const CATEGORIES = [
  { label: 'Tudo', filter: 'Tudo' },
  { label: 'Extintores', filter: 'Extintor' },
  { label: 'Hidrantes', filter: 'Hidrante' },
  { label: 'Alarmes', filter: 'Alarme' },
  { label: 'Iluminação', filter: 'Iluminação' },
  { label: 'Acionadores', filter: 'Acionador' },
  { label: 'Mangueiras', filter: 'Mangueira' },
  { label: 'Sprinklers', filter: 'Sprinkler' },
  { label: 'Bombas', filter: 'Bomba' },
];

export default function Equipamentos() {
  const { equipments, inspections, user } = useAppStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeChip, setActiveChip] = useState('Tudo');

  const filtered = equipments.filter((eq) => {
    const matchesSearch =
      eq.id.toLowerCase().includes(search.toLowerCase()) ||
      eq.tipo.toLowerCase().includes(search.toLowerCase()) ||
      (eq.subtipo && eq.subtipo.toLowerCase().includes(search.toLowerCase())) ||
      eq.local.toLowerCase().includes(search.toLowerCase()) ||
      eq.setor.toLowerCase().includes(search.toLowerCase());

    if (activeChip === 'Tudo') return matchesSearch;
    const matchesCategory =
      eq.tipo.toLowerCase().includes(activeChip.toLowerCase().slice(0, -3)) ||
      eq.tipo.toLowerCase().includes(activeChip.toLowerCase().slice(0, -1)) ||
      (activeChip === 'Iluminação' && eq.tipo === 'Iluminação');

    return matchesSearch && matchesCategory;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'regular':
        return <span className="pill bg-green-100 text-success">Regular</span>;
      case 'pendente':
        return <span className="pill bg-amber-100 text-pending">Pendente</span>;
      case 'vencido':
        return <span className="pill bg-red-100 text-critical">Vencido</span>;
      case 'observacao':
      default:
        return <span className="pill bg-gray-100 text-gray-500">Observação</span>;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <header className="page-header">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">Equipamentos</div>
          <h1 className="text-base sm:text-lg lg:text-xl font-black text-gray-900 uppercase tracking-wide truncate">
            Inventário de Dispositivos
          </h1>
          <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">{filtered.length} de {equipments.length} {equipments.length === 1 ? 'item' : 'itens'}</p>
        </div>
        <button
          onClick={() => navigate('/scan')}
          className="w-10 h-10 lg:w-auto lg:h-10 lg:px-3 flex items-center justify-center gap-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-all min-h-0 min-w-0"
          aria-label="Escanear QR Code"
        >
          <QrCode className="w-5 h-5" />
          <span className="hidden lg:inline text-xs font-bold uppercase tracking-wider">Escanear</span>
        </button>
      </header>

      {/* Search Field */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
          <Search className="w-4 h-4" />
        </span>
        <input
          type="text"
          placeholder="Buscar por código, tipo, setor ou local..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="field-input pl-11 pr-10"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            aria-label="Limpar busca"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        )}
      </div>

      {/* Filter Chips — scrollable on mobile, with edge fade for affordance */}
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-neutralBg to-transparent pointer-events-none z-10 sm:hidden" />
        <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-neutralBg to-transparent pointer-events-none z-10 sm:hidden" />
        <div className="flex gap-2 overflow-x-auto overflow-y-hidden pb-2 -mx-4 sm:mx-0 px-4 sm:px-0 pr-5 sm:pr-0 scroll-px-4 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isActive = activeChip === cat.filter;
            return (
              <button
                key={cat.filter}
                onClick={() => setActiveChip(cat.filter)}
                className={`flex-none h-9 px-4 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border ${
                  isActive
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Equipment List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pb-20">
        {filtered.map((eq) => {
          const lastInsp = inspections.find(i => i.equipmentId === eq.id);
          const isExpiring = eq.status === 'vencido' || eq.status === 'pendente';
          const editable = canEditEquipment(user, eq);

          return (
            <div
              key={eq.id}
              onClick={() => navigate(`/equipamentos/${eq.id}`)}
              className="card-subtle bg-white flex flex-col gap-3 cursor-pointer hover:border-gray-300 hover:shadow-md transition-all active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-extrabold text-gray-900">{eq.id}</span>
                    {getStatusBadge(eq.status)}
                  </div>
                </div>
                {!editable && (
                  <span
                    title="Somente leitura — você não é o responsável"
                    className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0"
                  >
                    <Lock className="w-3 h-3" />
                    Leitura
                  </span>
                )}
              </div>

              <div>
                <div className="text-sm font-bold text-gray-700 line-clamp-1">
                  {eq.tipo} {eq.subtipo && `· ${eq.subtipo}`}
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{eq.local} ({eq.setor})</span>
                </div>
              </div>

              <div className="space-y-1 pt-2 border-t border-gray-50">
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Última Insp: {lastInsp ? lastInsp.data : 'Nenhuma'}</span>
                </div>
                {isExpiring && eq.dataProximaInspecao && (
                  <div className="flex items-center gap-1.5 text-[11px] text-critical font-bold uppercase">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Prox. Insp: {eq.dataProximaInspecao}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full card-subtle bg-white text-center py-12 space-y-2">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
              <Search className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">
              Nenhum equipamento encontrado
            </p>
            <p className="text-xs text-gray-400">Ajuste os filtros ou cadastre um novo equipamento.</p>
          </div>
        )}
      </div>

      {/* FAB "+" */}
      <button
        onClick={() => navigate('/equipamentos/novo')}
        className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 lg:bottom-8 lg:right-8 w-14 h-14 bg-primary hover:bg-primary-dark text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all z-40 border-none cursor-pointer"
        aria-label="Adicionar Equipamento"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
