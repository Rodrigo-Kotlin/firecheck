import { useEffect } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { showToast } from './useToasts';

export function usePwaUpdate(): void {
  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        showToast({
          kind: 'info',
          title: 'Nova versão disponível',
          description: 'Atualize agora para obter as últimas melhorias.',
          action: {
            label: 'Atualizar',
            onClick: () => updateSW(true),
          },
          duration: 0,
        });
      },
      onOfflineReady() {
        showToast({
          kind: 'success',
          title: 'App pronto para uso offline',
          description: 'Todos os recursos essenciais estão disponíveis sem conexão.',
          duration: 4000,
        });
      },
    });
  }, []);

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
