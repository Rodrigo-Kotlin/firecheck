import { useEffect } from 'react';
import { register } from '../registerSW';
import { showToast } from './useToasts';

export function usePwaUpdate(): void {
  useEffect(() => {
    register((reload) => {
      showToast({
        kind: 'info',
        title: 'Nova versão disponível',
        description: 'Atualize agora para obter as últimas melhorias.',
        action: { label: 'Atualizar', onClick: reload },
        duration: 0,
      });
    });
  }, []);

  // Toast de confirmação quando o usuário instala o PWA. Dispara uma vez
  // graças à natureza do evento `appinstalled`.
  useEffect(() => {
    const onInstalled = () => {
      showToast({
        kind: 'success',
        title: 'App instalado com sucesso',
        description: 'Abra o FireCheck direto da sua tela inicial.',
        duration: 6000,
      });
    };
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);
}
