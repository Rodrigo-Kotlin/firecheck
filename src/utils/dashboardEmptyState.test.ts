import { describe, expect, it } from 'vitest';
import { getPriorityEmptyStateCopy } from './dashboardEmptyState';

describe('dashboard priority empty state', () => {
  it('uses global copy without filters', () => {
    expect(getPriorityEmptyStateCopy(false).title).toBe('Nenhuma prioridade identificada');
  });

  it('makes filtered scope explicit', () => {
    expect(getPriorityEmptyStateCopy(true).title).toContain('filtros atuais');
  });
});
