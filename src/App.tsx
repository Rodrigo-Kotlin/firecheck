import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/login/Login';
import Cadastro from './pages/login/Cadastro';
import RecuperarSenha from './pages/login/RecuperarSenha';
import RedefinirSenha from './pages/login/RedefinirSenha';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/dashboard/Dashboard';
import Equipamentos from './pages/equipamentos/Equipamentos';
import NovoEquipamento from './pages/equipamentos/NovoEquipamento';
import DetalhesEquipamento from './pages/equipamentos/DetalhesEquipamento';
import Inspecionar from './pages/inspecionar/Inspecionar';
import ScanQr from './pages/scan/ScanQr';
import PlanoDeAcao from './pages/planodeacao/PlanoDeAcao';
import Configuracoes from './pages/configuracoes/Configuracoes';
import AdminUsuarios from './pages/admin/AdminUsuarios';
import Toaster from './components/Toaster';
import { usePwaUpdate } from './hooks/usePwaUpdate';
import { useAppStore } from './store';

// Lazy-load da página de relatórios: ela importa jsPDF + html2canvas,
// que são pesos grandes. Só baixamos quando o usuário acessa a rota.
const Relatorios = lazy(() => import('./pages/relatorios/Relatorios'));

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
    // Carrega equipamentos/inspeções do Dexie (seed automático a partir
    // dos mocks na primeira execução) e dispara a sincronização inicial.
    void hydrate();
  }, [hydrate]);

  usePwaUpdate();

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/recuperar-senha" element={<RecuperarSenha />} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />

        {/* Main layout with bottom nav (protected inside layout) */}
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="equipamentos" element={<Equipamentos />} />
          <Route path="equipamentos/novo" element={<NovoEquipamento />} />
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
          <Route path="planodeacao" element={<PlanoDeAcao />} />
          <Route path="configuracoes" element={<Configuracoes />} />
          <Route path="admin/usuarios" element={<AdminUsuarios />} />
        </Route>

        {/* Fallback redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </Router>
  );
}
