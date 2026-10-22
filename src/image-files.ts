import { t } from './i18n';

export const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp']);

export function validateUpload(file: Pick<File, 'name' | 'size'>): void {
  if (!IMAGE_EXTENSIONS.has(file.name.split('.').pop()?.toLowerCase() ?? '')) {
    throw new Error(t('uploadFormat', { name: file.name }));
  }
  if (!file.size || file.size > 25 * 1024 * 1024) throw new Error(t('uploadSize', { name: file.name }));
}
