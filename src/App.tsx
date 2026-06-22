import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Cadastro from './pages/login/Cadastro';
import RecuperarSenha from './pages/login/RecuperarSenha';
import RedefinirSenha from './pages/login/RedefinirSenha';
import AppLayout from './components/layout/AppLayout';
import Toaster from './components/Toaster';
import { usePwaUpdate } from './hooks/usePwaUpdate';
import { useAppStore } from './store';

const Login = lazy(() => import('./pages/login/Login'));
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const Equipamentos = lazy(() => import('./pages/equipamentos/Equipamentos'));
const NovoEquipamento = lazy(() => import('./pages/equipamentos/NovoEquipamento'));
const EditarEquipamento = lazy(() => import('./pages/equipamentos/EditarEquipamento'));
const DetalhesEquipamento = lazy(() => import('./pages/equipamentos/DetalhesEquipamento'));
const Inspecionar = lazy(() => import('./pages/inspecionar/Inspecionar'));
const ScanQr = lazy(() => import('./pages/scan/ScanQr'));
const QrCodes = lazy(() => import('./pages/qrcodes/QrCodes'));
const PlanoDeAcao = lazy(() => import('./pages/planodeacao/PlanoDeAcao'));
const Configuracoes = lazy(() => import('./pages/configuracoes/Configuracoes'));
const AdminUsuarios = lazy(() => import('./pages/admin/AdminUsuarios'));
const Relatorios = lazy(() => import('./pages/relatorios/Relatorios'));

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutralBg">
      <div className="w-10 h-10 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function RelatoriosFallback() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="page-header">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">Relatórios</div>
          <h1 className="text-base sm:text-lg lg:text-xl font-black text-gray-900 uppercase tracking-wide">
            Histórico & Análise
          </h1>
        </div>
      </header>
      <div className="card-subtle bg-white flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-10 h-10 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-gray-700">Carregando relatórios...</p>
        <p className="text-xs text-gray-400">Preparando módulo de PDF</p>
      </div>
    </div>
  );
}

export default function App() {
  const hydrate = useAppStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  usePwaUpdate();

  return (
    <Router>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />
          <Route path="/recuperar-senha" element={<RecuperarSenha />} />
          <Route path="/redefinir-senha" element={<RedefinirSenha />} />

          <Route path="/" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="equipamentos" element={<Equipamentos />} />
            <Route path="equipamentos/novo" element={<NovoEquipamento />} />
            <Route path="equipamentos/:id/editar" element={<EditarEquipamento />} />
            <Route path="equipamentos/:id" element={<DetalhesEquipamento />} />
            <Route path="inspecionar" element={<Inspecionar />} />
            <Route path="scan" element={<ScanQr />} />
            <Route
              path="relatorios"
              element={
                <Suspense fallback={<RelatoriosFallback />}>
                  <Relatorios />
                </Suspense>
              }
            />
            <Route path="qrcodes" element={<QrCodes />} />
            <Route path="planodeacao" element={<PlanoDeAcao />} />
            <Route path="configuracoes" element={<Configuracoes />} />
            <Route path="admin/usuarios" element={<AdminUsuarios />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster />
    </Router>
  );
}
