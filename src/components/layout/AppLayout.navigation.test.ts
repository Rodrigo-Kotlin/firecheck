import { describe, expect, it } from 'vitest';
import { getAppTitle } from '../../utils/appTitle';

describe('persistent app titles', () => {
  it('recognizes reports and child routes', () => {
    expect(getAppTitle('/relatorios')).toBe('Relatórios');
    expect(getAppTitle('/relatorios/abc')).toBe('Relatórios');
  });

  it('keeps section titles for child routes', () => {
    expect(getAppTitle('/equipamentos/EQ-1')).toBe('Equipamentos');
    expect(getAppTitle('/planodeacao/PAC-1')).toBe('Plano de Ação');
  });
});
