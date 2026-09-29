// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InspectionChecklist } from './InspectionChecklist';

describe('InspectionChecklist', () => {
  it('renders the checklist and reports the selected value', () => {
    const onChange = vi.fn();

    render(
      <InspectionChecklist
        items={['Acesso livre']}
        values={{ 'Acesso livre': 'OK' }}
        counts={{ OK: 1, ATENCAO: 0, REPROVADO: 0, 'N.A.': 0 }}
        onChange={onChange}
      />,
    );

    expect(screen.getByText('Acesso livre')).toBeTruthy();
    expect(screen.getByText('1 OK')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Falha' }));
    expect(onChange).toHaveBeenCalledWith('Acesso livre', 'REPROVADO');
  });
});
