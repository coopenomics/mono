/**
 * Текст для банковского поручения: назначение платежа, строка QR-кода оплаты.
 *
 * Банки не принимают букву «ё» в назначении платежа: пайщик копирует
 * назначение в банк, и поручение с «Цифровой Кошелёк» или «аванс под отчёт»
 * отклоняется (владелец 06.11.2026). Буква заменяется на «е» там, где
 * назначение записывается в платёж, заявку на выплату или реквизиты, — один
 * раз и для всех источников: подписи в словарях и тексты интерфейса остаются
 * с «ё», меняется только текст, который передаётся в банк.
 */
export function bankSafeText(text: string): string;
export function bankSafeText(text: string | null | undefined): string | null | undefined;
export function bankSafeText(text: string | null | undefined): string | null | undefined {
  if (text == null) return text;
  return text.replace(/ё/g, 'е').replace(/Ё/g, 'Е'); // i18n-ignore: замена буквы для банка, не текст интерфейса
}
