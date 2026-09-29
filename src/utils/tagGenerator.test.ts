import { describe, expect, it } from 'vitest';
import { generateNextTag, isValidTagForType, normalizeTag } from './tagGenerator';

describe('equipment TAG behavior', () => {
  it('generates the next automatic TAG without changing the canonical format', () => {
    expect(generateNextTag('Extintor', ['EXT-001', 'EXT-003', 'HID-001'])).toBe('EXT-002');
  });

  it('normalizes manual TAG input and validates it against the equipment type', () => {
    const manualTag = normalizeTag(' ext 042 ');
    expect(manualTag).toBe('EXT-042');
    expect(isValidTagForType(manualTag, 'Extintor')).toBe(true);
    expect(isValidTagForType('HID-042', 'Extintor')).toBe(false);
  });
});
