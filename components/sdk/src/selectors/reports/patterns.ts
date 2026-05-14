/**
 * Regex-паттерны реквизитов ФНС/СФР для frontend-валидации.
 *
 * Источник истины — XSD-схемы ФНС/СФР в
 * `components/controller/src/extensions/reports/schemas/`. Менять паттерны
 * синхронно с зеркалом на бэке: `controller/src/extensions/reports/domain/patterns.ts`.
 *
 * TODO(infra): переехать в общий `cooptypes`, чтобы source of truth был один.
 */

/** ИНН: 10 (ЮЛ) или 12 (ФЛ/ИП) цифр. */
export const INN_PATTERN = /^(\d{10}|\d{12})$/;

/** ИНН юрлица (БУХОТЧ, ЕФС-1 УТ8). */
export const INN_UL_PATTERN = /^\d{10}$/;

/** КПП: 9 символов — 4 цифры + 2 [0-9A-Z] + 3 цифры. */
export const KPP_PATTERN = /^\d{4}[0-9A-Z]{2}\d{3}$/;

/** ОГРН ЮЛ (13), ОГРНИП (15). */
export const OGRN_PATTERN = /^(\d{13}|\d{15})$/;

/** ОГРН только ЮЛ: ровно 13 цифр. */
export const OGRN_UL_PATTERN = /^\d{13}$/;

/** ОКВЭД: XX, XX.X, XX.XX, XX.XX.X, XX.XX.XX. */
export const OKVED_PATTERN = /^\d{2}(\.\d{1,2}){0,2}$/;

/** ОКТМО: 8 или 11 цифр. */
export const OKTMO_PATTERN = /^\d{8}(\d{3})?$/;

/** ОКФС: 1-3 цифры. */
export const OKFS_PATTERN = /^\d{1,3}$/;

/** ОКОПФ: 5 цифр (ОК 011-2014). */
export const OKOPF_PATTERN = /^\d{5}$/;

/** ОКПО: 8 (ЮЛ) или 10 (ИП) цифр. */
export const OKPO_PATTERN = /^\d{8}(\d{2})?$/;

/** СНИЛС: XXX-XXX-XXX YY или 11 цифр подряд. */
export const SNILS_PATTERN = /^(\d{3}-\d{3}-\d{3} \d{2}|\d{11})$/;

/** Регистрационный номер СФР: XXX-XXX-XXXXXX (3-3-6). */
export const SFR_REG_NUMBER_PATTERN = /^\d{3}-\d{3}-\d{6}$/;

/** Дата в формате DD.MM.YYYY (ФНС). */
export const DATE_DDMMYYYY_PATTERN = /^\d{2}\.\d{2}\.\d{4}$/;

/** КБК — 20 цифр (налоговый/страховой код бюджетной классификации). */
export const KBK_PATTERN = /^\d{20}$/;

/**
 * Удобный shorthand: готовые Quasar-совместимые rules-функции.
 * Возвращают `true` при прохождении или строку с сообщением об ошибке.
 *
 * Использование:
 * ```vue
 * <q-input :rules="[reportRules.inn()]" />
 * ```
 */
export const reportRules = {
  inn: (message = 'ИНН — 10 или 12 цифр') => (v: unknown) => INN_PATTERN.test(String(v ?? '')) || message,
  innUl: (message = 'ИНН ЮЛ — 10 цифр') => (v: unknown) => INN_UL_PATTERN.test(String(v ?? '')) || message,
  kpp: (message = 'КПП — 4 цифры + 2 [0-9A-Z] + 3 цифры') => (v: unknown) => KPP_PATTERN.test(String(v ?? '')) || message,
  ogrn: (message = 'ОГРН — 13 цифр, ОГРНИП — 15') => (v: unknown) => OGRN_PATTERN.test(String(v ?? '')) || message,
  okved: (message = 'ОКВЭД — XX / XX.X / XX.XX / XX.XX.X / XX.XX.XX') => (v: unknown) => OKVED_PATTERN.test(String(v ?? '')) || message,
  oktmo: (message = 'ОКТМО — 8 или 11 цифр') => (v: unknown) => OKTMO_PATTERN.test(String(v ?? '')) || message,
  okfs: (message = 'ОКФС — 1-3 цифры') => (v: unknown) => OKFS_PATTERN.test(String(v ?? '')) || message,
  okopf: (message = 'ОКОПФ — 5 цифр') => (v: unknown) => OKOPF_PATTERN.test(String(v ?? '')) || message,
  okpo: (message = 'ОКПО — 8 или 10 цифр') => (v: unknown) => OKPO_PATTERN.test(String(v ?? '')) || message,
  snils: (message = 'СНИЛС — XXX-XXX-XXX YY или 11 цифр') => (v: unknown) => SNILS_PATTERN.test(String(v ?? '')) || message,
  sfrRegNumber: (message = 'Рег. номер СФР — XXX-XXX-XXXXXX') => (v: unknown) => SFR_REG_NUMBER_PATTERN.test(String(v ?? '')) || message,
  dateDdMmYyyy: (message = 'Дата — DD.MM.YYYY') => (v: unknown) => DATE_DDMMYYYY_PATTERN.test(String(v ?? '')) || message,
  kbk: (message = 'КБК — 20 цифр') => (v: unknown) => KBK_PATTERN.test(String(v ?? '')) || message,
  /** Непустая строка длиной от `min` до `max` символов. */
  length:
    (min: number, max: number, message?: string) =>
    (v: unknown) => {
      const s = String(v ?? '');
      if (s.length < min || s.length > max) {
        return message ?? `Длина ${min}..${max} символов`;
      }
      return true;
    },
  /** Опциональное поле: пустое значение проходит, иначе — проверка regex. */
  optionalRegex:
    (pattern: RegExp, message: string) =>
    (v: unknown) => {
      const s = String(v ?? '');
      if (!s) return true;
      return pattern.test(s) || message;
    },
};
