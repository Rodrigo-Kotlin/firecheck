import { describe, expect, it } from 'vitest';
import { clearEquipmentFilterParams, hasEquipmentFilterParams } from './equipmentNavigation';

describe('equipment filter navigation', () => {
  it('clears all equipment filters while preserving unrelated params', () => {
    const result = clearEquipmentFilterParams(new URLSearchParams('q=extintor&view=pending&ccView=attention&setor=A&foo=keep'));
    expect(result.toString()).toBe('foo=keep');
  });

  it('detects query filters without changing view preference storage', () => {
    expect(hasEquipmentFilterParams(new URLSearchParams('tipo=Extintor'))).toBe(true);
    expect(hasEquipmentFilterParams(new URLSearchParams('foo=keep'))).toBe(false);
  });
});
