/**
 * @coopenomics/i18n — общая основа интернационализации платформы.
 *
 * Здесь живут: список языков, правила множественного числа, общие словари
 * (`common`, `validation`, `errors`), слияние словарей, переводчик на ядре
 * vue-i18n (`@intlify/core-base`) для кода без Vue, псевдолокаль
 * и форматирование чисел.
 *
 * desktop подключает те же словари и правила в vue-i18n, controller
 * и уведомления — через `@coopenomics/i18n/server`. Формат сообщений
 * у всех один: `{name}`, `{0}`, формы через `|`, ссылки `@:key`.
 */
import common from './messages/ru/common.json';
import errors from './messages/ru/errors.json';
import validation from './messages/ru/validation.json';
import { mergeMessages, type LocaleMessages, type MessageTree } from './messages';

export * from './locales';
export * from './plural';
export * from './messages';
export * from './pseudo';
export * from './format';
export * from './translator';

/**
 * Общие словари пакета по языкам. Каждый потребитель сливает их со своими:
 * `mergeMessages(structuredClone(coreMessages.ru), own)`.
 */
export const coreMessages: LocaleMessages = {
  ru: [common, validation, errors].reduce<MessageTree>(
    (acc, tree, i) => mergeMessages(acc, tree as MessageTree, ['common', 'validation', 'errors'][i]),
    {},
  ),
};
