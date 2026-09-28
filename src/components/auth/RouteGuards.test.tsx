// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminRoute } from './RouteGuards';

let currentUser: { id: string; nome: string; cargo: string; role: 'admin' | 'inspector' } | null = null;

vi.mock('../../store', () => ({
  useAppStore: (selector: (state: { authReady: boolean; user: typeof currentUser }) => unknown) =>
    selector({ authReady: true, user: currentUser }),
}));

describe('AdminRoute', () => {
  it('bloqueia inspector e redireciona para o início', () => {
    currentUser = { id: 'i-1', nome: 'Inspetor', cargo: 'Técnico', role: 'inspector' };
    render(
      <MemoryRouter initialEntries={['/admin/usuarios']}>
        <Routes>
          <Route path="/admin/usuarios" element={<AdminRoute><span>segredo administrativo</span></AdminRoute>} />
          <Route path="/" element={<span>início</span>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('início')).toBeTruthy();
    expect(screen.queryByText('segredo administrativo')).toBeNull();
  });

  it('permite admin acessar o conteúdo administrativo', () => {
    currentUser = { id: 'a-1', nome: 'Admin', cargo: 'Gestor', role: 'admin' };
    render(
      <MemoryRouter initialEntries={['/admin/usuarios']}>
        <Routes>
          <Route path="/admin/usuarios" element={<AdminRoute><span>segredo administrativo</span></AdminRoute>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('segredo administrativo')).toBeTruthy();
  });
});
