import type { ReactNode } from 'react';
import { ErrorBoundary as ReactErrorBoundary, type FallbackProps } from 'react-error-boundary';

function ErrorFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <main className="min-h-screen bg-neutralBg flex items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl bg-white border border-gray-100 shadow-subtle p-8 text-center">
        <h1 className="text-xl font-black text-gray-900">Algo deu errado</h1>
        <p className="mt-2 text-sm text-gray-500">
          Não foi possível carregar esta tela. Tente novamente ou volte ao início.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <button type="button" onClick={resetErrorBoundary} className="btn-primary">
            Tentar novamente
          </button>
          <button type="button" onClick={() => window.location.assign('/')} className="btn-ghost">
            Voltar ao início
          </button>
        </div>
      </section>
    </main>
  );
}

export default function AppErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={() => {
        if (import.meta.env.DEV) console.error('[ui] erro inesperado ao renderizar a aplicação');
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}
