import { APP_NAME } from '../config/brand';

export function getAppTitle(pathname: string): string {
  if (pathname === '/') return 'Dashboard';
  if (pathname === '/qrcodes' || pathname.startsWith('/qrcodes/')) return 'QR Codes';
  if (pathname === '/planodeacao' || pathname.startsWith('/planodeacao/')) return 'Plano de Ação';
  if (pathname === '/admin/usuarios' || pathname.startsWith('/admin/usuarios/')) return 'Usuários';
  if (pathname === '/configuracoes' || pathname.startsWith('/configuracoes/')) return 'Configurações';
  if (pathname === '/simulador') return 'Simulador';
  if (pathname === '/equipamentos' || pathname.startsWith('/equipamentos/')) return 'Equipamentos';
  if (pathname === '/inspecionar') return 'Inspecionar';
  if (pathname === '/scan') return 'Escanear QR';
  if (pathname === '/relatorios' || pathname.startsWith('/relatorios/')) return 'Relatórios';
  if (pathname === '/inspecoes' || pathname.startsWith('/inspecoes/')) return 'Inspeções';
  return APP_NAME;
}
