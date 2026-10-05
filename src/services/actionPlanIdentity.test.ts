import { describe, expect, it } from 'vitest';
import { buildCanonicalActionPlanId, shouldCreateLegacyInspectionPlan } from './actionPlanIdentity';

describe('canonical action plan identity', () => {
  it('is deterministic for the same inspection and deviation', () => {
    expect(buildCanonicalActionPlanId('INSP-1', 'extintor.lacre-integro'))
      .toBe('PAC-INSP-1-extintor.lacre-integro');
    expect(buildCanonicalActionPlanId('INSP-1', 'extintor.lacre-integro'))
      .toBe(buildCanonicalActionPlanId('INSP-1', 'extintor.lacre-integro'));
  });

  it('distinguishes structured empty deviations from legacy undefined input', () => {
    expect(shouldCreateLegacyInspectionPlan(undefined, 'vencido')).toBe(true);
    expect(shouldCreateLegacyInspectionPlan([], 'vencido')).toBe(false);
    expect(shouldCreateLegacyInspectionPlan([{ item: 'x', severity: 'warning', description: 'desc' }], 'vencido')).toBe(false);
  });
});
