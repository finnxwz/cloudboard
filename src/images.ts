import { normalizePath, requestUrl, TFile, TFolder, type App } from 'obsidian';
import { escapeMarkdown, pinText } from './canvas';
import type { Pin } from './types';

function hash(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}

async function ensureFolder(app: App, path: string): Promise<void> {
  let current = '';
  for (const part of path.split('/')) {
    current = current ? `${current}/${part}` : part;
    let existing = app.vault.getAbstractFileByPath(current);
    if (!existing) {
      try { await app.vault.createFolder(current); }
      catch (error) {
        if (!app.vault.getAbstractFileByPath(current)) throw error;
      }
      existing = app.vault.getAbstractFileByPath(current);
    }
    if (!(existing instanceof TFolder)) throw new Error(`Image folder is blocked by a file: ${current}`);
  }
}

async function localImage(app: App, pin: Pin, boardUrl: string): Promise<TFile> {
  const folder = normalizePath(`Pinterest assets/${hash(boardUrl)}`);
  await ensureFolder(app, folder);
  const stem = `${folder}/${pin.id}-${hash(pin.imageUrl)}`;
  const extensions = ['jpg', 'png', 'gif', 'webp', 'avif'];
  for (const extension of extensions) {
    const cached = app.vault.getAbstractFileByPath(`${stem}.${extension}`);
    if (cached instanceof TFile && cached.stat.size > 0) return cached;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      requestUrl({ url: pin.imageUrl, throw: false }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Image download timed out for pin ${pin.id}.`)), 45_000);
      }),
    ]);
    if (response.status !== 200) throw new Error(`Image download failed (HTTP ${response.status}).`);
    const contentType = Object.entries(response.headers).find(([key]) => key.toLowerCase() === 'content-type')?.[1]
      ?.split(';')[0]?.trim().toLowerCase();
    const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
      'image/webp': 'webp', 'image/avif': 'avif' } as Record<string, string>)[contentType ?? ''];
    if (!extension) throw new Error('Pinterest returned an unsupported image type.');
    if (!response.arrayBuffer.byteLength || response.arrayBuffer.byteLength > 25 * 1024 * 1024) {
      throw new Error('Image is empty or exceeds the 25 MB limit.');
    }
    return await app.vault.createBinary(`${stem}.${extension}`, response.arrayBuffer);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}

export async function prepareTexts(
  app: App, pins: Pin[], canvasPath: string, boardUrl: string, download: boolean,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  // Sequential downloads are intentionally gentle on Pinterest and mobile memory.
  for (const pin of pins) {
    let image: string | undefined;
    if (download) {
      const file = await localImage(app, pin, boardUrl);
      image = `!${app.fileManager.generateMarkdownLink(file, canvasPath, undefined, escapeMarkdown(pin.title))}`;
    }
    result.set(pin.id, pinText(pin, image));
  }
  return result;
}
