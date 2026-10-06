import type { Location } from 'react-router-dom';

export type ReturnLocation = Pick<Location, 'pathname' | 'search' | 'hash'>;

export function getSafeReturnLocation(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<ReturnLocation>;
  if (typeof candidate.pathname !== 'string' || !candidate.pathname.startsWith('/') || candidate.pathname.startsWith('//')) return null;
  if (candidate.pathname === '/login' || candidate.pathname === '/recuperar-senha' || candidate.pathname === '/redefinir-senha') return null;
  const search = typeof candidate.search === 'string' ? candidate.search : '';
  const hash = typeof candidate.hash === 'string' ? candidate.hash : '';
  return `${candidate.pathname}${search}${hash}`;
}
