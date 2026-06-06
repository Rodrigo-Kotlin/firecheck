import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store';
import { Plus, QrCode, AlertTriangle, ShieldAlert, ArrowRight, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const { user, stats, equipments, setCurrentTab } = useAppStore();
  const navigate = useNavigate();

  const alertEquipments = equipments.filter(eq => eq.status === 'vencido' || eq.status === 'pendente').slice(0, 3);

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

  const statusCards = [
    { key: 'total', label: 'Total', value: stats.total, color: 'text-gray-500', accent: 'border-l-gray-300' },
    { key: 'emDia', label: 'Em Dia', value: stats.emDia, color: 'text-success', accent: 'border-l-success' },
    { key: 'pendentes', label: 'Pendentes', value: stats.pendentes, color: 'text-pending', accent: 'border-l-pending' },
    { key: 'vencidos', label: 'Vencidos', value: stats.vencidos, color: 'text-critical', accent: 'border-l-critical' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Welcome + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Greeting card */}
        <div className="lg:col-span-2 card-subtle bg-white flex items-center gap-4">
          <div className="w-14 h-14 lg:w-16 lg:h-16 bg-primary rounded-2xl flex items-center justify-center text-white font-black text-lg lg:text-xl shadow-md flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg lg:text-xl font-black text-gray-900 truncate">
              Olá, {user?.nome?.split(' ')[0] || 'Inspetor'}!
            </h2>
            <p className="text-xs lg:text-sm text-gray-500 mt-0.5 line-clamp-2">
              {user?.cargo || 'Inspetor'} · {stats.total} equipamentos cadastrados · {stats.conformidade}% de conformidade
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
              </span>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Sessão ativa</span>
            </div>
          </div>
        </div>

        {/* Donut chart */}
        <div className="card-subtle bg-white flex flex-row lg:flex-col items-center justify-center p-4 lg:p-6 gap-4">
          <span className="label-uppercase flex-1 lg:flex-none text-left lg:text-center">Conformidade</span>
          <div className="relative w-20 h-20 lg:w-28 lg:h-28 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle className="text-gray-100" strokeWidth="10" stroke="currentColor" fill="transparent" r={radius} cx="50" cy="50" />
              <circle
                className="text-success transition-all duration-1000 ease-out"
                strokeWidth="10"
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
            <div className="absolute flex flex-col items-center">
              <span className="text-xl lg:text-2xl font-extrabold text-gray-800">{stats.conformidade}%</span>
              <span className="text-[9px] uppercase font-bold text-gray-400">Regular</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards — 2-col on mobile, 4-col on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statusCards.map(card => (
          <div key={card.key} className={`card-subtle bg-white flex flex-col justify-between border-l-4 ${card.accent}`}>
            <span className={`label-uppercase block ${card.color}`}>{card.label}</span>
            <span className={`text-2xl lg:text-3xl font-extrabold mt-2 ${card.color}`}>{card.value}</span>
          </div>
        ))}
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
                    className="flex items-center justify-center border border-gray-200 hover:bg-gray-50 rounded-lg text-xs font-bold text-gray-600 h-10 px-3 uppercase tracking-wider"
                  >
                    Ver Detalhes
                  </button>
                  <button
                    onClick={() => {
                      setCurrentTab('inspecionar');
                      navigate(`/inspecionar?id=${eq.id}`);
                    }}
                    className="flex items-center justify-center bg-primary hover:bg-primary-dark rounded-lg text-xs font-bold text-white h-10 px-3 uppercase tracking-wider gap-1"
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
