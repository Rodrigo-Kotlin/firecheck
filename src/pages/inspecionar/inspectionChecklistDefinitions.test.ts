import { describe, expect, it } from 'vitest';
import {
  CHECKLIST_ALARME,
  CHECKLIST_EXTINTOR,
  CHECKLIST_HIDRANTE,
  CHECKLIST_ILUMINACAO,
} from './inspectionChecklistDefinitions';

describe('inspection checklist definitions', () => {
  it('has a non-empty globally unique technical key for every item', () => {
    const definitions = [
      ...CHECKLIST_EXTINTOR,
      ...CHECKLIST_HIDRANTE,
      ...CHECKLIST_ALARME,
      ...CHECKLIST_ILUMINACAO,
    ];
    const keys = definitions.map((definition) => definition.key);

    expect(definitions).not.toHaveLength(0);
    expect(keys.every((key) => key.trim().length > 0)).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps technical identity independent from display labels', () => {
    expect(CHECKLIST_EXTINTOR[0]).toEqual({ key: 'extintor.acesso-livre', label: 'Acesso livre e desobstruído' });
  });
});
