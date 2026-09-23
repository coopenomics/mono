/**
 * Переводчик рабочего стола.
 *
 * Словари: общие из `@coopenomics/i18n` (`common`, `validation`, `errors`),
 * ядра — `./locales/<язык>/<область>.json`, расширений — регистрируются
 * расширением при установке (`registerMessages`). Ключи и формат сообщений —
 * см. components/i18n/README.md.
 *
 * Как пользоваться:
 *   шаблон — `{{ $t('wallet.deposit.title') }}`, `:label="$t('common.action.save')"`;
 *   скрипт — `import { t } from 'src/shared/i18n'` и `t('wallet.deposit.success', { amount })`.
 *
 * Экземпляр один на приложение. Язык в сессии не меняется: словари грузятся
 * сразу, поэтому `t()` можно звать и при описании маршрутов, и в модулях без
 * компонента. На сервере (SSR) язык тот же для всех запросов — единственный;
 * когда языков станет больше, язык запроса будет выбираться здесь же.
 */
import { unref } from 'vue';
import { createI18n } from 'vue-i18n';
import {
  DEFAULT_LOCALE,
  PSEUDO_LOCALE,
  coreMessages,
  intlLocale,
  mergeMessages,
  pluralRules,
  pseudoLocalize,
  type MessageTree,
} from '@coopenomics/i18n';
import type { DynamicMessageKey, MessageKey } from './keys.generated';

export type { DynamicMessageKey, MessageKey } from './keys.generated';

const coreDictionaries = import.meta.glob<MessageTree>('./locales/ru/*.json', {
  eager: true,
  import: 'default',
});

function buildCoreMessages(): MessageTree {
  const tree = mergeMessages({}, coreMessages.ru, '@coopenomics/i18n');
  for (const [path, dict] of Object.entries(coreDictionaries).sort(([a], [b]) => a.localeCompare(b))) {
    mergeMessages(tree, dict, path);
  }
  return tree;
}

const PSEUDO_FLAG = 'i18n.pseudo';

/**
 * Псевдолокаль для проверки глазами (только в браузере, только в dev):
 * `?i18n=pseudo` включает, `?i18n=off` выключает, выбор помнится.
 * Вынесенный текст выглядит как `[!! Сохранить ··· !!]`, невынесенный — как есть.
 */
function pseudoEnabled(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  const param = new URLSearchParams(window.location.search).get('i18n');
  try {
    if (param === 'pseudo') window.localStorage.setItem(PSEUDO_FLAG, '1');
    if (param === 'off') window.localStorage.removeItem(PSEUDO_FLAG);
    return window.localStorage.getItem(PSEUDO_FLAG) === '1';
  } catch {
    return param === 'pseudo';
  }
}

const ru = buildCoreMessages();
const pseudo = pseudoEnabled();

export const i18n = createI18n({
  legacy: false,
  locale: pseudo ? PSEUDO_LOCALE : DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages: pseudo ? { [DEFAULT_LOCALE]: ru, [PSEUDO_LOCALE]: pseudoLocalize(ru) } : { [DEFAULT_LOCALE]: ru },
  pluralRules,
  globalInjection: true,
  missingWarn: false,
  fallbackWarn: false,
  warnHtmlMessage: false,
});

const registered = new Set<string>();

/**
 * Подключает словарь расширения. Ключи расширения лежат под его именем,
 * повтор чужого ключа — ошибка (второй перевод молча затёр бы первый).
 * Повторный вызов с тем же источником ничего не делает.
 */
export function registerMessages(source: string, tree: MessageTree, locale: string = DEFAULT_LOCALE): void {
  const id = `${locale}:${source}`;
  if (registered.has(id)) return;
  // Проверка на пересечение — на копии текущего словаря, чтобы ошибка
  // не оставила словарь наполовину слитым.
  mergeMessages(structuredClone(i18n.global.getLocaleMessage(locale) as MessageTree), tree, source);
  i18n.global.mergeLocaleMessage(locale, tree);
  if (pseudo && locale === DEFAULT_LOCALE) i18n.global.mergeLocaleMessage(PSEUDO_LOCALE, pseudoLocalize(tree));
  registered.add(id);
}

type Params = Record<string, unknown> | unknown[];

/**
 * Текст по ключу. `params` — именованные (`{ amount }`) или позиционные
 * параметры, число вторым аргументом — выбор формы (`t('days', n)`).
 * Ключ, собранный в рантайме, обязан начинаться с существующего раздела:
 * `t(`capital.issue.status.${status}`)`.
 */
export function t(key: MessageKey | DynamicMessageKey, params?: Params | number, plural?: number): string {
  const g = i18n.global;
  if (typeof params === 'number') return g.t(key, params);
  if (plural !== undefined) return g.t(key, (params ?? {}) as Record<string, unknown>, plural);
  if (params !== undefined) return g.t(key, params as Record<string, unknown>);
  return g.t(key);
}

/** Есть ли сообщение с таким ключом — для ключей, собранных из данных. */
export function te(key: string): boolean {
  return i18n.global.te(key);
}

/** Текущий язык интерфейса (для `Intl` и заголовка `Accept-Language`). */
export function currentLocale(): string {
  // У глобального переводчика в режиме Composition язык — ref; unref снимает
  // разницу типов между режимами.
  const locale = unref(i18n.global.locale as unknown as string);
  return locale === PSEUDO_LOCALE ? DEFAULT_LOCALE : locale;
}

/**
 * Тег языка для `Intl` и `toLocale*String` — даты и числа по правилам языка
 * интерфейса: `value.toLocaleString(uiLocale())` вместо зашитого `'ru-RU'`.
 */
export function uiLocale(): string {
  return intlLocale(currentLocale());
}
