import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

/**
 * Единая ставка членского взноса Стола заказов (requirement b6).
 * UI показывает суммы с учётом взноса: каталог/корзина — цену с взносом,
 * выдача — возврат/доплату при расхождении факта с заказом.
 */
export async function getMembershipFeePercent(): Promise<number> {
  const { [Queries.Marketplace.GetEconomyConfig.name]: result } = await client.Query(
    Queries.Marketplace.GetEconomyConfig.query,
  );
  return result.membership_fee_percent;
}

/**
 * Цена с учётом членского взноса — единая формула для всех экранов заказчика
 * (каталог, деталь предложения, добавление в корзину, сводка корзины).
 */
export function applyMembershipFee(price: number, feePercent: number): number {
  return price * (1 + feePercent / 100);
}

export interface IssuanceDiffLine {
  /** Сумма позиции по заказу (заблокированный резерв без взноса). */
  orderedTotal: number;
  /** Фактическая сумма позиции к выдаче (факт × цена факта). */
  factTotal: number;
}

/**
 * Возврат/доплата при расхождении факта выдачи с заказом.
 *
 * Контракт при недовыдаче возвращает остаток резерва (заказ − факт) на членский
 * кошелёк «Стола заказов» вместе с пропорциональной частью членского взноса;
 * при факте больше заказа — добирает разницу и взнос с паевого. Здесь — оценка
 * для отображения от текущей ставки (точные суммы в целых единицах считает
 * контракт; ставка зафиксирована в заказе и совпадает с текущей, пока её не
 * меняли после оформления).
 */
export function computeIssuanceDiff(
  lines: IssuanceDiffLine[],
  feePercent: number,
): { refund: number; surcharge: number } {
  let refund = 0;
  let surcharge = 0;
  for (const l of lines) {
    const diff = l.orderedTotal - l.factTotal;
    if (diff > 0) refund += diff;
    else if (diff < 0) surcharge += -diff;
  }
  return { refund: applyMembershipFee(refund, feePercent), surcharge: applyMembershipFee(surcharge, feePercent) };
}
