/**
 * Переводчик библиотек — `@coopenomics/auth`, `@coopenomics/sdk` и других
 * пакетов, у которых нет своего экземпляра vue-i18n и контекста запроса.
 *
 * По умолчанию библиотека переводит по общим словарям пакета на языке по
 * умолчанию. Приложение подставляет свой переводчик
 * (`setLibraryTranslator((key, params) => i18n.global.t(key, params))`), и тексты
 * библиотек следуют языку его интерфейса. Состояние одно на процесс/вкладку,
 * даже если пакет загружен дважды (CJS и ESM).
 */
import { coreMessages } from './core';
import { createTranslator, type MessageParams } from './translator';

export type LibraryTranslate = (key: string, params?: MessageParams | number) => string;

const KEY = Symbol.for('@coopenomics/i18n/library');
const holder = globalThis as unknown as Record<symbol, { t?: LibraryTranslate; fallback?: LibraryTranslate }>;

function state() {
  let s = holder[KEY];
  if (!s) {
    const tr = createTranslator({ messages: coreMessages });
    s = { fallback: (key, params) => tr.t(key, params) };
    holder[KEY] = s;
  }
  return s;
}

/** Подставить переводчик приложения для текстов библиотек. */
export function setLibraryTranslator(translate: LibraryTranslate): void {
  state().t = translate;
}

/** Текст библиотеки по ключу — переводчиком приложения или словарями пакета. */
export function lt(key: string, params?: MessageParams | number): string {
  const s = state();
  return (s.t ?? s.fallback!)(key, params);
}
