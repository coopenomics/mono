/**
 * Серверная часть: язык текущего запроса и словари процесса.
 *
 * Один процесс Node обслуживает много запросов одновременно, поэтому язык
 * хранится не в глобальной переменной, а в AsyncLocalStorage: middleware
 * открывает контекст запроса (`runWithLocale`), и любой код ниже по стеку —
 * резолвер, сервис, фильтр ошибок, слушатель события — получает свой язык
 * через `currentLocale()` без передачи параметром.
 *
 * Вне запроса (задачи по расписанию, слушатели цепи) действует язык
 * по умолчанию.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { coreMessages } from './index';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from './locales';
import { mergeMessages, type MessageTree } from './messages';
import { createTranslator, type MessageParams, type Translator } from './translator';

export * from './index';

interface LocaleStore {
  locale: Locale;
}

interface ServerState {
  storage: AsyncLocalStorage<LocaleStore>;
  messages: Record<string, MessageTree>;
  sources: Set<string>;
  translators: Map<string, Translator>;
  missing: Set<string>;
}

// Одно состояние на процесс, даже если пакет загружен дважды (CJS и ESM
// сборки у разных потребителей): иначе словари расширения, зарегистрированные
// через одну копию, не увидел бы фильтр ошибок, загрузивший другую.
const STATE_KEY = Symbol.for('@coopenomics/i18n/server');
const globalState = globalThis as unknown as Record<symbol, ServerState | undefined>;

function state(): ServerState {
  let s = globalState[STATE_KEY];
  if (!s) {
    s = {
      storage: new AsyncLocalStorage<LocaleStore>(),
      messages: { ru: structuredClone(coreMessages.ru) },
      sources: new Set(['@coopenomics/i18n']),
      translators: new Map(),
      missing: new Set(),
    };
    globalState[STATE_KEY] = s;
  }
  return s;
}

/** Выполняет `fn` в контексте языка; всё асинхронное внутри видит этот язык. */
export function runWithLocale<T>(locale: string | undefined, fn: () => T): T {
  const resolved = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  return state().storage.run({ locale: resolved }, fn);
}

/** Язык текущего запроса или язык по умолчанию вне запроса. */
export function currentLocale(): Locale {
  return state().storage.getStore()?.locale ?? DEFAULT_LOCALE;
}

/**
 * Регистрирует словарь модуля или расширения. `source` — имя для сообщений
 * о конфликте ключей; повторная регистрация того же источника игнорируется
 * (горячая перезагрузка модуля в dev).
 */
export function registerMessages(locale: string, tree: MessageTree, source: string): void {
  const s = state();
  const sourceKey = `${locale}:${source}`;
  if (s.sources.has(sourceKey)) return;
  s.messages[locale] = mergeMessages(s.messages[locale] ?? {}, tree, source);
  s.sources.add(sourceKey);
  s.translators.clear();
}

/** Сводный словарь языка — для гейтов и отладки. */
export function registeredMessages(locale: string = DEFAULT_LOCALE): MessageTree {
  return state().messages[locale] ?? {};
}

/** Ключи, которые запрашивали, но не нашли, — с момента старта процесса. */
export function missingKeys(): string[] {
  return [...state().missing];
}

export function translatorFor(locale: string = currentLocale()): Translator {
  const s = state();
  let translator = s.translators.get(locale);
  if (!translator) {
    translator = createTranslator({
      locale,
      messages: s.messages,
      onMissing: (key) => s.missing.add(key),
    });
    s.translators.set(locale, translator);
  }
  return translator;
}

/** Текст по ключу на языке текущего запроса. */
export function t(key: string, params?: MessageParams | number, plural?: number): string {
  return translatorFor().t(key, params, plural);
}

/** Есть ли сообщение на языке текущего запроса. */
export function te(key: string): boolean {
  return translatorFor().has(key);
}
