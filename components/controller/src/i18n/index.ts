/**
 * Переводчик контроллера.
 *
 * Словари: общие из `@coopenomics/i18n` (`common`, `validation`, `errors`),
 * ядра контроллера — `./locales/<язык>/<область>.json` (подключаются здесь
 * явным импортом, чтобы сборка положила их в dist), расширений — регистрирует
 * само расширение (`registerMessages` в своём модуле).
 *
 * Язык — язык текущего запроса (LocaleMiddleware), вне запроса — по умолчанию.
 *   throw DomainError.notFound('DOCUMENT_NOT_FOUND')      — отказ пайщику;
 *   t('payment.status.paid')                               — надпись для интерфейса.
 */
import { registerMessages } from '@coopenomics/i18n/server';
import cooperative from './locales/ru/cooperative.json';
import document from './locales/ru/document.json';
import freeDecision from './locales/ru/free-decision.json';

export {
  currentLocale,
  registerMessages,
  runWithLocale,
  t,
  te,
} from '@coopenomics/i18n/server';
export type { MessageKey } from './keys.generated';

export type DomainErrorParamsLike = Record<string, string | number | boolean | null | undefined>;

// Словари ядра контроллера. Новый файл в ./locales/ru — новая строка здесь;
// гейт `pnpm check:i18n` напомнит, если словарь не подключён.
const CORE_DICTIONARIES: Array<[string, Record<string, any>]> = [
  ['cooperative', cooperative],
  ['document', document],
  ['free-decision', freeDecision],
];

for (const [name, tree] of CORE_DICTIONARIES) registerMessages('ru', tree, `controller:${name}`);
