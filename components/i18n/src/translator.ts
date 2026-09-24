import {
  compile,
  createCoreContext,
  fallbackWithLocaleChain,
  registerLocaleFallbacker,
  registerMessageCompiler,
  registerMessageResolver,
  resolveValue,
  translate,
} from '@intlify/core-base';
import { DEFAULT_LOCALE } from './locales';
import { pluralRules } from './plural';
import type { LocaleMessages } from './messages';

// Ядро vue-i18n без Vue собирается из частей: компилятор сообщений,
// разбор пути ключа и цепочка запасных языков регистрируются явно.
// Регистрация глобальная и идемпотентная — те же функции ставит и vue-i18n.
registerMessageCompiler(compile);
registerMessageResolver(resolveValue);
registerLocaleFallbacker(fallbackWithLocaleChain);

export type MessageParams = Record<string, unknown> | unknown[];

export interface Translator {
  readonly locale: string;
  /**
   * Текст по ключу. `params` — именованные (`{ amount }`) или позиционные
   * (`[amount]`) параметры; `plural` — число для выбора формы.
   * Ключа нет в словаре — возвращается сам ключ: так пропуск виден сразу.
   */
  t(key: string, params?: MessageParams | number, plural?: number): string;
  /** Есть ли сообщение с таким ключом. */
  has(key: string): boolean;
}

export interface TranslatorOptions {
  locale?: string;
  messages: LocaleMessages;
  fallbackLocale?: string;
  /** Вызывается для каждого отсутствующего ключа — для логов и гейтов. */
  onMissing?: (key: string, locale: string) => void;
}

export function createTranslator(options: TranslatorOptions): Translator {
  const locale = options.locale ?? DEFAULT_LOCALE;
  const ctx = createCoreContext({
    locale,
    fallbackLocale: options.fallbackLocale ?? DEFAULT_LOCALE,
    messages: options.messages as never,
    pluralRules,
    missingWarn: false,
    fallbackWarn: false,
    warnHtmlMessage: false,
    missing: (_ctx: unknown, missingLocale: string, key: string, type: string) => {
      if (type === 'translate') options.onMissing?.(key, missingLocale);
      return key;
    },
  } as never);

  // У translate десятки перегрузок с глубокими условными типами: их разбор
  // упирается в предел глубины TypeScript (TS2589). Параметры мы проверяем
  // своим интерфейсом выше, поэтому зовём ядро через простую сигнатуру.
  const run = translate as unknown as (...args: unknown[]) => unknown;

  return {
    locale,
    t(key, params, plural) {
      let result: unknown;
      if (typeof params === 'number') {
        result = run(ctx, key, params);
      } else if (plural !== undefined) {
        result = run(ctx, key, params ?? {}, { plural });
      } else if (params !== undefined) {
        result = run(ctx, key, params);
      } else {
        result = run(ctx, key);
      }
      return typeof result === 'string' ? result : key;
    },
    has(key) {
      const tree = (options.messages as Record<string, unknown>)[locale];
      return typeof resolveValue(tree, key) === 'string';
    },
  };
}
