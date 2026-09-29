import QRCode from 'qrcode';

export function generateEquipmentQr(value: string) {
  return QRCode.toDataURL(value, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 512,
    color: { dark: '#111111', light: '#FFFFFF' },
  });
}
