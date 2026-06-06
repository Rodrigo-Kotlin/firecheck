import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store';
import { FileText, ChevronDown, TrendingUp, ShieldCheck, AlertOctagon, ClipboardList } from 'lucide-react';
import jsPDF from 'jspdf';

// Extended mock history for reports
const HISTORICO_MOCK = [
  { id: 'H001', data: '15/10/2023', inspetor: 'Rodrigo Silva', equipId: 'EXT-402-B', status: 'APROVADO' as const },
  { id: 'H002', data: '14/10/2023', inspetor: 'Ana Paula', equipId: 'HYD-991-A', status: 'OBSERVAÇÃO' as const },
  { id: 'H003', data: '12/10/2023', inspetor: 'Marcos Rocha', equipId: 'EXT-105-C', status: 'REPROVADO' as const },
  { id: 'H004', data: '11/10/2023', inspetor: 'Rodrigo Silva', equipId: 'EXT-001', status: 'APROVADO' as const },
  { id: 'H005', data: '10/10/2023', inspetor: 'Ana Paula', equipId: 'HID-042', status: 'OBSERVAÇÃO' as const },
  { id: 'H006', data: '08/10/2023', inspetor: 'Marcos Rocha', equipId: 'EXT-109', status: 'REPROVADO' as const },
  { id: 'H007', data: '07/10/2023', inspetor: 'Rodrigo Silva', equipId: 'ALM-005', status: 'APROVADO' as const },
  { id: 'H008', data: '05/10/2023', inspetor: 'Ana Paula', equipId: 'ILU-018', status: 'OBSERVAÇÃO' as const },
];

type HistoricoStatus = 'APROVADO' | 'OBSERVAÇÃO' | 'REPROVADO';

function generateIndividualPDF(insp: typeof HISTORICO_MOCK[0]) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();

  // Header bar
  doc.setFillColor(220, 38, 38);
  doc.rect(0, 0, pageW, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FireCheck', 14, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Sistema de Inspeção de Equipamentos de Combate a Incêndio', 14, 22);

  // Title
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO DE INSPEÇÃO', 14, 44);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Equipamento de Combate a Incêndio', 14, 52);

  // Info block
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(248, 248, 248);
  doc.rect(14, 58, pageW - 28, 52, 'FD');
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DA INSPEÇÃO', 18, 66);
  doc.setFont('helvetica', 'normal');
  const fields = [
    ['Código / Serial', insp.equipId],
    ['Inspetor Responsável', insp.inspetor],
    ['Data de Inspeção', insp.data],
    ['Número do Relatório', insp.id],
  ];
  fields.forEach(([label, val], i) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, 18, 74 + i * 9);
    doc.setFont('helvetica', 'normal');
    doc.text(val, 75, 74 + i * 9);
  });

  // Checklist table header
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('CHECKLIST DE INSPEÇÃO', 14, 122);
  doc.setFillColor(220, 38, 38);
  doc.rect(14, 126, pageW - 28, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('ITEM', 18, 131);
  doc.text('RESULTADO', pageW - 50, 131);

  // Mock checklist items
  const items = [
    ['Acesso livre e desobstruído', 'OK'],
    ['Fixado no suporte correto', 'OK'],
    ['Sinalização visível', insp.status === 'REPROVADO' ? 'REPROVADO' : 'OK'],
    ['Lacre íntegro', 'OK'],
    ['Pino de segurança presente', 'OK'],
    ['Manômetro na faixa verde', insp.status === 'OBSERVAÇÃO' ? 'N.A.' : 'OK'],
    ['Mangueira sem danos', 'OK'],
    ['Rótulo legível', 'OK'],
    ['Carga na validade', insp.status === 'REPROVADO' ? 'REPROVADO' : 'OK'],
    ['Cilindro sem corrosão', 'OK'],
  ];

  let totOK = 0, totRep = 0, totNA = 0;
  items.forEach(([item, res], i) => {
    const y = 140 + i * 9;
    doc.setFillColor(i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 250);
    doc.rect(14, y - 5, pageW - 28, 9, 'F');
    doc.setTextColor(60, 60, 60);
    doc.text(item, 18, y);
    const resColor = res === 'OK' ? [22, 163, 74] : res === 'REPROVADO' ? [220, 38, 38] : [107, 114, 128];
    doc.setTextColor(resColor[0], resColor[1], resColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(res, pageW - 50, y);
    doc.setFont('helvetica', 'normal');
    if (res === 'OK') totOK++;
    else if (res === 'REPROVADO') totRep++;
    else totNA++;
  });

  // Summary
  const sumY = 150 + items.length * 9;
  doc.setFillColor(248, 248, 248);
  doc.setDrawColor(220, 220, 220);
  doc.rect(14, sumY, pageW - 28, 24, 'FD');
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMO:', 18, sumY + 8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(22, 163, 74);
  doc.text(`Total OK: ${totOK}`, 50, sumY + 8);
  doc.setTextColor(220, 38, 38);
  doc.text(`Reprovados: ${totRep}`, 100, sumY + 8);
  doc.setTextColor(107, 114, 128);
  doc.text(`N.A.: ${totNA}`, 155, sumY + 8);

  // Status final
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const statusColor = insp.status === 'APROVADO' ? [22, 163, 74] : insp.status === 'REPROVADO' ? [220, 38, 38] : [217, 119, 6];
  doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.text(`STATUS FINAL: ${insp.status}`, 14, sumY + 20);

  // Signatures
  const sigY = sumY + 38;
  doc.setDrawColor(180, 180, 180);
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.line(14, sigY, 90, sigY);
  doc.text('Assinatura do Inspetor', 14, sigY + 5);
  doc.text(insp.inspetor, 14, sigY + 10);
  doc.line(110, sigY, pageW - 14, sigY);
  doc.text('Assinatura do Responsável da Área', 110, sigY + 5);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`FireCheck — Relatório gerado em ${new Date().toLocaleDateString('pt-BR')}`, 14, 285);

  doc.save(`relatorio_${insp.equipId}_${insp.id}.pdf`);
}

