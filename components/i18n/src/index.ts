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
export * from './locales';
export * from './plural';
export * from './messages';
export * from './pseudo';
export * from './format';
export * from './translator';
export * from './core';
export * from './library';
