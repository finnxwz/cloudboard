import { vi } from 'vitest';
export const requestUrl = vi.fn();

export class TFile {
  path = '';
  name = '';
  basename = '';
  extension = '';
}

export class FileView {
  app: unknown;
  file: TFile | null = null;
  contentEl: HTMLElement;
  constructor(leaf: { app: unknown }) {
    this.app = leaf.app;
    this.contentEl = document.createElement('div');
  }
  registerEvent(event: unknown): unknown { return event; }
}

export class Modal {
  contentEl = document.createElement('div');
  modalEl = document.createElement('div');
  constructor(public app: unknown) {}
  setTitle(_title: string): void {}
  onOpen(): void {}
  onClose(): void {}
  open(): void { this.onOpen(); }
  close(): void { this.onClose(); }
}

export class Notice { constructor(_text: string) {} }
export function setIcon(element: HTMLElement, icon: string): void { element.setAttribute('data-icon', icon); }
export function setTooltip(element: HTMLElement, text: string): void { element.setAttribute('aria-label', text); }
export class SuggestModal<T> extends Modal {
  setPlaceholder(_placeholder: string): void {}
}
export class Setting {}
export function normalizePath(path: string): string { return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''); }
