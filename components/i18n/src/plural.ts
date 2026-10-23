/**
 * Правила множественного числа в формате vue-i18n: сообщение перечисляет
 * формы через `|`, правило выбирает номер формы по числу.
 *
 * Русский — три формы: `{n} день | {n} дня | {n} дней` (1, 2–4, 5–20).
 * Четыре формы добавляют отдельную форму для нуля первой:
 * `нет дней | {n} день | {n} дня | {n} дней`.
 * Дробное число берёт вторую форму: «1,5 часа».
 */
export type PluralRule = (choice: number, choicesLength: number) => number;

/** Номер русской формы: 0 — один, 1 — два-четыре и дроби, 2 — пять и больше. */
export function ruPluralIndex(choice: number): 0 | 1 | 2 {
  const n = Math.abs(choice);
  if (!Number.isInteger(n)) return 1;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 0;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 1;
  return 2;
}

export const ruPluralRule: PluralRule = (choice, choicesLength) => {
  if (choicesLength === 4) return choice === 0 ? 0 : 1 + ruPluralIndex(choice);
  if (choicesLength === 3) return ruPluralIndex(choice);
  if (choicesLength === 2) return Math.abs(choice) === 1 ? 0 : 1;
  return 0;
};

export const pluralRules: Record<string, PluralRule> = {
  ru: ruPluralRule,
  'ru-XA': ruPluralRule,
};
