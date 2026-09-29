import type { Equipment, Stats } from '../types';

export function inferCriticidade(inspectionObs: string, eqTipo: string): import('../types').Criticidade {
  const obs = inspectionObs.toLowerCase();
  const tipo = eqTipo.toLowerCase();
  if (
    obs.includes('sem carga') || obs.includes('sem lacre') || obs.includes('sem acesso') ||
    obs.includes('sem mangueira') || obs.includes('inoperante') ||
    (tipo.includes('extintor') && obs.includes('vencido'))
  ) return 'Crítico';
  if (obs.includes('sinalização') || obs.includes('mangueira') || obs.includes('abrigo')) return 'Alto';
  if (obs.includes('etiqueta') || obs.includes('sujeira') || obs.includes('avaria')) return 'Médio';
  return 'Baixo';
}

export function recomputeStats(eqs: Equipment[]): Stats {
  const total = eqs.length;
  const emDia = eqs.filter((e) => e.status === 'regular').length;
  const pendentes = eqs.filter((e) => e.status === 'pendente').length;
  const vencidos = eqs.filter((e) => e.status === 'vencido' || e.status === 'extraviado').length;
  const observacao = eqs.filter((e) => e.status === 'observacao' || e.status === 'em_manutencao' || e.status === 'inativo' || e.status === 'substituido').length;
  const conformidade = total === 0 ? 0 : Math.round(((emDia + observacao) / total) * 100);
  return { total, emDia, pendentes, vencidos, conformidade };
}
