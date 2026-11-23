/** Публичный embed diagrams.net; без переменных окружения. */
const DRAWIO_EMBED_BASE = 'https://embed.diagrams.net';

export function getDrawioEmbedOrigin(): string {
  return DRAWIO_EMBED_BASE;
}

/** Origin для проверки postMessage. */
export function getDrawioPostMessageOrigin(): string {
  return new URL(DRAWIO_EMBED_BASE).origin;
}

/**
 * Адрес встраивания draw.io. `dark` — тема стола: редактор diagrams.net
 * рисует интерфейс и холст в тёмной схеме по параметру `dark=1`, поэтому
 * схема следует теме стола, а не остаётся белым листом в тёмном окне.
 */
export function buildDrawioEmbedIframeSrc(
  embedBase: string,
  readonly: boolean,
  dark = false,
): string {
  const base = embedBase.replace(/\/+$/, '');
  const url = new URL(`${base}/`);
  url.searchParams.set('embed', '1');
  url.searchParams.set('proto', 'json');
  url.searchParams.set('spin', '1');
  url.searchParams.set('ui', 'min');
  url.searchParams.set('noExitBtn', '1');
  url.searchParams.set('noSaveBtn', '1');
  url.searchParams.set('saveAndExit', '0');
  url.searchParams.set('dark', dark ? '1' : '0');
  if (readonly) {
    url.searchParams.set('chrome', '0');
  } else {
    url.searchParams.set('libraries', '0');
  }
  return url.toString();
}
