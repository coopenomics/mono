import type { ProviderSubscription } from './index';

/**
 * Сводка платы за подписки провайдера: сколько кооператив платит в месяц и
 * сколько должен внести прямо сейчас.
 *
 * Считается в одном месте, потому что обе величины нужны и реестру подписок
 * (итог таблицы), и карточке просрочки («оплатите N ₽»): разъехавшиеся суммы
 * в двух местах одного экрана хуже, чем отсутствие суммы вовсе.
 */

/** Услуга включена оператором: встречного платежа нет, в сумму не идёт. */
export const isFreeSubscription = (sub: ProviderSubscription): boolean =>
  Number((sub as { price?: number | string }).price ?? 0) === 0;

/** Отменённая подписка не платится и в сводке не участвует. */
const isCancelled = (sub: ProviderSubscription): boolean =>
  String((sub as { status?: string }).status ?? '').toLowerCase().startsWith('cancel');

/** Плата за услугу в месяц: для пакетной — цена одного пакета. */
export const subscriptionMonthlyPrice = (sub: ProviderSubscription): number => {
  const price = Number((sub as { price?: number | string }).price ?? 0);
  return Number.isFinite(price) ? price : 0;
};

/**
 * Подписка просрочена: провайдер уже перевёл её в EXPIRED либо срок вышел, а
 * цикл биллинга ещё не добежал. Второй случай важен: между истечением и
 * прогоном крона кооператив видел бы «активна» и не понимал, за что просят
 * денег.
 */
export const isOverdueSubscription = (sub: ProviderSubscription): boolean => {
  if (isFreeSubscription(sub) || isCancelled(sub)) return false;
  const status = String((sub as { status?: string }).status ?? '').toLowerCase();
  if (status === 'expired' || status === 'pending') return true;
  // Пакетная услуга (документооборот) живёт вне календаря: она платится по
  // мере расхода AXON, и её срок ничего не значит — просрочкой считается
  // только неоплаченный пакет, а это уже отражено статусом выше.
  if (String((sub as { kind?: string }).kind ?? '') === 'package') return false;
  const expires = (sub as { expires_at?: string }).expires_at;
  if (!expires) return false;
  const at = new Date(expires).getTime();
  return Number.isFinite(at) && at < Date.now();
};

export interface SubscriptionsBillingSummary {
  /** Плата за месяц по всем платным подпискам. */
  monthlyTotal: number;
  /** Сколько нужно внести сейчас, чтобы закрыть просрочку. */
  dueTotal: number;
  /** Просроченные услуги — их и перечисляем в карточке оплаты. */
  overdue: ProviderSubscription[];
  /** Есть ли что оплачивать прямо сейчас. */
  hasDue: boolean;
}

export function summarizeSubscriptions(
  subscriptions: ProviderSubscription[],
): SubscriptionsBillingSummary {
  const payable = subscriptions.filter((s) => !isFreeSubscription(s) && !isCancelled(s));
  const overdue = payable.filter(isOverdueSubscription);
  const sum = (list: ProviderSubscription[]) =>
    list.reduce((acc, s) => acc + subscriptionMonthlyPrice(s), 0);

  const dueTotal = sum(overdue);
  return {
    monthlyTotal: sum(payable),
    dueTotal,
    overdue,
    hasDue: dueTotal > 0,
  };
}
