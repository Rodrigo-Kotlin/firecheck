export const TAG_PREFIXES: Record<string, string> = {
  'Extintor': 'EXT',
  'Hidrante': 'HID',
  'Mangueira': 'MNG',
  'Abrigo de mangueira': 'ABR',
  'Esguicho': 'ESG',
  'Chave storz': 'STZ',
  'Acionador manual': 'ACN',
  'Alarme': 'ALM',
  'Central de alarme': 'CEN',
  'Iluminação de emergência': 'ILM',
  'Sinalização': 'SIN',
  'Sprinkler': 'SPK',
  'Bomba': 'BOM',
  'Porta corta-fogo': 'PCF',
  'Detector de fumaça': 'DFM',
  'Detector de calor': 'DCL',
  'Outro': 'OUT',
};

export function generateNextTag(tipo: string, existingIds: string[]): string {
  const prefix = TAG_PREFIXES[tipo];
  if (!prefix) return '';

  const pattern = new RegExp(`^${prefix}-(\\d+)$`, 'i');
  const usedNumbers = new Set<number>();

  for (const id of existingIds) {
    const match = id.match(pattern);
    if (match) {
      usedNumbers.add(parseInt(match[1], 10));
    }
  }

  let next = 1;
  while (usedNumbers.has(next)) {
    next++;
  }

  return `${prefix}-${String(next).padStart(3, '0')}`;
}

export function isValidTagForType(tag: string, tipo: string): boolean {
  const prefix = TAG_PREFIXES[tipo];
  if (!prefix) return true;
  const pattern = new RegExp(`^${prefix}-\\d{3,}$`, 'i');
  return pattern.test(tag);
}

/**
 * Normaliza uma TAG: trim, uppercase, espaços internos viram hífen.
 * Exemplo: ' ext-001 ' → 'EXT-001', 'Ext 001' → 'EXT-001'
 */
export function normalizeTag(tag: string): string {
  return tag
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/ /g, '-');
}
