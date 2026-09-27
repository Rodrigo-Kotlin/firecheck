// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ControlCenterFilters from './ControlCenterFilters';

const options = {
  setor: ['Estacionamento', 'Administrativo'],
  local: ['Área externa'],
  tipo: ['Extintor'],
};

describe('ControlCenterFilters', () => {
  afterEach(() => cleanup());

  it('updates a selected filter through an accessible select', () => {
    const onChange = vi.fn();
    render(
      <ControlCenterFilters
        options={options}
        value={{ setor: '', local: '', tipo: '' }}
        active={false}
        onChange={onChange}
        onClear={vi.fn()}
      />,
    );

    const setor = screen.getByLabelText('Setor');
    fireEvent.change(setor, { target: { value: 'Estacionamento' } });
    expect(onChange).toHaveBeenCalledWith('setor', 'Estacionamento');
    expect(screen.getByText('Selecione setor, localização e tipo para atualizar a central.')).toBeTruthy();
  });

  it('renders active context, clear action and keyboard-focusable controls', () => {
    const onClear = vi.fn();
    render(
      <ControlCenterFilters
        options={options}
        value={{ setor: 'Estacionamento', local: '', tipo: 'Extintor' }}
        active
        onChange={vi.fn()}
        onClear={onClear}
      />,
    );

    expect(screen.getByText('Visão filtrada')).toBeTruthy();
    expect(screen.getByText('Exibindo Estacionamento · todos os locais · Extintor')).toBeTruthy();
    const clear = screen.getByRole('button', { name: /Limpar filtros/i });
    fireEvent.click(clear);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(clear.tabIndex).toBe(0);
    expect(screen.getByLabelText('Localização')).toBeTruthy();
  });
});
