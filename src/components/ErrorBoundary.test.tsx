// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppErrorBoundary from './ErrorBoundary';

function BrokenView(): never {
  throw new Error('render failure');
}

describe('AppErrorBoundary', () => {
  it('shows a safe fallback instead of a blank screen', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <BrokenView />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: 'Algo deu errado' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Voltar ao início' })).toBeTruthy();
    expect(screen.queryByText('render failure')).toBeNull();
    errorSpy.mockRestore();
  });
});
