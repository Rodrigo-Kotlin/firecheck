import { afterEach, describe, expect, it } from 'vitest';
import { getRuntimeMode, setRuntimeMode } from './runtimeMode';
import { assertOperationalWriteAllowed } from './writeFence';

afterEach(() => setRuntimeMode('operational'));

describe('operational write fence', () => {
  it('blocks operational writes in simulator mode', () => {
    setRuntimeMode('simulator');
    expect(() => assertOperationalWriteAllowed('db.put')).toThrow(/modo simulador/);
  });

  it('allows operational writes outside simulator mode', () => {
    expect(getRuntimeMode()).toBe('operational');
    expect(() => assertOperationalWriteAllowed('db.put')).not.toThrow();
  });
});
