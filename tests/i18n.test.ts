import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Command, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS } from '../src/types';
import { DEFAULT_LANGUAGE, LANGUAGE_NAMES, de, en, onLanguageChange, resolveLanguage, setLanguage, t, type Dictionary, type Language } from '../src/i18n';
import { es } from '../src/locales/es';
import { fr } from '../src/locales/fr';
import { addLocalizedCommand } from '../src/i18n-ui';

beforeEach(() => { setLanguage('en'); });
afterEach(() => { setLanguage('en'); });

describe('four-language interface', () => {
  it('defaults to English and exposes native language names', () => {
    expect(DEFAULT_LANGUAGE).toBe('en');
    expect(DEFAULT_SETTINGS.language).toBe('en');
    expect(t('showCaptionBar')).toBe('Show caption bar');
    expect(LANGUAGE_NAMES).toEqual({ en: 'English', de: 'Deutsch', es: 'Español', fr: 'Français' });
  });

  it.each(Object.entries({ de, es, fr }))('has every translation and matching placeholders in %s', (_language, dictionary) => {
    expect(Object.keys(dictionary).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(dictionary[key].trim().length, key).toBeGreaterThan(0);
      expect(dictionary[key].match(/\{\w+\}/g)?.sort() ?? [], key)
        .toEqual(en[key].match(/\{\w+\}/g)?.sort() ?? []);
    }
  });

  it.each(['en', 'de', 'es', 'fr'] as Language[])('formats translated messages in %s without treating user text as a template', language => {
    setLanguage(language);
    expect(t('column', { number: 4 })).toContain('4');
    expect(t('removeFailed', { error: '$& {number} <script>' })).toContain('$& {number} <script>');
    expect(resolveLanguage(language)).toBe(language);
  });

  it('uses English for missing preferences and unsupported languages', () => {
    for (const value of [undefined, null, 'unknown', '__proto__', 123, {}]) {
      expect(resolveLanguage(value)).toBe('en');
      setLanguage(value);
      expect(t('save')).toBe('Save');
    }
  });

  it('falls back to English if a translated entry is unavailable at runtime', () => {
    const optional = de as Partial<Dictionary>;
    const original = optional.addImage;
    try {
      delete optional.addImage;
      setLanguage('de');
      expect(t('addImage')).toBe('Add image');
    } finally { optional.addImage = original; }
  });

  it('notifies listeners only when the language changes and supports cleanup', () => {
    const listener = vi.fn();
    const cleanup = onLanguageChange(listener);
    setLanguage('es');
    setLanguage('es');
    expect(listener).toHaveBeenCalledTimes(1);
    cleanup();
    setLanguage('fr');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('updates command names without changing command IDs, hotkeys or the plugin prefix', () => {
    const disposers: Array<() => void> = [];
    let registered: Command;
    const callback = vi.fn();
    const plugin = {
      addCommand: (command: Command) => { registered = { ...command, name: `Import From Pinterest: ${command.name}` }; return registered; },
      register: (dispose: () => void) => { disposers.push(dispose); },
    } as unknown as Plugin;
    addLocalizedCommand(plugin, 'convertNote', { id: 'create-image-board', callback });
    try {
      setLanguage('fr');
      expect(registered!.name).toBe('Import From Pinterest: Convertir la note en tableau d’images');
      expect(registered!.id).toBe('create-image-board');
      expect(registered!.callback).toBe(callback);
      setLanguage('es');
      expect(registered!.name).toBe('Import From Pinterest: Convertir nota en tablero de imágenes');
    } finally { disposers.forEach(dispose => dispose()); }
  });
});
