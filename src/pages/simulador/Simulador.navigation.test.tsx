// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Simulador from './Simulador';
import { useSimulatorStore } from '../../simulator/simulatorStore';

function renderSimulator() {
  return render(<MemoryRouter><Simulador /></MemoryRouter>);
}

describe('simulator navigation', () => {
  beforeEach(() => useSimulatorStore.getState().reset());
  afterEach(() => cleanup());

  it('shows a visible exit control on the mode selection screen', () => {
    renderSimulator();
    expect(screen.getByRole('button', { name: /sair do simulador/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /escolha como praticar/i })).toBeTruthy();
  });

  it('returns from the free catalog to mode selection', () => {
    renderSimulator();
    fireEvent.click(screen.getAllByRole('button', { name: /abrir cenários/i })[0]);
    expect(screen.getByText(/catálogo de cenários/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /voltar para escolha do modo/i }));
    expect(screen.getByRole('heading', { name: /escolha como praticar/i })).toBeTruthy();
  });

  it('returns the first free scenario to its catalog without losing the global exit', () => {
    renderSimulator();
    fireEvent.click(screen.getAllByRole('button', { name: /abrir cenários/i })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /iniciar treinamento/i })[0]);
    expect(screen.getByRole('button', { name: /^voltar$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /sair do simulador/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^voltar$/i }));
    expect(screen.getByText(/catálogo de cenários/i)).toBeTruthy();
  });

  it('returns the first guided scenario to guided progress', () => {
    renderSimulator();
    fireEvent.change(screen.getAllByLabelText(/nome do participante/i)[0], { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: /iniciar trilha/i }));
    fireEvent.click(screen.getByRole('button', { name: /continuar trilha/i }));
    expect(screen.getByRole('button', { name: /^voltar$/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^voltar$/i }));
    expect(screen.getByText(/trilha guiada/i)).toBeTruthy();
  });

  it('asks for confirmation before discarding an active session on exit', () => {
    renderSimulator();
    fireEvent.click(screen.getAllByRole('button', { name: /abrir cenários/i })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /iniciar treinamento/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /sair do simulador/i }));
    expect(screen.getByRole('heading', { name: /sair do simulador/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(useSimulatorStore.getState().activeSession).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /sair do simulador/i }));
    fireEvent.click(screen.getByRole('button', { name: /sair e descartar/i }));
    expect(useSimulatorStore.getState().activeSession).toBeNull();
    expect(useSimulatorStore.getState().training).toBeNull();
  });
});
