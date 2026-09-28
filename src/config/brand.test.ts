import { describe, expect, it } from 'vitest';
import { APP_COMPANY, APP_DESCRIPTION, APP_NAME, APP_PRODUCT_SLUG, APP_SHORT_NAME } from './brand';
import { getEquipmentQrPayload } from '../utils/equipmentIdentity';

describe('EfetivaFire branding', () => {
  it('exposes the canonical product identity', () => {
    expect(APP_NAME).toBe('EfetivaFire');
    expect(APP_SHORT_NAME).toBe('EfetivaFire');
    expect(APP_DESCRIPTION).toContain('equipamentos de combate a incêndio');
    expect(APP_COMPANY).toBe('Efetiva SST');
    expect(APP_PRODUCT_SLUG).toBe('efetivafire');
  });

  it('does not change the equipment QR payload contract', () => {
    expect(getEquipmentQrPayload({ id: 'EXT-001' })).toBe('EXT-001');
  });
});
