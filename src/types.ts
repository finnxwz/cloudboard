import { DEFAULT_LANGUAGE, type Language } from './i18n';

export interface Pin {
  id: string;
  title: string;
  imageUrl: string;
  link: string;
  width: number;
  height: number;
}

export interface CanvasNode {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  [key: string]: unknown;
}

export interface PinReference {
  nodeId: string;
  /** Last generated text: preserve user edits until Pinterest content changes. */
  text: string;
}

export interface PinterestMetadata {
  version: 1;
  pinterestUrl: string;
  lastSynced: string;
  pins: Record<string, PinReference>;
}

export interface CanvasData {
  nodes: CanvasNode[];
  edges: Array<{ id: string; fromNode: string; toNode: string; [key: string]: unknown }>;
  pinterest?: PinterestMetadata;
  [key: string]: unknown;
}

export interface Settings {
  language: Language;
  showCaptionBar: boolean;
  syncIntervalMinutes: number;
  downloadImages: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  language: DEFAULT_LANGUAGE,
  showCaptionBar: true,
  syncIntervalMinutes: 30,
  downloadImages: false,
};
