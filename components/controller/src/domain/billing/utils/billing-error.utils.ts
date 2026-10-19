import { t } from '~/i18n';
/**
 * Перевод отказов на человеческий язык для истории списаний.
 *
 * Пайщик видит журнал в своём кабинете, а нода отвечает текстом вида
 * `assertion failure with message: walletop TRANSFER: недостаточно средств на
 * кошельке w.wal.bill` — это отладочный след контракта, а не объяснение. Здесь
 * известные отказы превращаются в одну понятную фразу; сырое сообщение при этом
 * не выбрасывается — оно остаётся в журнале и показывается подсказкой, по нему
 * разбираются с узлом.
 *
 * ⚠️ Сопоставление идёт по ТЕКСТУ отказа, потому что другого сигнала сейчас нет:
 * контракт биллинга кодов ошибок не возвращает, нода отдаёт строку `assert`'а.
 * Это временно и хрупко — переформулировали текст в контракте, и правило
 * перестало срабатывать (отказ при этом не потеряется: неизвестное сообщение
 * показывается своей сутью, а сырой текст всегда остаётся в журнале).
 *
 * Когда в контракте появятся коды ошибок, правильный порядок такой: сначала
 * сопоставление по коду, а разбор текста остаётся фолбэком — записи, уже
 * лежащие в журнале, кода не имеют и читаться должны по-прежнему. Менять
 * придётся только эту функцию: наружу она отдаёт готовую фразу, и ни резолвер,
 * ни интерфейс о способе сопоставления не знают.
 */

/** Известные отказы: сначала более частные правила, потом общие. */
const RULES: Array<{ match: RegExp; text: string }> = [
  {
    match: /недостаточно (средств|available)/i,
    text: t('billing.paymentError.insufficientFunds'),
  },
  {
    match: /нет программных соглашений|program_id/i,
    text: t('billing.paymentError.agreementMissing'),
  },
  {
    match: /не найден|not found/i,
    text: t('billing.paymentError.walletNotFound'),
  },
  {
    // Нода отвергла транзакцию по своим лимитам (CPU/NET) или по сроку —
    // списание не состоялось, следующий тик повторит его сам.
    match: /executing for too long|max_transaction_cpu_usage|tx_cpu_usage_exceeded|tx_net_usage_exceeded/i,
    text: t('billing.paymentError.networkLag'),
  },
  {
    match: /expired transaction|transaction expired/i,
    text: t('billing.paymentError.blockMissed'),
  },
  {
    match: /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|socket hang up|network/i,
    text: t('billing.paymentError.serviceUnavailable'),
  },
  {
    match: /timeout|таймаут/i,
    text: t('billing.paymentError.nodeTimeout'),
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
    return detail ? t('billing.paymentError.chainRejectedDetail', { detail }) : t('billing.paymentError.chainRejected');
  }

  return text;
}
