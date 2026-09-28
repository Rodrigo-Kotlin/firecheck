// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SyncStatusBadge } from './SyncStatusBadge';
import { SyncNowButton } from './SyncNowButton';

const common = {
  isOnline: true,
  syncing: false,
  pending: 2,
  onClick: vi.fn(),
};

describe('status visual de sincronização', () => {
  afterEach(cleanup);

  it('mostra pausa manual distinta de offline', () => {
    render(<SyncStatusBadge {...common} syncPaused />);
    expect(screen.getByRole('button', { name: 'Sincronização pausada' })).toBeTruthy();
  });

  it('mantém offline como estado distinto quando não há conexão', () => {
    render(<SyncStatusBadge {...common} isOnline={false} syncPaused={false} />);
    expect(screen.getByRole('button', { name: 'Offline' })).toBeTruthy();
  });

  it('bloqueia sync manual enquanto a pausa está ativa', () => {
    render(<SyncNowButton {...common} syncPaused />);
    expect((document.querySelector('.sync-now') as HTMLButtonElement).disabled).toBe(true);
  });
});
