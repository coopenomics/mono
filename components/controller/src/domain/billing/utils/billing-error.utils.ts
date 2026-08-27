/**
 * Перевод отказов на человеческий язык для истории списаний.
 *
 * Пайщик видит журнал в своём кабинете, а нода отвечает текстом вида
 * `assertion failure with message: walletop TRANSFER: недостаточно средств на
 * кошельке w.wal.bill` — это отладочный след контракта, а не объяснение. Здесь
 * известные отказы превращаются в одну понятную фразу; сырое сообщение при этом
 * не выбрасывается — оно остаётся в журнале и показывается подсказкой, по нему
 * разбираются с узлом.
 */

/** Известные отказы: сначала более частные правила, потом общие. */
const RULES: Array<{ match: RegExp; text: string }> = [
  {
    match: /недостаточно (средств|available)/i,
    text: 'Недостаточно средств на кошельке кооператива',
  },
  {
    match: /нет программных соглашений|program_id/i,
    text: 'Кооператив не подписал соглашение о списании взносов',
  },
  {
    match: /не найден|not found/i,
    text: 'Кооператив или кошелёк не найдены в реестре',
  },
  {
    match: /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|socket hang up|network/i,
    text: 'Сервис оплаты временно недоступен',
  },
  {
    match: /timeout|таймаут/i,
    text: 'Узел не ответил вовремя — списание могло не дойти',
  },
];

/**
 * @param raw сырое сообщение из журнала (может отсутствовать)
 * @returns человеческая причина или undefined, если объяснять нечего
 */
export function humanizeBillingError(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const text = String(raw).trim();
  if (!text) return undefined;

  for (const rule of RULES) {
    if (rule.match.test(text)) return rule.text;
  }

  // Незнакомый отказ контракта: показываем его суть без служебной обёртки
  // `assertion failure with message:` — она пайщику ничего не сообщает.
  const assertion = text.match(/assertion failure with message:\s*(.+)$/i);
  if (assertion) {
    const detail = assertion[1].trim();
    return detail ? `Блокчейн отклонил списание: ${detail}` : 'Блокчейн отклонил списание';
  }

  return text;
}
