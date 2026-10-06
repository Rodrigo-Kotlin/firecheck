export type RuntimeMode = 'operational' | 'simulator';

let runtimeMode: RuntimeMode = 'operational';

export function getRuntimeMode(): RuntimeMode {
  return runtimeMode;
}

export function setRuntimeMode(mode: RuntimeMode): void {
  runtimeMode = mode;
}
