// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PHOTO_FALLBACK_WIDTH,
  PHOTO_LAST_RESORT_WIDTH,
  PhotoProcessingError,
  processInspectionPhoto,
} from './photoService';

function installCanvas() {
  const sizes: Array<{ width: number; height: number }> = [];
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag !== 'canvas') return document.createElementNS('http://www.w3.org/1999/xhtml', tag);
    const canvas = {
      width: 0,
      height: 0,
      toDataURL: () => 'data:image/webp;base64,probe',
      getContext: () => ({
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
      }),
      toBlob: (callback: BlobCallback, type: string) => {
        sizes.push({ width: canvas.width, height: canvas.height });
        callback(new Blob(['encoded'], { type }));
      },
    } as unknown as HTMLCanvasElement;
    return canvas;
  }) as typeof document.createElement);
  return sizes;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('processInspectionPhoto', () => {
  it('produces a compressed Blob and closes the bitmap', async () => {
    installCanvas();
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 4000, height: 3000, close })));

    const result = await processInspectionPhoto(new File(['camera'], 'camera.jpg', { type: 'image/jpeg' }));

    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.mimeType).toBe('image/webp');
    expect(result.width).toBe(1280);
    expect(result.height).toBe(960);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('uses one conservative fallback after a memory-pressure error', async () => {
    const sizes = installCanvas();
    const close = vi.fn();
    const bitmap = { width: 4000, height: 3000, close };
    const decode = vi.fn()
      .mockRejectedValueOnce(new PhotoProcessingError('PHOTO_MEMORY_PRESSURE', 'memory'))
      .mockResolvedValueOnce(bitmap);
    vi.stubGlobal('createImageBitmap', decode);

    const result = await processInspectionPhoto(new File(['camera'], 'camera.jpg', { type: 'image/jpeg' }));

    expect(decode).toHaveBeenCalledTimes(2);
    expect(result.width).toBe(PHOTO_FALLBACK_WIDTH);
    expect(result.height).toBe(720);
    expect(sizes.some((size) => size.width === PHOTO_FALLBACK_WIDTH)).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('does not loop beyond the last conservative strategy', async () => {
    installCanvas();
    const decode = vi.fn(async () => {
      throw new PhotoProcessingError('PHOTO_MEMORY_PRESSURE', 'memory');
    });
    vi.stubGlobal('createImageBitmap', decode);

    await expect(processInspectionPhoto(new File(['camera'], 'camera.jpg', { type: 'image/jpeg' }))).rejects.toMatchObject({
      code: 'PHOTO_MEMORY_PRESSURE',
    });
    expect(decode).toHaveBeenCalledTimes(3);
    expect(PHOTO_LAST_RESORT_WIDTH).toBe(768);
  });
});