function generateMonthlyPDF(stats: ReturnType<typeof useAppStore.getState>['stats'], inspections: ReturnType<typeof useAppStore.getState>['inspections']) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const now = new Date();
  const mes = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Header
  doc.setFillColor(220, 38, 38);
  doc.rect(0, 0, pageW, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FireCheck', 14, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Relatório Mensal — ${mes}`, 14, 22);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO MENSAL DE CONFORMIDADE', 14, 44);

  // KPI block
  doc.setFillColor(248, 248, 248);
  doc.setDrawColor(220, 220, 220);
  doc.rect(14, 50, pageW - 28, 60, 'FD');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text('INDICADORES DO PERÍODO', 18, 60);

  const kpis = [
    ['Total de Equipamentos', String(stats.total)],
    ['Total Inspecionado no Mês', String(inspections.length)],
    ['Conformes (Em Dia)', String(stats.emDia)],
    ['Pendentes', String(stats.pendentes)],
    ['Vencidos', String(stats.vencidos)],
    ['Índice de Conformidade', `${stats.conformidade}%`],
  ];

  kpis.forEach(([label, val], i) => {
    const col = i % 2 === 0 ? 18 : pageW / 2 + 4;
    const row = Math.floor(i / 2);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(label, col, 70 + row * 12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(val, col, 76 + row * 12);
  });

  // Non-conformities table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('NÃO CONFORMIDADES POR SETOR', 14, 124);

  doc.setFillColor(220, 38, 38);
  doc.rect(14, 128, pageW - 28, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('SETOR', 18, 133);
  doc.text('EQUIPAMENTOS', 80, 133);
  doc.text('REPROVADOS', 130, 133);
  doc.text('STATUS', pageW - 36, 133);

  const setores = [
    ['TI', '12', '2', 'CRÍTICO'],
    ['Estacionamento', '8', '1', 'ATENÇÃO'],
    ['Administrativo', '25', '0', 'OK'],
    ['Comercial', '18', '1', 'ATENÇÃO'],
    ['Circulação', '22', '2', 'CRÍTICO'],
  ];

  setores.forEach(([setor, total, rep, status], i) => {
    const y = 145 + i * 9;
    doc.setFillColor(i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 250);
    doc.rect(14, y - 5, pageW - 28, 9, 'F');
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    doc.text(setor, 18, y);
    doc.text(total, 80, y);
    doc.text(rep, 130, y);
    const sc = status === 'CRÍTICO' ? [220, 38, 38] : status === 'ATENÇÃO' ? [217, 119, 6] : [22, 163, 74];
    doc.setTextColor(sc[0], sc[1], sc[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(status, pageW - 36, y);
  });

  // Pending list
  const pendY = 200;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('PENDÊNCIAS ABERTAS', 14, pendY);

  const pends = inspections.filter(i => i.status === 'vencido' || i.status === 'pendente').slice(0, 5);
  if (pends.length === 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Nenhuma pendência aberta no período.', 18, pendY + 10);
  } else {
    pends.forEach((p, i) => {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(`• [${p.equipmentId}] ${p.data} — ${p.inspetor} (${p.status})`, 18, pendY + 10 + i * 8);
    });
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`FireCheck — Relatório Mensal gerado em ${now.toLocaleDateString('pt-BR')}`, 14, 285);

  doc.save(`relatorio_mensal_${now.getMonth() + 1}_${now.getFullYear()}.pdf`);
}

const STATUS_BADGE: Record<HistoricoStatus, string> = {
  'APROVADO': 'bg-green-100 text-[#16A34A]',
  'OBSERVAÇÃO': 'bg-amber-100 text-[#D97706]',
  'REPROVADO': 'bg-red-100 text-[#DC2626]',
};

function isoToBr(iso: string): string {
  // YYYY-MM-DD -> DD/MM/YYYY
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export default function Relatorios() {
  const { inspections, stats } = useAppStore();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | HistoricoStatus>('Todos');
  const [visibleCount, setVisibleCount] = useState(4);

  const filtered = useMemo(() => {
    const dateBr = isoToBr(dateFilter);
    return HISTORICO_MOCK.filter(h => {
      const term = search.toLowerCase();
      const matchSearch = !term ||
        h.inspetor.toLowerCase().includes(term) ||
        h.equipId.toLowerCase().includes(term);
      const matchDate = !dateFilter || h.data === dateBr;
      const matchStatus = statusFilter === 'Todos' || h.status === statusFilter;
      return matchSearch && matchDate && matchStatus;
    });
  }, [search, dateFilter, statusFilter]);

  const visible = filtered.slice(0, visibleCount);

  const clearFilters = () => {
    setSearch('');
    setDateFilter('');
    setStatusFilter('Todos');
  };

  const hasActiveFilters = !!search || !!dateFilter || statusFilter !== 'Todos';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <header className="page-header">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">Relatórios</div>
          <h1 className="text-base sm:text-lg lg:text-xl font-black text-gray-900 uppercase tracking-wide truncate">
            Histórico & Análise
          </h1>
        </div>
        <button
          onClick={() => generateMonthlyPDF(stats, inspections)}
          className="flex items-center gap-1.5 h-10 px-3 bg-primary text-white rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-primary-dark transition-all min-h-0 min-w-0"
        >
          <FileText className="w-4 h-4" />
          <span className="hidden sm:inline">Relatório</span> Mensal
        </button>
      </header>

      {/* 3 Indicator Cards — 1 col mobile, 3 col on lg */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="card-subtle bg-white flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <ClipboardList className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold uppercase text-gray-400 tracking-wider">Inspeções Totais</div>
            <div className="text-2xl font-black text-gray-900">128</div>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-black text-success bg-green-50 px-2 py-1 rounded-full uppercase flex-shrink-0">
            <TrendingUp className="w-3 h-3" />
            +12%
          </div>
        </div>

        <div className="card-subtle bg-white flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-6 h-6 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold uppercase text-gray-400 tracking-wider">Equipamentos Conformes</div>
            <div className="text-2xl font-black text-success">114</div>
          </div>
          <div className="text-[10px] font-black text-gray-500 bg-gray-100 px-2 py-1 rounded-full flex-shrink-0">89%</div>
        </div>

        <div className="card-subtle bg-white flex items-center gap-4 sm:col-span-2 lg:col-span-1">
          <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertOctagon className="w-6 h-6 text-critical" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold uppercase text-gray-400 tracking-wider">Pendências Críticas</div>
            <div className="text-2xl font-black text-critical">06</div>
            <div className="text-[10px] text-critical font-bold uppercase">Requer ação imediata</div>
          </div>
          <button
            onClick={() => navigate('/planodeacao')}
            className="text-[10px] font-black text-critical border border-red-200 px-2 py-1.5 rounded-lg hover:bg-red-50 uppercase tracking-wider min-h-0 min-w-0 flex-shrink-0"
          >
            Ver Plano
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Filter section */}
        <div className="card-subtle bg-white space-y-3 lg:sticky lg:top-24 self-start">
          <div className="flex items-center justify-between">
            <span className="label-uppercase">Filtros</span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[11px] font-bold uppercase tracking-wider text-critical hover:underline"
              >
                Limpar
              </button>
            )}
          </div>
          <div>
            <label className="field-label">Buscar</label>
            <input
              type="text"
              placeholder="Serial ou inspetor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label">Data</label>
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label">Status</label>
            <div className="flex gap-1.5 flex-wrap">
              {(['Todos', 'APROVADO', 'OBSERVAÇÃO', 'REPROVADO'] as const).map(s => {
                const isActive = statusFilter === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={`h-9 px-3 rounded-full text-[11px] font-black uppercase tracking-wider border transition-all ${
                      isActive
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* History list */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <span className="label-uppercase">Histórico de Inspeções</span>
            <span className="pill bg-gray-100 text-gray-500">{filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}</span>
          </div>

          {visible.length === 0 && (
            <div className="card-subtle bg-white text-center py-12 space-y-2">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                <ClipboardList className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm font-bold text-gray-500">Nenhum registro encontrado</p>
              <p className="text-xs text-gray-400">Ajuste os filtros para ver mais resultados.</p>
            </div>
          )}

          {visible.map(h => (
            <div key={h.id} className="card-subtle bg-white flex items-center gap-3">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-gray-900">{h.equipId}</span>
                  <span className={`pill ${STATUS_BADGE[h.status]}`}>{h.status}</span>
                </div>
                <div className="text-xs text-gray-500 font-semibold">{h.data} · {h.inspetor}</div>
              </div>
              <button
                onClick={() => generateIndividualPDF(h)}
                className="w-10 h-10 flex items-center justify-center bg-gray-50 border border-gray-100 hover:bg-red-50 hover:border-primary rounded-lg transition-all min-h-0 min-w-0"
                title="Gerar PDF"
                aria-label="Gerar PDF do relatório"
              >
                <FileText className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          ))}

          {visible.length < filtered.length && (
            <button
              onClick={() => setVisibleCount(c => c + 4)}
              className="w-full h-12 border-2 border-dashed border-gray-200 rounded-xl font-bold text-xs uppercase tracking-wider text-gray-400 hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2"
            >
              <ChevronDown className="w-4 h-4" />
              Carregar mais registros
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
