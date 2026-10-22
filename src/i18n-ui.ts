import { setTooltip, type Command, type Plugin } from 'obsidian';
import { onLanguageChange, t, type TranslationKey } from './i18n';

/** Keep IDs/hotkeys stable while updating palette labels on language changes. */
export function addLocalizedCommand(plugin: Plugin, key: TranslationKey, command: Omit<Command, 'name'>): void {
  const label = t(key);
  const registered = plugin.addCommand({ ...command, name: label });
  const prefix = registered.name.endsWith(label) ? registered.name.slice(0, -label.length) : '';
  plugin.register(onLanguageChange(() => { registered.name = prefix + t(key); }));
}

export function addLocalizedRibbon(plugin: Plugin, key: TranslationKey, callback: () => void): void {
  const ribbon = plugin.addRibbonIcon('images', t(key), callback);
  plugin.register(onLanguageChange(() => setTooltip(ribbon, t(key))));
}
