import { getRuntimeMode } from './runtimeMode';

export function assertOperationalWriteAllowed(operation: string): void {
  if (getRuntimeMode() === 'simulator') {
    throw new Error(`Operação operacional bloqueada no modo simulador: ${operation}`);
  }
}
