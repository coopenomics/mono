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

/** Цена услуги за её период: для пакетной — цена одного пакета, для годовой — за год. */
export const subscriptionPeriodPrice = (sub: ProviderSubscription): number => {
  const price = Number((sub as { price?: number | string }).price ?? 0);
  return Number.isFinite(price) ? price : 0;
};

/** Период оплаты услуги в днях; годовая оплата тарифа — 365. */
const subscriptionPeriodDays = (sub: ProviderSubscription): number => {
  const days = Number((sub as { period_days?: number }).period_days ?? 30);
  return Number.isFinite(days) && days > 0 ? days : 30;
};

/** Годовая оплата: период услуги длиннее месяца. */
export const isYearlySubscription = (sub: ProviderSubscription): boolean => subscriptionPeriodDays(sub) > 31;

/**
 * Плата за услугу в пересчёте на месяц: годовая цена делится на двенадцать,
 * иначе итог «в месяц» складывал бы годовую цену с месячными.
 */
export const subscriptionMonthlyPrice = (sub: ProviderSubscription): number => {
  const price = subscriptionPeriodPrice(sub);
  return isYearlySubscription(sub) ? Math.round(price / 12) : price;
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

/**
 * Пакетная услуга, у которой подошёл срок очередного платежа: провайдер
 * спишет её тем же прогоном, что и просроченные подписки, и раньше них.
 * Без неё «пополните на N» занижал сумму: кооператив вносил ровно N, пакет
 * забирал своё первым, и на просрочку снова не хватало (27.10.2026).
 */
export const isPackageDue = (sub: ProviderSubscription): boolean => {
  if (isFreeSubscription(sub) || isCancelled(sub)) return false;
  if (String((sub as { kind?: string }).kind ?? '') !== 'package') return false;
  const due = (sub as { next_payment_due?: string | null }).next_payment_due;
  if (!due) return false;
  const at = new Date(due).getTime();
  return Number.isFinite(at) && at <= Date.now();
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
  const sum = (list: ProviderSubscription[], price: (s: ProviderSubscription) => number) =>
    list.reduce((acc, s) => acc + price(s), 0);

  // К оплате при просрочке — полная цена периода (годовая — за год) плюс
  // пакет, которому подошёл срок; плата в месяц — с годовой ценой,
  // пересчитанной на месяц.
  const dueTotal = sum(overdue, subscriptionPeriodPrice) + sum(payable.filter(isPackageDue), subscriptionPeriodPrice);
  return {
    monthlyTotal: sum(payable, subscriptionMonthlyPrice),
    dueTotal,
    overdue,
    hasDue: dueTotal > 0,
  };
}
