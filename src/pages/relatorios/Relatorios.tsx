import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store';
import { FileText, ChevronDown, ShieldCheck, AlertOctagon, ClipboardList, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';
import { canDeleteInspection } from '../../services/permissions';
import { showToast } from '../../hooks/useToasts';
import ConfirmDialog from '../../components/ConfirmDialog';
import type { Inspection, Equipment, Stats } from '../../types';

type HistoryEntry = {
  id: string;
  data: string;
  dataISO: string;
  inspetor: string;
  equipId: string;
  status: HistoryStatus;
  observacoes?: string;
};

type HistoryStatus = 'APROVADO' | 'OBSERVAÇÃO' | 'REPROVADO' | 'PENDENTE';

const STATUS_MAP: Record<string, HistoryStatus> = {
  regular: 'APROVADO',
  observacao: 'OBSERVAÇÃO',
  vencido: 'REPROVADO',
  pendente: 'PENDENTE',
};

const PDF_COLORS = {
  primary: [220, 38, 38] as [number, number, number],
  primaryDark: [185, 28, 28] as [number, number, number],
  primaryLight: [254, 226, 226] as [number, number, number],
  text: [17, 24, 39] as [number, number, number],
  textMuted: [75, 85, 99] as [number, number, number],
  textSubtle: [156, 163, 175] as [number, number, number],
  border: [229, 231, 235] as [number, number, number],
  borderStrong: [209, 213, 219] as [number, number, number],
  bgLight: [249, 250, 251] as [number, number, number],
  bgAlt: [243, 244, 246] as [number, number, number],
  success: [22, 163, 74] as [number, number, number],
  successLight: [220, 252, 231] as [number, number, number],
  warning: [217, 119, 6] as [number, number, number],
  warningLight: [254, 243, 199] as [number, number, number],
  critical: [220, 38, 38] as [number, number, number],
  criticalLight: [254, 226, 226] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

const HISTORY_STATUS_COLORS: Record<HistoryStatus, [number, number, number]> = {
  APROVADO: PDF_COLORS.success,
  'OBSERVAÇÃO': PDF_COLORS.warning,
  REPROVADO: PDF_COLORS.critical,
  PENDENTE: PDF_COLORS.warning,
};

const HISTORY_STATUS_BADGE: Record<HistoryStatus, string> = {
  APROVADO: 'bg-green-100 text-success',
  'OBSERVAÇÃO': 'bg-amber-100 text-pending',
  REPROVADO: 'bg-red-100 text-critical',
  PENDENTE: 'bg-orange-100 text-orange-600',
};

const PDF_PAGE = { w: 210, h: 297 };
const PDF_MARGIN = 15;
const PDF_CONTENT_W = PDF_PAGE.w - PDF_MARGIN * 2;
const PDF_HEADER_H = 18;
const PDF_FOOTER_Y = PDF_PAGE.h - 12;

type DrawCtx = {
  doc: jsPDF;
  y: number;
  page: number;
  reportId: string;
  company: string;
  unit: string;
};

function makeCtx(doc: jsPDF, reportId: string, company: string, unit: string): DrawCtx {
  return { doc, y: 0, page: 1, reportId, company, unit };
}

function addPage(ctx: DrawCtx) {
  ctx.doc.addPage();
  ctx.page += 1;
  drawPageHeader(ctx);
  ctx.y = PDF_HEADER_H + 6;
}

function ensureSpace(ctx: DrawCtx, neededH: number) {
  if (ctx.y + neededH > PDF_FOOTER_Y - 6) {
    drawFooter(ctx);
    addPage(ctx);
  }
}

function drawPageHeader(ctx: DrawCtx) {
  ctx.doc.setFillColor(...PDF_COLORS.primary);
  ctx.doc.rect(0, 0, PDF_PAGE.w, 2, 'F');
  ctx.doc.setTextColor(...PDF_COLORS.text);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(9);
  ctx.doc.text('FireCheck', PDF_MARGIN, 9);
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setTextColor(...PDF_COLORS.textMuted);
  ctx.doc.setFontSize(7);
  ctx.doc.text('Sistema de Inspeção de Equipamentos de Combate a Incêndio', PDF_MARGIN, 13);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setTextColor(...PDF_COLORS.text);
  ctx.doc.setFontSize(7);
  ctx.doc.text(`Relatório: ${ctx.reportId}`, PDF_PAGE.w - PDF_MARGIN, 9, { align: 'right' });
  ctx.doc.setDrawColor(...PDF_COLORS.border);
  ctx.doc.setLineWidth(0.2);
  ctx.doc.line(PDF_MARGIN, 16, PDF_PAGE.w - PDF_MARGIN, 16);
}

function drawFooter(ctx: DrawCtx) {
  ctx.doc.setDrawColor(...PDF_COLORS.border);
  ctx.doc.setLineWidth(0.2);
  ctx.doc.line(PDF_MARGIN, PDF_FOOTER_Y - 4, PDF_PAGE.w - PDF_MARGIN, PDF_FOOTER_Y - 4);
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(7);
  ctx.doc.setTextColor(...PDF_COLORS.textSubtle);
  ctx.doc.text(
    `FireCheck — Documento técnico — Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
    PDF_MARGIN,
    PDF_FOOTER_Y,
  );
  ctx.doc.text(`Página ${ctx.page}`, PDF_PAGE.w - PDF_MARGIN, PDF_FOOTER_Y, { align: 'right' });
}

function drawCover(ctx: DrawCtx, opts: {
  reportType: string;
  reportNumber: string;
  subtitle?: string;
  period?: string;
}) {
  const { doc } = ctx;
  doc.setFillColor(...PDF_COLORS.primary);
  doc.rect(0, 0, PDF_PAGE.w, 38, 'F');
  doc.setTextColor(...PDF_COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text('FireCheck', PDF_PAGE.w / 2, 20, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('SISTEMA DE INSPEÇÃO DE EQUIPAMENTOS DE COMBATE A INCÊNDIO', PDF_PAGE.w / 2, 30, { align: 'center' });
  doc.setFillColor(...PDF_COLORS.white);
  for (let i = 0; i < 3; i++) {
    doc.circle(PDF_PAGE.w / 2 - 4 + i * 4, 36, 0.6, 'F');
  }
  doc.setTextColor(...PDF_COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(opts.reportType.toUpperCase(), PDF_PAGE.w / 2, 90, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.textMuted);
  doc.text(opts.subtitle ?? 'Equipamento de Combate a Incêndio', PDF_PAGE.w / 2, 100, { align: 'center' });
  if (opts.period) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...PDF_COLORS.text);
    doc.text(opts.period, PDF_PAGE.w / 2, 112, { align: 'center' });
  }
  doc.setDrawColor(...PDF_COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(PDF_PAGE.w / 2 - 25, 124, PDF_PAGE.w / 2 + 25, 124);
  doc.setTextColor(...PDF_COLORS.textMuted);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('EMITIDO PARA', PDF_PAGE.w / 2, 168, { align: 'center' });
  doc.setTextColor(...PDF_COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(ctx.company, PDF_PAGE.w / 2, 180, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.textMuted);
  doc.text(ctx.unit, PDF_PAGE.w / 2, 188, { align: 'center' });
  const infoY = 222;
  const infoH = 36;
  doc.setFillColor(...PDF_COLORS.bgLight);
  doc.setDrawColor(...PDF_COLORS.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(PDF_MARGIN, infoY, PDF_CONTENT_W, infoH, 2, 2, 'FD');
  const colW = PDF_CONTENT_W / 3;
  const infoCols = [
    ['Nº DO RELATÓRIO', opts.reportNumber],
    ['DATA DE EMISSÃO', new Date().toLocaleDateString('pt-BR')],
    ['VERSÃO', '1.0'],
  ];
  infoCols.forEach(([label, value], i) => {
    const x = PDF_MARGIN + colW * i + colW / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text(label, x, infoY + 11, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...PDF_COLORS.text);
    doc.text(value, x, infoY + 22, { align: 'center' });
  });
  doc.setFillColor(...PDF_COLORS.primary);
  doc.rect(0, PDF_PAGE.h - 8, PDF_PAGE.w, 8, 'F');
  doc.setTextColor(...PDF_COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('DOCUMENTO TÉCNICO — USO INTERNO', PDF_PAGE.w / 2, PDF_PAGE.h - 3, { align: 'center' });
}

function drawSectionHeader(ctx: DrawCtx, num: number, title: string) {
  ensureSpace(ctx, 18);
  ctx.doc.setFillColor(...PDF_COLORS.primary);
  ctx.doc.roundedRect(PDF_MARGIN, ctx.y, 8, 8, 1, 1, 'F');
  ctx.doc.setTextColor(...PDF_COLORS.white);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(9);
  ctx.doc.text(String(num), PDF_MARGIN + 4, ctx.y + 5.8, { align: 'center' });
  ctx.doc.setTextColor(...PDF_COLORS.text);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(12);
  ctx.doc.text(title.toUpperCase(), PDF_MARGIN + 12, ctx.y + 6);
  ctx.y += 12;
  ctx.doc.setDrawColor(...PDF_COLORS.primary);
  ctx.doc.setLineWidth(0.5);
  ctx.doc.line(PDF_MARGIN, ctx.y, PDF_MARGIN + 30, ctx.y);
  ctx.doc.setDrawColor(...PDF_COLORS.border);
  ctx.doc.setLineWidth(0.2);
  ctx.doc.line(PDF_MARGIN + 30, ctx.y, PDF_PAGE.w - PDF_MARGIN, ctx.y);
  ctx.y += 7;
}

function drawKVGrid(ctx: DrawCtx, items: Array<[string, string]>, cols: 2 | 3 = 2) {
  const colW = PDF_CONTENT_W / cols;
  const rowH = 13;
  const rows = Math.ceil(items.length / cols);
  ensureSpace(ctx, rows * rowH);
  items.forEach(([label, value], i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = PDF_MARGIN + col * colW;
    const y = ctx.y + row * rowH;
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(6.5);
    ctx.doc.setTextColor(...PDF_COLORS.textMuted);
    ctx.doc.text(label.toUpperCase(), x, y);
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(9);
    ctx.doc.setTextColor(...PDF_COLORS.text);
    ctx.doc.text(value || '—', x, y + 5);
    if (col < cols - 1) {
      ctx.doc.setDrawColor(...PDF_COLORS.border);
      ctx.doc.setLineWidth(0.1);
      ctx.doc.line(x + colW - 2, y - 2, x + colW - 2, y + 6);
    }
  });
  ctx.y += rows * rowH + 2;
}

function drawStatCards(ctx: DrawCtx, cards: Array<{ label: string; value: string; color: [number, number, number]; bg?: [number, number, number] }>) {
  const gap = 3;
  const cardW = (PDF_CONTENT_W - gap * (cards.length - 1)) / cards.length;
  const cardH = 22;
  ensureSpace(ctx, cardH);
  cards.forEach((c, i) => {
    const x = PDF_MARGIN + i * (cardW + gap);
    ctx.doc.setFillColor(...(c.bg ?? PDF_COLORS.white));
    ctx.doc.setDrawColor(...PDF_COLORS.border);
    ctx.doc.setLineWidth(0.3);
    ctx.doc.roundedRect(x, ctx.y, cardW, cardH, 1.5, 1.5, 'FD');
    ctx.doc.setFillColor(...c.color);
    ctx.doc.rect(x, ctx.y, cardW, 1.5, 'F');
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(6.5);
    ctx.doc.setTextColor(...PDF_COLORS.textMuted);
    ctx.doc.text(c.label.toUpperCase(), x + 3, ctx.y + 7);
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(14);
    ctx.doc.setTextColor(...c.color);
    ctx.doc.text(c.value, x + 3, ctx.y + cardH - 4);
  });
  ctx.y += cardH + 4;
}

function drawTable(
  ctx: DrawCtx,
  headers: string[],
  rows: Array<Array<string | { text: string; color?: [number, number, number]; bold?: boolean }>>,
  colWidths: number[],
  options: { aligns?: Array<'left' | 'center' | 'right'> } = {},
) {
  const aligns = options.aligns ?? headers.map(() => 'left' as const);
  const headerH = 8;
  const rowH = 8;
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  ensureSpace(ctx, headerH + rowH);
  ctx.doc.setFillColor(...PDF_COLORS.primary);
  ctx.doc.rect(PDF_MARGIN, ctx.y, totalW, headerH, 'F');
  ctx.doc.setTextColor(...PDF_COLORS.white);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(7.5);
  let hx = PDF_MARGIN;
  headers.forEach((h, i) => {
    const a = aligns[i];
    const padX = a === 'right' ? colWidths[i] - 2 : a === 'center' ? colWidths[i] / 2 : 2;
    ctx.doc.text(h.toUpperCase(), hx + padX, ctx.y + 5.5, { align: a });
    hx += colWidths[i];
  });
  ctx.y += headerH;
  rows.forEach((row, ri) => {
    ensureSpace(ctx, rowH);
    if (ri % 2 === 1) {
      ctx.doc.setFillColor(...PDF_COLORS.bgAlt);
      ctx.doc.rect(PDF_MARGIN, ctx.y, totalW, rowH, 'F');
    }
    let cx = PDF_MARGIN;
    row.forEach((cell, ci) => {
      const text = typeof cell === 'string' ? cell : cell.text;
      const color = (typeof cell === 'object' && cell.color) || PDF_COLORS.text;
      const bold = typeof cell === 'object' && cell.bold;
      const a = aligns[ci];
      const padX = a === 'right' ? colWidths[ci] - 2 : a === 'center' ? colWidths[ci] / 2 : 2;
      let truncated = text;
      const maxW = colWidths[ci] - 4;
      while (ctx.doc.getTextWidth(truncated) > maxW && truncated.length > 0) {
        truncated = truncated.slice(0, -1);
      }
      if (truncated.length < text.length) truncated = truncated.slice(0, -1) + '…';
      ctx.doc.setFont('helvetica', bold ? 'bold' : 'normal');
      ctx.doc.setFontSize(8);
      ctx.doc.setTextColor(...color);
      ctx.doc.text(truncated, cx + padX, ctx.y + 5.5, { align: a });
      cx += colWidths[ci];
    });
    ctx.y += rowH;
  });
  ctx.doc.setDrawColor(...PDF_COLORS.border);
  ctx.doc.setLineWidth(0.3);
  ctx.doc.line(PDF_MARGIN, ctx.y, PDF_MARGIN + totalW, ctx.y);
  ctx.y += 4;
}

function drawEmptyState(ctx: DrawCtx, message: string) {
  ensureSpace(ctx, 18);
  const boxH = 14;
  ctx.doc.setFillColor(...PDF_COLORS.bgLight);
  ctx.doc.setDrawColor(...PDF_COLORS.border);
  ctx.doc.setLineWidth(0.3);
  ctx.doc.setLineDashPattern([1, 1], 0);
  ctx.doc.roundedRect(PDF_MARGIN, ctx.y, PDF_CONTENT_W, boxH, 1.5, 1.5, 'FD');
  ctx.doc.setLineDashPattern([], 0);
  ctx.doc.setFont('helvetica', 'italic');
  ctx.doc.setFontSize(8.5);
  ctx.doc.setTextColor(...PDF_COLORS.textSubtle);
  ctx.doc.text(message, PDF_MARGIN + 5, ctx.y + 9);
  ctx.y += boxH + 4;
}

function drawStatusPill(ctx: DrawCtx, x: number, y: number, label: string, color: [number, number, number], bg: [number, number, number]) {
  ctx.doc.setFontSize(7);
  ctx.doc.setFont('helvetica', 'bold');
  const w = ctx.doc.getTextWidth(label) + 4;
  const h = 5;
  ctx.doc.setFillColor(...bg);
  ctx.doc.roundedRect(x, y - h + 1, w, h, 1, 1, 'F');
  ctx.doc.setTextColor(...color);
  ctx.doc.text(label, x + 2, y);
  return w;
}

function isoToBr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function generateIndividualPDF(entry: HistoryEntry, company: string, unit: string, equipment?: Equipment) {
  const doc = new jsPDF();
  const ctx = makeCtx(doc, entry.id, company, unit);

  drawCover(ctx, {
    reportType: 'Relatório de Inspeção',
    reportNumber: entry.id,
    subtitle: 'Equipamento de Combate a Incêndio',
  });

  addPage(ctx);

  drawSectionHeader(ctx, 1, 'Dados da Inspeção');
  drawKVGrid(ctx, [
    ['Código / Serial', entry.equipId],
    ['Inspetor Responsável', entry.inspetor],
    ['Data da Inspeção', entry.data],
    ['Nº do Relatório', entry.id],
  ], 2);

  const items = [
    ['Acesso livre e desobstruído', 'OK'],
    ['Fixado no suporte correto', 'OK'],
    ['Sinalização visível', entry.status === 'REPROVADO' ? 'REPROVADO' : 'OK'],
    ['Lacre íntegro', 'OK'],
    ['Pino de segurança presente', 'OK'],
    ['Manômetro na faixa verde', entry.status === 'OBSERVAÇÃO' ? 'N.A.' : 'OK'],
    ['Mangueira sem danos', 'OK'],
    ['Rótulo legível', 'OK'],
    ['Carga na validade', entry.status === 'REPROVADO' ? 'REPROVADO' : 'OK'],
    ['Cilindro sem corrosão', 'OK'],
  ];
  const totOK = items.filter(([, r]) => r === 'OK').length;
  const totRep = items.filter(([, r]) => r === 'REPROVADO').length;
  const totNA = items.filter(([, r]) => r === 'N.A.').length;
  const conformity = Math.round((totOK / items.length) * 100);

  drawSectionHeader(ctx, 2, 'Resumo Quantitativo');
  drawStatCards(ctx, [
    { label: 'Itens Avaliados', value: String(items.length), color: PDF_COLORS.text, bg: PDF_COLORS.bgLight },
    { label: 'Conformes', value: String(totOK), color: PDF_COLORS.success, bg: PDF_COLORS.successLight },
    { label: 'Reprovados', value: String(totRep), color: PDF_COLORS.critical, bg: PDF_COLORS.criticalLight },
    { label: 'Não Aplicáveis', value: String(totNA), color: PDF_COLORS.textMuted, bg: PDF_COLORS.bgAlt },
  ]);

  ensureSpace(ctx, 8);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(7);
  ctx.doc.setTextColor(...PDF_COLORS.textMuted);
  ctx.doc.text('ÍNDICE DE CONFORMIDADE', PDF_MARGIN, ctx.y);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(9);
  ctx.doc.setTextColor(...PDF_COLORS.text);
  ctx.doc.text(`${conformity}%`, PDF_PAGE.w - PDF_MARGIN, ctx.y, { align: 'right' });
  ctx.y += 3;
  const barW = PDF_CONTENT_W;
  const barH = 3.5;
  ctx.doc.setFillColor(...PDF_COLORS.bgAlt);
  ctx.doc.roundedRect(PDF_MARGIN, ctx.y, barW, barH, 0.5, 0.5, 'F');
  const barColor = conformity >= 80 ? PDF_COLORS.success : conformity >= 50 ? PDF_COLORS.warning : PDF_COLORS.critical;
  ctx.doc.setFillColor(...barColor);
  ctx.doc.roundedRect(PDF_MARGIN, ctx.y, (barW * conformity) / 100, barH, 0.5, 0.5, 'F');
  ctx.y += barH + 4;

  drawSectionHeader(ctx, 3, 'Equipamentos Avaliados');
  drawTable(
    ctx,
    ['Identificação', 'Tipo', 'Local', 'Setor', 'Status'],
    [[
      entry.equipId,
      equipment?.tipo ?? '—',
      equipment?.local ?? '—',
      equipment?.setor ?? '—',
      { text: entry.status, color: HISTORY_STATUS_COLORS[entry.status], bold: true },
    ]],
    [30, 30, 50, 35, 35],
    { aligns: ['left', 'left', 'left', 'left', 'center'] },
  );

  const ncs = items.filter(([, r]) => r !== 'OK');
  drawSectionHeader(ctx, 4, 'Não Conformidades');
  if (ncs.length === 0) {
    drawEmptyState(ctx, 'Nenhuma não conformidade identificada nesta inspeção.');
  } else {
    drawTable(
      ctx,
      ['Item Avaliado', 'Resultado', 'Severidade'],
      ncs.map(([item, res]) => [
        item,
        { text: res, color: res === 'REPROVADO' ? PDF_COLORS.critical : PDF_COLORS.textMuted, bold: true },
        res === 'REPROVADO' ? 'Crítica' : 'Menor',
      ]),
      [110, 35, 35],
      { aligns: ['left', 'center', 'center'] },
    );
  }

  drawSectionHeader(ctx, 5, 'Plano de Ação');
  drawEmptyState(ctx, 'Sem plano de ação vinculado a esta inspeção no momento da emissão.');

  drawSectionHeader(ctx, 6, 'Evidências Fotográficas');
  drawEmptyState(ctx, 'Nenhuma evidência fotográfica anexada a este relatório.');

  drawSectionHeader(ctx, 7, 'Conclusão');
  ensureSpace(ctx, 30);

  const conclH = 24;
  const calloutColor = HISTORY_STATUS_COLORS[entry.status];
  const calloutBg = entry.status === 'APROVADO' ? PDF_COLORS.successLight
    : entry.status === 'REPROVADO' ? PDF_COLORS.criticalLight
    : PDF_COLORS.warningLight;
  ctx.doc.setFillColor(...calloutBg);
  ctx.doc.setDrawColor(...calloutColor);
  ctx.doc.setLineWidth(0.4);
  ctx.doc.roundedRect(PDF_MARGIN, ctx.y, PDF_CONTENT_W, conclH, 2, 2, 'FD');
  ctx.doc.setFillColor(...calloutColor);
  ctx.doc.rect(PDF_MARGIN, ctx.y, 1.5, conclH, 'F');
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(7);
  ctx.doc.setTextColor(...PDF_COLORS.textMuted);
  ctx.doc.text('PARECER TÉCNICO', PDF_MARGIN + 5, ctx.y + 6);
  drawStatusPill(ctx, PDF_MARGIN + 5, ctx.y + 15, entry.status, calloutColor, PDF_COLORS.white);
  const verdict = entry.status === 'APROVADO'
    ? 'Equipamento em conformidade. Manter plano de manutenção preventiva.'
    : entry.status === 'REPROVADO'
      ? 'Equipamento reprovado. Acionar equipe de manutenção e abrir plano de ação corretiva.'
      : 'Equipamento com observação. Reinspecionar no próximo ciclo programado.';
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(9);
  ctx.doc.setTextColor(...PDF_COLORS.text);
  const wrappedVerdict = ctx.doc.splitTextToSize(verdict, PDF_CONTENT_W - 80);
  ctx.doc.text(wrappedVerdict, PDF_MARGIN + 50, ctx.y + 13);
  ctx.y += conclH + 8;

  ensureSpace(ctx, 28);
  const sigY = ctx.y;
  const sigLineW = 75;
  ctx.doc.setDrawColor(...PDF_COLORS.borderStrong);
  ctx.doc.setLineWidth(0.3);
  ctx.doc.line(PDF_MARGIN, sigY, PDF_MARGIN + sigLineW, sigY);
  ctx.doc.line(PDF_PAGE.w - PDF_MARGIN - sigLineW, sigY, PDF_PAGE.w - PDF_MARGIN, sigY);
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(7.5);
  ctx.doc.setTextColor(...PDF_COLORS.textMuted);
  ctx.doc.text('Assinatura do Inspetor', PDF_MARGIN, sigY + 5);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setTextColor(...PDF_COLORS.text);
  ctx.doc.setFontSize(8.5);
  ctx.doc.text(entry.inspetor, PDF_MARGIN, sigY + 10);
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setTextColor(...PDF_COLORS.textMuted);
  ctx.doc.setFontSize(7.5);
  ctx.doc.text('Assinatura do Responsável Técnico', PDF_PAGE.w - PDF_MARGIN - sigLineW, sigY + 5);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setTextColor(...PDF_COLORS.text);
  ctx.doc.setFontSize(8.5);
  ctx.doc.text('_______________________', PDF_PAGE.w - PDF_MARGIN - sigLineW, sigY + 10);
  ctx.y = sigY + 16;

  drawFooter(ctx);
  doc.save(`relatorio_${entry.equipId}_${entry.id}.pdf`);
}

function generateMonthlyPDF(
  stats: Stats,
  inspections: Inspection[],
  equipments: Equipment[],
  company: string,
  unit: string,
) {
  const doc = new jsPDF();
  const ctx = makeCtx(doc, `MENSAL-${new Date().toISOString().slice(0, 7)}`, company, unit);
  const now = new Date();
  const mes = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  drawCover(ctx, {
    reportType: 'Relatório Mensal de Conformidade',
    reportNumber: `MENSAL-${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`,
    subtitle: 'Sumário executivo de conformidade',
    period: mes.charAt(0).toUpperCase() + mes.slice(1),
  });

  addPage(ctx);

  drawSectionHeader(ctx, 1, 'Dados do Relatório');
  drawKVGrid(ctx, [
    ['Período de Referência', mes.charAt(0).toUpperCase() + mes.slice(1)],
    ['Data de Emissão', now.toLocaleDateString('pt-BR')],
    ['Total de Inspeções no Período', String(inspections.length)],
    ['Emitido por', 'FireCheck — Sistema de Inspeção'],
  ], 2);

  drawSectionHeader(ctx, 2, 'Resumo Quantitativo');
  drawStatCards(ctx, [
    { label: 'Total de Equipamentos', value: String(stats.total), color: PDF_COLORS.text, bg: PDF_COLORS.bgLight },
    { label: 'Em Dia', value: String(stats.emDia), color: PDF_COLORS.success, bg: PDF_COLORS.successLight },
    { label: 'Pendentes', value: String(stats.pendentes), color: PDF_COLORS.warning, bg: PDF_COLORS.warningLight },
    { label: 'Vencidos', value: String(stats.vencidos), color: PDF_COLORS.critical, bg: PDF_COLORS.criticalLight },
  ]);

  ensureSpace(ctx, 8);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(7);
  ctx.doc.setTextColor(...PDF_COLORS.textMuted);
  ctx.doc.text('ÍNDICE DE CONFORMIDADE DO PERÍODO', PDF_MARGIN, ctx.y);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(9);
  ctx.doc.setTextColor(...PDF_COLORS.text);
  ctx.doc.text(`${stats.conformidade}%`, PDF_PAGE.w - PDF_MARGIN, ctx.y, { align: 'right' });
  ctx.y += 3;
  const barW = PDF_CONTENT_W;
  const barH = 3.5;
  ctx.doc.setFillColor(...PDF_COLORS.bgAlt);
  ctx.doc.roundedRect(PDF_MARGIN, ctx.y, barW, barH, 0.5, 0.5, 'F');
  const barColor = stats.conformidade >= 80 ? PDF_COLORS.success : stats.conformidade >= 50 ? PDF_COLORS.warning : PDF_COLORS.critical;
  ctx.doc.setFillColor(...barColor);
  ctx.doc.roundedRect(PDF_MARGIN, ctx.y, (barW * stats.conformidade) / 100, barH, 0.5, 0.5, 'F');
  ctx.y += barH + 4;

  drawSectionHeader(ctx, 3, 'Equipamentos Avaliados');
  drawTable(
    ctx,
    ['Status', 'Quantidade', '% do Total', 'Tendência'],
    [
      [{ text: 'Em Dia', color: PDF_COLORS.success, bold: true }, String(stats.emDia), `${stats.total ? Math.round((stats.emDia / stats.total) * 100) : 0}%`, { text: 'Estável', color: PDF_COLORS.textMuted }],
      [{ text: 'Pendentes', color: PDF_COLORS.warning, bold: true }, String(stats.pendentes), `${stats.total ? Math.round((stats.pendentes / stats.total) * 100) : 0}%`, { text: 'Atenção', color: PDF_COLORS.warning }],
      [{ text: 'Vencidos', color: PDF_COLORS.critical, bold: true }, String(stats.vencidos), `${stats.total ? Math.round((stats.vencidos / stats.total) * 100) : 0}%`, { text: 'Crítico', color: PDF_COLORS.critical }],
      [{ text: 'TOTAL', color: PDF_COLORS.text, bold: true }, String(stats.total), '100%', '—'],
    ],
    [50, 40, 40, 50],
    { aligns: ['left', 'center', 'center', 'center'] },
  );

  const setorMap = new Map<string, { total: number; reprovados: number }>();
  for (const eq of equipments) {
    const s = eq.setor || 'Sem setor';
    if (!setorMap.has(s)) setorMap.set(s, { total: 0, reprovados: 0 });
    const entry = setorMap.get(s)!;
    entry.total++;
    if (eq.status === 'vencido' || eq.status === 'pendente') entry.reprovados++;
  }

  drawSectionHeader(ctx, 4, 'Não Conformidades por Setor');
  if (setorMap.size === 0) {
    drawEmptyState(ctx, 'Nenhum equipamento cadastrado para análise por setor.');
  } else {
    const setoresRows = Array.from(setorMap.entries()).map(([setor, { total, reprovados }]) => {
      const idx = total ? Math.round(((total - reprovados) / total) * 100) : 0;
      const pctRepro = total ? Math.round((reprovados / total) * 100) : 0;
      const statusLabel = pctRepro >= 30 ? 'CRÍTICO' : pctRepro > 0 ? 'ATENÇÃO' : 'OK';
      const statusColor = statusLabel === 'CRÍTICO' ? PDF_COLORS.critical : statusLabel === 'ATENÇÃO' ? PDF_COLORS.warning : PDF_COLORS.success;
      return [setor, String(total), { text: String(reprovados), color: reprovados > 0 ? PDF_COLORS.critical : PDF_COLORS.text, bold: reprovados > 0 }, `${idx}%`, { text: statusLabel, color: statusColor, bold: true }];
    });
    drawTable(
      ctx,
      ['Setor', 'Equipamentos', 'Reprovados', 'Índice', 'Status'],
      setoresRows,
      [50, 35, 30, 25, 40],
      { aligns: ['left', 'center', 'center', 'center', 'center'] },
    );
  }

  drawSectionHeader(ctx, 5, 'Plano de Ação');
  const pends = inspections.filter(i => i.status === 'vencido' || i.status === 'pendente');
  if (pends.length === 0) {
    drawEmptyState(ctx, 'Nenhuma pendência aberta vinculada a plano de ação neste período.');
  } else {
    drawTable(
      ctx,
      ['Equipamento', 'Data', 'Inspetor', 'Status'],
      pends.slice(0, 8).map(p => [
        p.equipmentId,
        p.data,
        p.inspetor,
        {
          text: p.status.toUpperCase(),
          color: p.status === 'vencido' ? PDF_COLORS.critical : PDF_COLORS.warning,
          bold: true,
        },
      ]),
      [50, 35, 50, 45],
      { aligns: ['left', 'center', 'left', 'center'] },
    );
  }

  drawSectionHeader(ctx, 6, 'Evidências Fotográficas');
  drawEmptyState(ctx, 'Nenhuma evidência fotográfica agregada no relatório mensal.');

  drawSectionHeader(ctx, 7, 'Conclusão');
  ensureSpace(ctx, 36);

  const conclH = 28;
  const confColor = stats.conformidade >= 80 ? PDF_COLORS.success : stats.conformidade >= 50 ? PDF_COLORS.warning : PDF_COLORS.critical;
  const confBg = stats.conformidade >= 80 ? PDF_COLORS.successLight : stats.conformidade >= 50 ? PDF_COLORS.warningLight : PDF_COLORS.criticalLight;
  ctx.doc.setFillColor(...confBg);
  ctx.doc.setDrawColor(...confColor);
  ctx.doc.setLineWidth(0.4);
  ctx.doc.roundedRect(PDF_MARGIN, ctx.y, PDF_CONTENT_W, conclH, 2, 2, 'FD');
  ctx.doc.setFillColor(...confColor);
  ctx.doc.rect(PDF_MARGIN, ctx.y, 1.5, conclH, 'F');
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(7);
  ctx.doc.setTextColor(...PDF_COLORS.textMuted);
  ctx.doc.text('PARECER EXECUTIVO', PDF_MARGIN + 5, ctx.y + 6);

  drawStatusPill(ctx, PDF_MARGIN + 5, ctx.y + 15, `${stats.conformidade}% CONFORMIDADE`, confColor, PDF_COLORS.white);

  const summary = stats.conformidade >= 80
    ? 'O parque de equipamentos apresenta conformidade adequada. Manter rotinas de inspeção preventiva.'
    : stats.conformidade >= 50
      ? 'Há pontos de atenção que exigem acompanhamento. Priorizar tratamento de equipamentos vencidos.'
      : 'Conformidade abaixo do mínimo aceitável. Recomenda-se ação corretiva imediata e auditoria de campo.';
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(9);
  ctx.doc.setTextColor(...PDF_COLORS.text);
  const wrapped = ctx.doc.splitTextToSize(summary, PDF_CONTENT_W - 90);
  ctx.doc.text(wrapped, PDF_MARGIN + 55, ctx.y + 14);
  ctx.y += conclH + 6;

  ensureSpace(ctx, 24);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(...PDF_COLORS.text);
  ctx.doc.text('RECOMENDAÇÕES', PDF_MARGIN, ctx.y);
  ctx.y += 4;
  const recs = [
    `Tratar ${stats.vencidos} equipamento(s) vencido(s) em até 7 dias.`,
    `Renovar ${stats.pendentes} item(ns) pendente(s) no próximo ciclo.`,
    'Revisar cronograma de manutenção preventiva para o próximo mês.',
  ];
  recs.forEach(r => {
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(8.5);
    ctx.doc.setTextColor(...PDF_COLORS.textMuted);
    ctx.doc.text('•', PDF_MARGIN + 1, ctx.y);
    const wrapped = ctx.doc.splitTextToSize(r, PDF_CONTENT_W - 6);
    ctx.doc.text(wrapped, PDF_MARGIN + 5, ctx.y);
    ctx.y += wrapped.length * 4 + 1;
  });

  drawFooter(ctx);
  doc.save(`relatorio_mensal_${now.getMonth() + 1}_${now.getFullYear()}.pdf`);
}

export default function Relatorios() {
  const { inspections, stats, equipments, config, user, deleteInspection } = useAppStore();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<HistoryStatus | 'Todos'>('Todos');
  const [visibleCount, setVisibleCount] = useState(4);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const history = useMemo(() => {
    return inspections.map(i => ({
      id: i.id,
      data: isoToBr(i.data),
      dataISO: i.data,
      inspetor: i.inspetor,
      equipId: i.equipmentId,
      status: STATUS_MAP[i.status] ?? 'PENDENTE' as HistoryStatus,
      observacoes: i.observacoes,
    }));
  }, [inspections]);

  const filtered = useMemo(() => {
    return history.filter(h => {
      const term = search.toLowerCase();
      const matchSearch = !term ||
        h.inspetor.toLowerCase().includes(term) ||
        h.equipId.toLowerCase().includes(term) ||
        (h.observacoes && h.observacoes.toLowerCase().includes(term));
      const matchDate = !dateFilter || h.dataISO === dateFilter;
      const matchStatus = statusFilter === 'Todos' || h.status === statusFilter;
      return matchSearch && matchDate && matchStatus;
    });
  }, [history, search, dateFilter, statusFilter]);

  const visible = filtered.slice(0, visibleCount);

  const totalInspecoes = inspections.length;
  const conformesCount = equipments.filter(e => e.status === 'regular' || e.status === 'observacao').length;
  const pendentesCriticos = equipments.filter(e => e.status === 'vencido').length;
  const conformidadePct = equipments.length > 0
    ? Math.round((conformesCount / equipments.length) * 100)
    : 0;

  const clearFilters = () => {
    setSearch('');
    setDateFilter('');
    setStatusFilter('Todos');
  };

  const hasActiveFilters = !!search || !!dateFilter || statusFilter !== 'Todos';

  const handleDeleteInspection = () => {
    if (!deleteTarget) return;
    deleteInspection(deleteTarget);
    showToast({ kind: 'success', title: 'Relatório excluído.' });
  };

  const handleIndividualPDF = (h: HistoryEntry) => {
    const eq = equipments.find(e => e.id === h.equipId);
    generateIndividualPDF(h, config.empresa, config.unidade, eq);
  };

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
          onClick={() => generateMonthlyPDF(stats, inspections, equipments, config.empresa, config.unidade)}
          className="btn-primary btn-sm btn-auto"
          type="button"
        >
          <FileText className="w-4 h-4" />
          <span className="hidden sm:inline">Relatório</span> Mensal
        </button>
      </header>

      {/* 3 Indicator Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="card-subtle bg-white flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] sm:text-xs font-bold uppercase text-gray-400 tracking-wider">Inspeções Totais</div>
            <div className="text-xl sm:text-2xl font-black text-gray-900">{totalInspecoes}</div>
          </div>
          {totalInspecoes > 0 && (
            <div className="text-[10px] font-black text-gray-500 bg-gray-100 px-2 py-1 rounded-full flex-shrink-0">
              {totalInspecoes}
            </div>
          )}
        </div>

        <div className="card-subtle bg-white flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] sm:text-xs font-bold uppercase text-gray-400 tracking-wider">Equipamentos Conformes</div>
            <div className="text-xl sm:text-2xl font-black text-success">{conformesCount}</div>
          </div>
          <div className="text-[10px] font-black text-gray-500 bg-gray-100 px-2 py-1 rounded-full flex-shrink-0">{conformidadePct}%</div>
        </div>

        <div className="card-subtle bg-white flex items-center gap-3 sm:gap-4 sm:col-span-2 lg:col-span-1">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertOctagon className="w-5 h-5 sm:w-6 sm:h-6 text-critical" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] sm:text-xs font-bold uppercase text-gray-400 tracking-wider">Pendências Críticas</div>
            <div className="text-xl sm:text-2xl font-black text-critical">{pendentesCriticos}</div>
            {pendentesCriticos > 0 && (
              <div className="text-[9px] sm:text-[10px] text-critical font-bold uppercase">Requer ação imediata</div>
            )}
          </div>
          <button
            onClick={() => navigate('/planodeacao')}
            className="text-[10px] font-black text-critical border border-red-200 px-2 py-1.5 rounded-lg hover:bg-red-50 uppercase tracking-wider min-h-0 min-w-0 flex-shrink-0"
            type="button"
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
                className="text-[11px] font-bold uppercase tracking-wider text-critical hover:underline min-h-0 min-w-0"
              >
                Limpar
              </button>
            )}
          </div>
          <div>
            <label htmlFor="report-search" className="field-label">Buscar</label>
            <input
              id="report-search"
              type="text"
              placeholder="Serial, inspetor ou observação..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="report-date" className="field-label">Data</label>
            <input
              id="report-date"
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label">Status</label>
            <div className="flex gap-1.5 flex-wrap">
              {(['Todos', 'APROVADO', 'OBSERVAÇÃO', 'REPROVADO', 'PENDENTE'] as const).map(s => {
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
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Nenhum registro encontrado</p>
              <p className="text-xs text-gray-400">Ajuste os filtros para ver mais resultados.</p>
            </div>
          )}

          {visible.map(h => (
            <div key={h.id} className="card-subtle bg-white flex items-center gap-3">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-gray-900">{h.equipId}</span>
                  <span className={`pill ${HISTORY_STATUS_BADGE[h.status]}`}>{h.status}</span>
                </div>
                <div className="text-xs text-gray-500 font-semibold">{h.data} · {h.inspetor}</div>
              </div>
              <button
                onClick={() => handleIndividualPDF(h)}
                className="w-10 h-10 flex items-center justify-center bg-gray-50 border border-gray-100 hover:bg-red-50 hover:border-primary rounded-lg transition-all min-h-0 min-w-0"
                title="Gerar PDF"
                aria-label="Gerar PDF do relatório"
                type="button"
              >
                <FileText className="w-4 h-4 text-gray-500" />
              </button>
              {canDeleteInspection(user, { userId: undefined }) && (
                <button
                  type="button"
                  onClick={() => setDeleteTarget(h.id)}
                  className="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-critical hover:bg-red-50 rounded-lg min-h-0 min-w-0 transition-colors"
                  aria-label={`Excluir relatório ${h.id}`}
                  title="Excluir relatório"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}

          {visible.length < filtered.length && (
            <button
              onClick={() => setVisibleCount(c => c + 4)}
              className="w-full h-12 border-2 border-dashed border-gray-200 rounded-xl font-bold text-xs uppercase tracking-wider text-gray-400 hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2 min-h-0"
              type="button"
            >
              <ChevronDown className="w-4 h-4" />
              Carregar mais registros
            </button>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteInspection}
        title="Excluir relatório"
        message={`Excluir o relatório ${deleteTarget ?? ''}? Esta ação não pode ser desfeita.`}
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
      />
    </div>
  );
}
