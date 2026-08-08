import { BadRequestException } from '@nestjs/common';
import type { MarketplaceUnitOfMeasure } from '../../domain/entities/marketplace-offer.types';
import { MARKETPLACE_UNIT_PRECISION } from './quantity.util';

/**
 * Денежная арифметика «Стола заказов» — зеркало контрактной.
 *
 * Контракт считает деньги целыми числами копеек (`Marketplace::calc_cost`,
 * `Marketplace::pro_rata`): умножение в целых, деление с округлением половины
 * вверх. Контроллер считал те же суммы умножением double с `toFixed`, и
 * результаты расходились на копейку — а суммы попадают в подписанные
 * документы (акты приёмки и выдачи, заявление на возврат) и в записи БД,
 * которые сверяются с цепью. Расхождение подписанного документа и цепи
 * недопустимо, поэтому обе стороны считают по одной формуле.
 *
 * Все функции работают в «младших единицах»: деньги — копейки (10^decimals),
 * количество — младшая единица измерения (граммы/миллилитры/штуки,
 * 10^precision единицы). Наружу отдаётся десятичная строка нужной точности.
 */

/** Десятичная строка («150.0000») → целое в младших единицах. */
export function decimalStringToMinor(raw: string, decimals: number): bigint {
  const matched = /^\s*(-?)(\d+)(?:[.,](\d*))?\s*$/.exec(raw);
  if (!matched) {
    throw new BadRequestException(`Некорректная десятичная величина: "${raw}"`);
  }
  const [, sign, intPart, fracRaw = ''] = matched;
  const dropped = fracRaw.slice(decimals);
  if (dropped.replace(/0/g, '').length > 0) {
    throw new BadRequestException(
      `Величина "${raw}" точнее ${decimals} знаков после запятой — округление изменило бы сумму`
    );
  }
  const frac = `${fracRaw}${'0'.repeat(decimals)}`.slice(0, decimals);
  const value = BigInt(`${intPart}${frac}`);
  return sign === '-' ? -value : value;
}

/**
 * Число с плавающей точкой → целое в младших единицах. Количества приходят из
 * БД и GraphQL числами, поэтому допускается двоичный «хвост» в пределах
 * половины младшей единицы; всё, что точнее заявленной точности, — ошибка
 * ввода, а не погрешность представления.
 */
export function numberToMinor(value: number, scale: number, what = 'величина'): bigint {
  if (!Number.isFinite(value)) {
    throw new BadRequestException(`Некорректная ${what}: "${value}"`);
  }
  const scaled = value * 10 ** scale;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > 1e-6) {
    throw new BadRequestException(
      `Значение «${value}» точнее ${scale} знаков после запятой — ${what} так не задаётся`
    );
  }
  return BigInt(rounded);
}

/** Целое в младших единицах → десятичная строка («1500000» → «150.0000»). */
export function minorToDecimalString(minor: bigint, decimals: number): string {
  const negative = minor < 0n;
  const digits = (negative ? -minor : minor).toString().padStart(decimals + 1, '0');
  const intPart = digits.slice(0, digits.length - decimals);
  const fracPart = decimals > 0 ? `.${digits.slice(digits.length - decimals)}` : '';
  return `${negative ? '-' : ''}${intPart}${fracPart}`;
}

/** Денежная строка/число → копейки. */
export function moneyToMinor(value: string | number, decimals: number): bigint {
  return typeof value === 'string'
    ? decimalStringToMinor(value, decimals)
    : numberToMinor(value, decimals, 'сумма');
}

/** Витринное количество в базовой единице → младшие единицы измерения. */
export function quantityToMinor(quantity: number, unit: MarketplaceUnitOfMeasure): bigint {
  const precision = MARKETPLACE_UNIT_PRECISION[unit];
  if (precision === undefined) {
    throw new BadRequestException(
      `Неизвестная единица измерения «${unit}» — количество не пересчитать в сумму`
    );
  }
  return numberToMinor(quantity, precision, 'количество');
}

