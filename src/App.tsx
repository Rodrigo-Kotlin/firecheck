import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/login/Login';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/dashboard/Dashboard';
import Equipamentos from './pages/equipamentos/Equipamentos';
import NovoEquipamento from './pages/equipamentos/NovoEquipamento';
import DetalhesEquipamento from './pages/equipamentos/DetalhesEquipamento';
import Inspecionar from './pages/inspecionar/Inspecionar';
import ScanQr from './pages/scan/ScanQr';
import Relatorios from './pages/relatorios/Relatorios';
import PlanoDeAcao from './pages/planodeacao/PlanoDeAcao';
import Configuracoes from './pages/configuracoes/Configuracoes';
import { useAppStore } from './store';

export default function App() {
  const hydrate = useAppStore((s) => s.hydrate);

  useEffect(() => {
    // Carrega equipamentos/inspeções do Dexie (seed automático a partir
    // dos mocks na primeira execução) e dispara a sincronização inicial.
    void hydrate();
  }, [hydrate]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Main layout with bottom nav (protected inside layout) */}
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="equipamentos" element={<Equipamentos />} />
          <Route path="equipamentos/novo" element={<NovoEquipamento />} />
          <Route path="equipamentos/:id" element={<DetalhesEquipamento />} />
          <Route path="inspecionar" element={<Inspecionar />} />
          <Route path="scan" element={<ScanQr />} />
          <Route path="relatorios" element={<Relatorios />} />
          <Route path="planodeacao" element={<PlanoDeAcao />} />
          <Route path="configuracoes" element={<Configuracoes />} />
        </Route>

        {/* Fallback redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
