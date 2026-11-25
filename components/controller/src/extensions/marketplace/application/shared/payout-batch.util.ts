import { createHash, randomUUID } from 'node:crypto';
import { isStandTimeCompressed, standDaySeconds, timeZoneOffsetMs } from '@coopenomics/extension-kit';
import { t } from '../../i18n';

/**
 * Пакет выплаты поставщику (решение владельца 19.11.2026): помощники обхода
 * выплат — отсечка суток, хэш пакета, разбивка заказов на транзакции, подпись
 * основания выплаты в уведомлениях.
 */

/**
 * Начало суток, в которые попадает момент: в работе — полночь по поясу
 * кооператива, на стенде со сжатым временем — начало отрезка длиной в сутки
 * стенда (`STAND_DAY_SECONDS`). Заказы, принятые до этого момента, обход
 * объединяет в пакет; принятые позже ждут следующих суток.
 */
export function payoutDayStart(now: Date, timeZone: string): Date {
  if (isStandTimeCompressed()) {
    const dayMs = standDaySeconds() * 1000;
    return new Date(Math.floor(now.getTime() / dayMs) * dayMs);
  }
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const utcMidnight = Date.UTC(get('year'), get('month') - 1, get('day'));
  return new Date(utcMidnight - timeZoneOffsetMs(new Date(utcMidnight), timeZone));
}

/**
 * Хэш нового пакета — ключ строки `payouts` и outcome_hash исходящего платежа
 * в gateway. Случайная часть делает хэш уникальным и при повторе обхода в те
 * же сутки (пакет отклонён и собран заново).
 */
export function newPayoutHash(coopname: string, payee: string, dayStart: Date): string {
  return createHash('sha256').update(`${coopname}:${payee}:${dayStart.toISOString()}:${randomUUID()}`).digest('hex');
}

/**
 * Заказов в одной транзакции пакета: действие на заказ лёгкое, но время
 * транзакции ограничено: сотню заказов поставщика за день обход включает в
 * один открытый пакет несколькими транзакциями.
 */
export const PAYOUT_ACTIONS_PER_TRANSACTION = 20;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** «по 1 заказу», «по 6 заказам»: основание выплаты в дательном падеже после «по». */
export function ordersDative(count: number): string {
  const n = Math.abs(Math.trunc(count));
  return n % 10 === 1 && n % 100 !== 11
    ? t('marketplace.payoutBatch.ordersDativeOne', { count: n })
    : t('marketplace.payoutBatch.ordersDativeMany', { count: n });
}
