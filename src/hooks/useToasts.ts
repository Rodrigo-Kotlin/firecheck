import type { ComponentType, SVGProps } from 'react';
import { useSyncExternalStore } from 'react';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export type ToastIcon = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
  action?: ToastAction;
  /** Auto-dismiss after this many ms. 0 = sticky. Default: 5000. */
  duration?: number;
  /** Optional override for the icon shown in the toast. Falls back to the
   *  kind default in the Toaster component. */
  icon?: ToastIcon;
}

type Listener = () => void;

let toasts: Toast[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface ShowToastInput {
  kind: ToastKind;
  title: string;
  description?: string;
  action?: ToastAction;
  duration?: number;
  icon?: ToastIcon;
}

export function showToast(input: ShowToastInput): string {
  const toast: Toast = { id: genId(), duration: 5000, ...input };
  toasts = [...toasts, toast];
  emit();
  if (toast.duration && toast.duration > 0) {
    setTimeout(() => dismissToast(toast.id), toast.duration);
  }
  return toast.id;
}

export function dismissToast(id: string): void {
  const next = toasts.filter((t) => t.id !== id);
  if (next.length !== toasts.length) {
    toasts = next;
    emit();
  }
}

export function clearToasts(): void {
  if (toasts.length === 0) return;
  toasts = [];
  emit();
}

function subscribe(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): Toast[] {
  return toasts;
}

function getServerSnapshot(): Toast[] {
  return [];
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
