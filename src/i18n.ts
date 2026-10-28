import { es } from './locales/es';
import { fr } from './locales/fr';

/** Add languages here, then add a complete dictionary and its native label. */
export type Language = 'en' | 'de' | 'es' | 'fr';
export const DEFAULT_LANGUAGE: Language = 'en';
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', de: 'Deutsch', es: 'Español', fr: 'Français' };

export const en = {
  language: 'Language',
  languageDescription: 'Choose the language of the plugin interface. Your notes and image captions are not translated.',
  showCaptionBar: 'Show caption bar',
  showCaptionBarDescription: 'On: captions and actions below the photo. Off: photo only, with edit and delete buttons on hover. On mobile, tap once to show the actions.',
  showAssetFolder: 'Show asset folder in file explorer',
  showAssetFolderDescription: 'Show “Cloudboard assets” in Obsidian’s file explorer. Off keeps the folder hidden there; its images remain safely stored and synced in the vault.',
  defaultColumnCount: 'Default columns for new boards',
  defaultColumnCountDescription: 'Choose how many columns new boards start with. Existing boards keep their own selection, which can be changed in the board header.',
  convertNote: 'Convert note into an image board',
  addToBoard: 'Add image to board',
  newBoard: 'New image board',
  migrateCanvas: 'Convert existing Canvas into an image board',
  migrateCanvasMenu: 'Import as an image board',
  board: 'Image board',
  image: 'Image',
  onlineImage: 'Online image',
  boardSubtitle: 'Add images with + · Drag cards to rearrange',
  openSourceNote: 'Open original note',
  sourceNoteMissing: 'The original note is no longer in the vault.',
  boardColumns: 'Image board with {count} columns',
  columnCount: 'Columns',
  columnChangeFailed: 'Could not change the number of columns: {error}',
  column: 'Column {number}',
  addInColumn: 'Add image to column {number}',
  addImage: 'Add image',
  moveCardLabel: '{title}. Use the arrow keys to move this card.',
  enlargeImage: 'Enlarge {title}',
  imageUnavailable: 'Image unavailable',
  imageMissing: 'Image missing from the vault. Please sync its attachment too.',
  editCaption: 'Edit caption',
  removeCard: 'Remove from board',
  removeCardLabel: 'Remove from board; keep the image file',
  removeFailed: 'Could not remove image: {error}',
  moveFailed: 'Could not move card: {error}',
  boardLoadFailed: 'Could not load board: {error}',
  retry: 'Try again',
  captionOptional: 'Caption (leave empty to hide)',
  caption: 'Caption',
  cancel: 'Cancel',
  save: 'Save',
  pluginInactive: 'The plugin is no longer active.',
  preparingLink: 'Preparing link {number}…',
  missingVaultFile: 'Image missing from vault: {name}',
  copyingPhoto: 'Copying photo {number} to the vault…',
  noCanvasImages: 'This Canvas contains no recognizable images. It was not changed.',
  migratedCanvas: 'Images imported. The original Canvas was not changed.',
  searchVaultImage: 'Search for an image in the vault…',
  addImageColumn: 'Add image · Column {number}',
  chooseImageIntro: 'From your device, your vault or an online link — no Pinterest sign-in required.',
  chooseImageRequired: 'Please select an image or enter a link.',
  captionDescription: 'Optional; uses the image name if left empty.',
  chooseDevicePhotos: 'Select photos from your device',
  chooseDevice: 'Choose from device',
  chooseVault: 'Choose from vault',
  internetLink: 'Internet link',
  internetLinkDescription: 'Direct HTTPS image URL or full Pinterest pin link. One link per line; online images are not saved locally.',
  onlineAddresses: 'Online image URLs',
  addOnlineImage: 'Add online image',
  onlineHint: 'Pin link blocked? Use “Copy image address” in your browser. Local images must be synced to your phone with the vault; online images require internet access.',
  invalidBoard: 'Invalid image board file.',
  unsupportedBoard: 'This file format is not supported as an image board. The file was not changed.',
  invalidCard: 'Invalid image card. The file was not changed.',
  missingImageUrl: 'The image card has no image URL.',
  cardMissing: 'The image card is no longer in this board.',
  invalidColumn: 'Invalid destination column.',
  invalidColumnCount: 'The board must have between two and five columns.',
  targetCardChanged: 'The destination card was moved or removed. Please try again.',
  invalidImageUrl: 'Please enter a valid HTTPS image URL.',
  httpsOnly: 'Only HTTPS links without embedded credentials are allowed.',
  pinNoPreview: 'Pinterest returned no public preview image for this pin (possibly a sign-in wall). Open the pin in your browser and use “Copy image address”, not the pin page URL.',
  pinInvalidPreview: 'The pin page contains no valid Pinterest preview image. Please use the direct image URL.',
  noShortLinks: 'Please use the full Pinterest pin link or direct image URL, not a pin.it short link.',
  noBoardLink: 'Please enter a single pin link (/pin/123…/) or a direct image URL, not a board URL.',
  pinTimeout: 'The pin request timed out. Please use the direct image URL.',
  pinUnavailable: 'Pinterest pin unavailable (HTTP {status}). Please use the direct image URL.',
  uploadFormat: '{name}: Please use JPG, PNG, GIF, WebP, AVIF or BMP (not HEIC/SVG).',
  uploadSize: '{name}: Image is empty or exceeds 25 MB.',
  settingsSaveFailed: 'Could not save settings: {error}',
} as const;

