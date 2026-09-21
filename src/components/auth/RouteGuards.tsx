import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store';
import { isAdmin } from '../../services/permissions';

function GuardLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutralBg">
      <div className="w-10 h-10 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const authReady = useAppStore((state) => state.authReady);
  const user = useAppStore((state) => state.user);
  const location = useLocation();

  if (!authReady) return <GuardLoading />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const authReady = useAppStore((state) => state.authReady);
  const user = useAppStore((state) => state.user);

  if (!authReady) return <GuardLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin(user)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
