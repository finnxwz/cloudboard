import { DEFAULT_LANGUAGE, type Language } from './i18n';
import type { ColumnCount } from './board-data';

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

export interface CanvasData {
  nodes: CanvasNode[];
  edges: Array<{ id: string; fromNode: string; toNode: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

export interface Settings {
  language: Language;
  showCaptionBar: boolean;
  showAssetFolder: boolean;
  defaultColumnCount: ColumnCount;
}

export const DEFAULT_SETTINGS: Settings = {
  language: DEFAULT_LANGUAGE,
  showCaptionBar: true,
  showAssetFolder: false,
  defaultColumnCount: 4,
};