export type TranslationKey = keyof typeof en;
export type Dictionary = Record<TranslationKey, string>;

export const de: Dictionary = {
  language: 'Sprache',
  languageDescription: 'Sprache der Plugin-Oberfläche auswählen. Deine Notizen und Bildunterschriften werden nicht übersetzt.',
  showCaptionBar: 'Bildunterschriften-Leiste anzeigen',
  showCaptionBarDescription: 'An: Beschriftung und Aktionen unter dem Foto. Aus: nur das Foto; Bearbeiten und Löschen erscheinen beim Hover über dem Bild. Auf dem Handy einmal antippen, um die Aktionen einzublenden.',
  showAssetFolder: 'Asset-Ordner im Datei-Explorer anzeigen',
  showAssetFolderDescription: '„Cloudboard assets“ im Datei-Explorer von Obsidian anzeigen. Ausgeblendet bleiben die Bilder weiterhin sicher im Vault gespeichert und werden synchronisiert.',
  defaultColumnCount: 'Standardspalten für neue Boards',
  defaultColumnCountDescription: 'Festlegen, mit wie vielen Spalten neue Boards starten. Bestehende Boards behalten ihre eigene Auswahl, die direkt im Board-Kopf geändert werden kann.',
  convertNote: 'Notiz in Bilderboard umwandeln',
  addToBoard: 'Bild zum Bilderboard hinzufügen',
  newBoard: 'Neues Bilderboard',
  migrateCanvas: 'Bisheriges Canvas als echtes Bilderboard übernehmen',
  migrateCanvasMenu: 'Als echtes Bilderboard übernehmen',
  board: 'Bilderboard',
  image: 'Bild',
  onlineImage: 'Online-Bild',
  boardSubtitle: 'Bilder mit + hinzufügen · Kacheln zum Anordnen ziehen',
  openSourceNote: 'Ursprüngliche Notiz öffnen',
  sourceNoteMissing: 'Die ursprüngliche Notiz ist nicht mehr im Vault vorhanden.',
  boardColumns: 'Bilderboard mit {count} Spalten',
  columnCount: 'Spalten',
  columnChangeFailed: 'Die Anzahl der Spalten konnte nicht geändert werden: {error}',
  column: 'Spalte {number}',
  addInColumn: 'Bild in Spalte {number} hinzufügen',
  addImage: 'Bild hinzufügen',
  moveCardLabel: '{title}. Mit den Pfeiltasten verschieben.',
  enlargeImage: '{title} vergrößern',
  imageUnavailable: 'Bild nicht erreichbar',
  imageMissing: 'Bild fehlt im Vault. Bitte den Anhang mitsynchronisieren.',
  editCaption: 'Bildunterschrift bearbeiten',
  removeCard: 'Vom Board entfernen',
  removeCardLabel: 'Vom Board entfernen; Bilddatei bleibt erhalten',
  removeFailed: 'Bild konnte nicht entfernt werden: {error}',
  moveFailed: 'Kachel konnte nicht verschoben werden: {error}',
  boardLoadFailed: 'Das Board konnte nicht geladen werden: {error}',
  retry: 'Erneut laden',
  captionOptional: 'Bildunterschrift (leer lassen zum Ausblenden)',
  caption: 'Bildunterschrift',
  cancel: 'Abbrechen',
  save: 'Speichern',
  pluginInactive: 'Das Plugin ist nicht mehr aktiv.',
  preparingLink: 'Link {number} wird vorbereitet…',
  missingVaultFile: 'Bild fehlt im Vault: {name}',
  copyingPhoto: 'Foto {number} wird in den Vault kopiert…',
  noCanvasImages: 'Dieses Canvas enthält keine erkennbaren Bilder. Das Canvas bleibt unverändert.',
  migratedCanvas: 'Bilder übernommen. Das ursprüngliche Canvas bleibt unverändert.',
  searchVaultImage: 'Bild im Vault suchen…',
  addImageColumn: 'Bild hinzufügen · Spalte {number}',
  chooseImageIntro: 'Vom Gerät, aus deinem Vault oder als Online-Bild – ohne Pinterest-Anmeldung.',
  chooseImageRequired: 'Bitte ein Bild oder einen Link auswählen.',
  captionDescription: 'Optional; sonst wird der Bildname verwendet.',
  chooseDevicePhotos: 'Fotos vom Gerät auswählen',
  chooseDevice: 'Vom Gerät auswählen',
  chooseVault: 'Aus dem Vault auswählen',
  internetLink: 'Internet-Link',
  internetLinkDescription: 'Direkte HTTPS-Bildadresse oder vollständiger Pinterest-Pin-Link. Ein Link pro Zeile; Online-Bilder werden nicht lokal gespeichert.',
  onlineAddresses: 'Online-Bildadressen',
  addOnlineImage: 'Online-Bild hinzufügen',
  onlineHint: 'Pin-Link gesperrt? Im Browser „Bildadresse kopieren“ verwenden. Lokale Bilder müssen mit dem Vault aufs Handy synchronisiert werden; Online-Bilder benötigen Internet.',
  invalidBoard: 'Ungültige Bilderboard-Datei.',
  unsupportedBoard: 'Dieses Dateiformat wird nicht als Bilderboard unterstützt. Die Datei wurde nicht verändert.',
  invalidCard: 'Ungültige Bildkarte. Die Datei wurde nicht verändert.',
  missingImageUrl: 'Der Bildkarte fehlt eine Bildadresse.',
  cardMissing: 'Die Bildkarte ist nicht mehr im Board vorhanden.',
  invalidColumn: 'Ungültige Zielspalte.',
  invalidColumnCount: 'Das Board muss zwischen zwei und fünf Spalten haben.',
  targetCardChanged: 'Die Zielkarte wurde zwischenzeitlich verschoben oder entfernt. Bitte erneut versuchen.',
  invalidImageUrl: 'Bitte eine gültige HTTPS-Bildadresse eingeben.',
  httpsOnly: 'Nur HTTPS-Links ohne Zugangsdaten sind erlaubt.',
  pinNoPreview: 'Pinterest liefert für diesen Pin kein öffentliches Vorschaubild (möglicherweise Login-Sperre). Öffne den Pin im Browser und verwende „Bildadresse kopieren“, nicht den Link zur Pin-Seite.',
  pinInvalidPreview: 'Die Pin-Seite enthält kein gültiges Pinterest-Vorschaubild. Bitte die direkte Bildadresse verwenden.',
  noShortLinks: 'Bitte den vollständigen Pinterest-Pin-Link oder die direkte Bildadresse verwenden, keinen pin.it-Kurzlink.',
  noBoardLink: 'Bitte einen einzelnen Pin-Link (/pin/123…/) oder eine direkte Bildadresse eingeben, keine Board-URL.',
  pinTimeout: 'Zeitüberschreitung beim Laden des Pins. Bitte die direkte Bildadresse verwenden.',
  pinUnavailable: 'Pinterest-Pin nicht abrufbar (HTTP {status}). Bitte die direkte Bildadresse verwenden.',
  uploadFormat: '{name}: Bitte JPG, PNG, GIF, WebP, AVIF oder BMP verwenden (kein HEIC/SVG).',
  uploadSize: '{name}: Bild ist leer oder größer als 25 MB.',
  settingsSaveFailed: 'Einstellungen konnten nicht gespeichert werden: {error}',
};

const dictionaries: Record<Language, Partial<Dictionary>> = { en, de, es, fr };
let language: Language = DEFAULT_LANGUAGE;
const listeners = new Set<() => void>();

export function resolveLanguage(value: unknown): Language {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(LANGUAGE_NAMES, value)
    ? value as Language : DEFAULT_LANGUAGE;
}

export function setLanguage(value: unknown): void {
  const next = resolveLanguage(value);
  if (next === language) return;
  language = next;
  for (const listener of listeners) listener();
}

export function onLanguageChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function t(key: TranslationKey, values: Record<string, string | number> = {}): string {
  const text = dictionaries[language][key] || en[key];
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : placeholder);
}