/** Деление с округлением половины вверх — как в контракте. */
function divideHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new BadRequestException('Некорректная база для расчёта доли суммы');
  }
  return (numerator + denominator / 2n) / denominator;
}

/**
 * Стоимость по количеству и цене единицы отпуска — зеркало
 * `Marketplace::calc_cost`:
 *  - по мере (`packageSize` 0): цена за базовую единицу, произведение делится
 *    на масштаб единицы с округлением половины вверх;
 *  - упаковкой: цена за упаковку, число упаковок × цена — деление точное,
 *    копейка не округляется (кратность гарантируют гарды упаковки).
 */
export function calcCostMinor(params: {
  quantity: number;
  unit: MarketplaceUnitOfMeasure;
  unitPrice: string | number;
  packageSize?: number | null;
  decimals: number;
}): bigint {
  const { quantity, unit, unitPrice, packageSize, decimals } = params;
  const quantityMinor = quantityToMinor(quantity, unit);
  const priceMinor = moneyToMinor(unitPrice, decimals);

  if (packageSize && packageSize > 0) {
    const packageMinor = quantityToMinor(packageSize, unit);
    if (quantityMinor % packageMinor !== 0n) {
      throw new BadRequestException('Количество должно быть кратно размеру упаковки.');
    }
    return (quantityMinor / packageMinor) * priceMinor;
  }

  const scale = 10n ** BigInt(MARKETPLACE_UNIT_PRECISION[unit]);
  return divideHalfUp(quantityMinor * priceMinor, scale);
}

/** То же, что `calcCostMinor`, но десятичной строкой («450.0000»). */
export function calcCostAmount(params: {
  quantity: number;
  unit: MarketplaceUnitOfMeasure;
  unitPrice: string | number;
  packageSize?: number | null;
  decimals: number;
}): string {
  return minorToDecimalString(calcCostMinor(params), params.decimals);
}

/**
 * Доля суммы, пропорциональная части от целого — зеркало
 * `Marketplace::pro_rata`. Применяется там, где сумму нельзя пересчитать от
 * цены, а надо разделить ровно так, как она сложилась: стоимость возвращаемой
 * части выданного, доля членского взноса. При part == whole возвращает
 * исходную сумму без потери копейки.
 */
export function proRataMinor(totalMinor: bigint, part: bigint, whole: bigint): bigint {
  return divideHalfUp(totalMinor * part, whole);
}

/** Доля суммы по отношению количеств (в одной и той же единице измерения). */
export function proRataByQuantity(params: {
  total: string | number;
  part: number;
  whole: number;
  unit: MarketplaceUnitOfMeasure;
  decimals: number;
}): string {
  const { total, part, whole, unit, decimals } = params;
  const result = proRataMinor(
    moneyToMinor(total, decimals),
    quantityToMinor(part, unit),
    quantityToMinor(whole, unit)
  );
  return minorToDecimalString(result, decimals);
}

/** Доля суммы по отношению сумм (например, доля взноса в стоимости заказа). */
export function proRataByMoney(params: {
  total: string | number;
  part: string | number;
  whole: string | number;
  decimals: number;
}): string {
  const { total, part, whole, decimals } = params;
  const result = proRataMinor(
    moneyToMinor(total, decimals),
    moneyToMinor(part, decimals),
    moneyToMinor(whole, decimals)
  );
  return minorToDecimalString(result, decimals);
}

/** Сумма денежных величин без накопления погрешности double. */
export function sumMoney(values: Array<string | number>, decimals: number): string {
  const total = values.reduce<bigint>((acc, v) => acc + moneyToMinor(v, decimals), 0n);
  return minorToDecimalString(total, decimals);
}

/** Сравнение денежных величин: -1 / 0 / 1. */
export function compareMoney(a: string | number, b: string | number, decimals: number): number {
  const left = moneyToMinor(a, decimals);
  const right = moneyToMinor(b, decimals);
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
