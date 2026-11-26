/**
 * Разбор описателя изолированного фронта приложения каталога (487-18).
 * Чистые функции без Vue: файл фронта составил издатель, каждое поле
 * проверяется до того, как стол покажет страницу приложения.
 */

/** Значение признака `coopenomicsFrontend` у изолированного фронта. */
export const FRAME_FRONTEND_KIND = 'frame';

/** Имя рабочего стола и его маршрута: латиница, цифры, дефис. */
const WORKSPACE_NAME_REGEX = /^[a-z][a-z0-9-]{1,31}$/;
/** Значок Material Icons: имя из строчных букв и подчёркиваний. */
const ICON_REGEX = /^[a-z0-9_]{1,40}$/;
/** Предел длины заголовка рабочего стола. */
const TITLE_MAX = 60;

/** Изолированный фронт: рабочий стол и страница приложения. */
export interface FrameDescriptor {
  workspace: { name: string; title: string; icon: string };
  html: string;
}

/** Описатель из файла фронта; `null` — файл не описатель. */
function descriptorData(code: string): Record<string, unknown> | null {
  const trimmed = code.trimStart();
  if (!trimmed.startsWith('{')) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const data = raw as Record<string, unknown>;
  return data.coopenomicsFrontend === FRAME_FRONTEND_KIND ? data : null;
}

/** Рабочий стол из описателя; отказ — имя или заголовок вне формата. */
function descriptorWorkspace(value: unknown): FrameDescriptor['workspace'] {
  const { name, title, icon } = (value ?? {}) as Record<string, unknown>;
  if (typeof name !== 'string' || !WORKSPACE_NAME_REGEX.test(name)) {
    // i18n-ignore: диагностика загрузчика фронтов, пишется в консоль
    throw new Error('описатель фронта: workspace.name вне формата');
  }
  if (typeof title !== 'string' || title.length === 0 || title.length > TITLE_MAX) {
    // i18n-ignore: диагностика загрузчика фронтов, пишется в консоль
    throw new Error('описатель фронта: workspace.title пуст или длиннее предела');
  }
  return { name, title, icon: typeof icon === 'string' && ICON_REGEX.test(icon) ? icon : 'extension' };
}

/**
 * Разобрать файл фронта как описатель. `null` — файл не описатель (прежний
 * сценарий `install.js`). Ошибка — описатель заявлен, но составлен неверно:
 * такой фронт не подключается, выполнять его как сценарий нельзя.
 */
export function parseFrameDescriptor(code: string): FrameDescriptor | null {
  const data = descriptorData(code);
  if (data === null) return null;
  const workspace = descriptorWorkspace(data.workspace);
  if (typeof data.html !== 'string' || data.html.length === 0) {
    // i18n-ignore: диагностика загрузчика фронтов, пишется в консоль
    throw new Error('описатель фронта: страница приложения пуста');
  }
  return { workspace, html: data.html };
}
