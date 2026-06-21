import { normalizeTag } from './tagGenerator';

/**
 * Normaliza uma TAG de equipamento: trim, uppercase, espaços viram hífen.
 * Reusa normalizeTag() do tagGenerator.
 */
export function normalizeEquipmentTag(tag: string): string {
  return normalizeTag(tag);
}

/**
 * Retorna a TAG canônica (identidade oficial) do equipamento.
 * O campo `id` é sempre a TAG oficial.
 */
export function getEquipmentTag(eq: { id: string }): string {
  return eq.id;
}

/**
 * Retorna o payload que deve ser codificado no QR Code.
 * Sempre o `id` (TAG oficial) do equipamento.
 */
export function getEquipmentQrPayload(eq: { id: string }): string {
  return eq.id;
}

/**
 * Garante que os campos `qrCode` e `qrcode` estejam sincronizados com `id`.
 * Retorna uma cópia do objeto com os campos corrigidos.
 */
export function syncEquipmentQrFields<T extends { id: string; qrCode?: string; qrcode?: string }>(eq: T): T {
  if (eq.qrCode === eq.id && eq.qrcode === eq.id) return eq;
  return { ...eq, qrCode: eq.id, qrcode: eq.id };
}

/**
 * Verifica se um código escaneado/digitado corresponde à identidade do equipamento.
 * Compara com `id`, `qrCode` e `qrcode` (todos normalizados).
 */
export function matchesEquipmentIdentity(eq: { id: string; qrCode?: string; qrcode?: string }, code: string): boolean {
  const normalized = normalizeEquipmentTag(code);
  return eq.id === normalized || eq.qrCode === normalized || eq.qrcode === normalized;
}
