// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InspectionChecklist } from './InspectionChecklist';

describe('InspectionChecklist', () => {
  afterEach(() => cleanup());

  it('renders the checklist and reports the selected value', () => {
    const onChange = vi.fn();

    render(
      <InspectionChecklist
        items={['Acesso livre']}
        values={{ 'Acesso livre': 'OK' }}
        progress={{ total: 1, answered: 1, remaining: 0, percentage: 100, counts: { OK: 1, ATENCAO: 0, REPROVADO: 0, 'N.A.': 0 } }}
        onChange={onChange}
      />,
    );

    expect(screen.getByText('Acesso livre')).toBeTruthy();
    expect(screen.getByText('1 Conforme')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: 'Não conforme' }));
    expect(onChange).toHaveBeenCalledWith('Acesso livre', 'REPROVADO');
  });

  it('shows incomplete progress and counts N.A. as an answer', () => {
    render(
      <InspectionChecklist
        items={['Acesso livre', 'Sinalização']}
        values={{ 'Acesso livre': 'N.A.' }}
        progress={{ total: 2, answered: 1, remaining: 1, percentage: 50, counts: { OK: 0, ATENCAO: 0, REPROVADO: 0, 'N.A.': 1 } }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('1 de 2 avaliados')).toBeTruthy();
    expect(screen.getByText('1 N.A.')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuemax')).toBe('2');
  });
});
