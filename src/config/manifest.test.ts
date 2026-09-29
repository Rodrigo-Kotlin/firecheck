import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(
  readFileSync(resolve(projectRoot, 'public/manifest.json'), 'utf8'),
) as {
  name: string;
  short_name: string;
  description: string;
  lang: string;
  id: string;
  start_url: string;
  scope: string;
  display: string;
  orientation?: string;
  shortcuts?: Array<{ url: string; icons?: Array<{ src: string }> }>;
};

describe('manifest PWA do EfetivaFire', () => {
  it('preserva a identidade instalada e a origem raiz', () => {
    expect(manifest.name).toBe('EfetivaFire — Inspeção e Gestão de Equipamentos');
    expect(manifest.short_name).toBe('EfetivaFire');
    expect(manifest.lang).toBe('pt-BR');
    expect(manifest.id).toBe('./');
    expect(manifest.start_url).toBe('.');
    expect(manifest.scope).toBe('.');
    expect(manifest.display).toBe('standalone');
  });

  it('não força orientação fixa nem declara screenshot falsa', () => {
    expect(manifest.orientation).toBeUndefined();
    expect('screenshots' in manifest).toBe(false);
  });

  it('usa descrição profissional e atalhos para rotas existentes', () => {
    expect(manifest.description).toContain('Gestão e inspeção');
    expect(manifest.shortcuts?.map((shortcut) => shortcut.url)).toEqual([
      './scan',
      './inspecionar',
      './equipamentos',
    ]);
  });

  it('referencia ícones reais para os atalhos', () => {
    for (const shortcut of manifest.shortcuts ?? []) {
      for (const icon of shortcut.icons ?? []) {
        expect(existsSync(resolve(projectRoot, 'public', icon.src))).toBe(true);
      }
    }
    expect(existsSync(resolve(projectRoot, 'public/icon-192.png'))).toBe(true);
    expect(existsSync(resolve(projectRoot, 'public/icon-512.png'))).toBe(true);
  });
});
