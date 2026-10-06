// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ConfirmDialog from './ConfirmDialog';

describe('ConfirmDialog', () => {
  afterEach(() => cleanup());

  it('exposes dialog semantics and moves focus to cancel', () => {
    render(
      <ConfirmDialog open onClose={vi.fn()} onConfirm={vi.fn()} title="Excluir" message="Não pode ser desfeito." />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Excluir' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('Não pode ser desfeito.').id).toBe(dialog.getAttribute('aria-describedby'));
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBe(document.activeElement);
  });

  it('traps both tab directions, closes on escape and restores focus', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const onClose = vi.fn();
    const view = render(
      <ConfirmDialog open onClose={onClose} onConfirm={vi.fn()} title="Sair" message="Descartar alterações?" />,
    );

    const confirm = screen.getByRole('button', { name: 'Excluir' });
    confirm.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fechar' }));
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirm);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();

    view.rerender(<ConfirmDialog open={false} onClose={onClose} onConfirm={vi.fn()} title="Sair" message="Descartar alterações?" />);
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('confirms only through the confirm action', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<ConfirmDialog open onClose={onClose} onConfirm={onConfirm} title="Excluir" message="Confirma?" />);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
