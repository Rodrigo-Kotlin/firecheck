export interface PhotoDraft {
  blob: Blob;
  previewUrl: string;
  mimeType: string;
  width: number;
  height: number;
  size: number;
}

export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PHOTO_ERROR_MSG = 'Não foi possível processar esta imagem. Tente novamente ou escolha outra foto.';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function createPreviewUrl(blob: Blob): string {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('Este navegador não suporta pré-visualização de imagem.');
  }
  return URL.createObjectURL(blob);
}

export function revokePreviewUrl(url: string | null | undefined): void {
  if (url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
}
