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
}
