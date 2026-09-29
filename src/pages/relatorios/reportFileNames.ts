export function individualReportFilename(equipmentId: string, reportId: string): string {
  return `efetivafire-relatorio_${equipmentId}_${reportId}.pdf`;
}

export function monthlyReportFilename(month: number, year: number): string {
  return `efetivafire-relatorio-mensal_${month}_${year}.pdf`;
}
