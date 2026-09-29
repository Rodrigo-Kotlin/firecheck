import { describe, expect, it, vi } from 'vitest';
import { generateEquipmentQr } from './equipmentQr';

const { toDataURL } = vi.hoisted(() => ({
  toDataURL: vi.fn(async (value: string) => `data:image/mock;base64,${value}`),
}));

vi.mock('qrcode', () => ({
  default: { toDataURL },
}));

describe('equipment QR payload', () => {
  it('uses equipment.id unchanged as the QR payload', async () => {
    await expect(generateEquipmentQr('EXT-001')).resolves.toBe('data:image/mock;base64,EXT-001');
    expect(toDataURL).toHaveBeenCalledWith('EXT-001', {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 512,
      color: { dark: '#111111', light: '#FFFFFF' },
    });
  });
});
