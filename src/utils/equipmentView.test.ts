import { describe, expect, it } from 'vitest';
import type { Equipment, Inspection } from '../types';
import { getEquipmentPresentation, persistEquipmentViewMode, readEquipmentViewMode } from './equipmentView';

function equipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: 'EXT-001',
    tipo: 'Extintor',
    local: 'Entrada',
    setor: 'Administrativo',
    status: 'regular',
    ...overrides,
  };
}

function inspection(overrides: Partial<Inspection> = {}): Inspection {
  return {
    id: 'INSP-001',
    equipmentId: 'EXT-001',
    data: '2026-10-01',
    inspetor: 'Teste',
    status: 'regular',
    createdAt: '2026-10-01T10:00:00Z',
    ...overrides,
  };
}

describe('equipment presentation', () => {
  it('uses the latest inspection and keeps technical result separate from deadline', () => {
    const result = getEquipmentPresentation(
      equipment({ dataProximaInspecao: '2026-10-07' }),
      [
        inspection({ id: 'old', data: '2026-09-01', status: 'vencido' }),
        inspection({ id: 'latest', data: '2026-10-01', status: 'regular' }),
      ],
      '2026-10-05',
    );
    expect(result.latestInspection?.id).toBe('latest');
    expect(result.technicalResult).toBe('regular');
    expect(result.deadlineResult).toBe('proximo');
  });

  it('maps legacy vencido to nonconforming without making the deadline overdue', () => {
    const result = getEquipmentPresentation(
      equipment({ dataProximaInspecao: '2026-10-09' }),
      [inspection({ status: 'vencido' })],
      '2026-10-05',
    );
    expect(result.technicalResult).toBe('nao_conforme');
    expect(result.deadlineResult).toBe('em_prazo');
  });

  it('formats temporal boundaries and empty technical data independently', () => {
    expect(getEquipmentPresentation(equipment({ dataProximaInspecao: '2026-10-04' }), [], '2026-10-05').deadlineResult).toBe('vencido');
    expect(getEquipmentPresentation(equipment({ dataProximaInspecao: '2026-10-08' }), [], '2026-10-05').deadlineResult).toBe('proximo');
    expect(getEquipmentPresentation(equipment({ dataProximaInspecao: '2026-10-09' }), [], '2026-10-05').deadlineResult).toBe('em_prazo');
    expect(getEquipmentPresentation(equipment(), [], '2026-10-05').technicalResult).toBe('sem_inspecao');
    expect(getEquipmentPresentation(equipment(), [], '2026-10-05').deadlineResult).toBe('sem_prazo');
  });

  it('defaults invalid preferences to cards and persists valid modes', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    expect(readEquipmentViewMode(storage)).toBe('cards');
    values.set('efetivafire-equipment-view-mode', 'invalid');
    expect(readEquipmentViewMode(storage)).toBe('cards');
    persistEquipmentViewMode(storage, 'list');
    expect(readEquipmentViewMode(storage)).toBe('list');
  });
});
