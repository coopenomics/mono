/**
 * Удержание НДФЛ с материальной помощи — то же правило, что на бэкенде и в
 * контракте (`BranchNdfl` в contracts/cpp/lib/core/branch/ndfl.hpp,
 * `ndfl.util.ts` в контроллере). Здесь расчёт нужен только чтобы показать
 * доверенному разбивку до подписания заявления: сумма, которую он увидит на
 * счёте, меньше той, что он вписал.
 *
 * Канон (решение владельца 2026-08-13): считаем от суммы заявления —
 * с персонального кошелька спишется вся она, на счёт придёт остаток.
 * Ставка 13 %, вычеты не применяются, налог округляется до полного рубля
 * (п. 6 ст. 52 НК РФ).
 */

/** Ставка налога на доходы физических лиц, процентов. */
export const NDFL_RATE_PERCENT = 13;

/** Налог с суммы заявления — целое число рублей. */
export function ndflTax(gross: number): number {
  if (!Number.isFinite(gross) || gross <= 0) return 0;
  // Считаем в минорных единицах — так же, как контракт: на половине рубля
  // дробная арифметика округлила бы в другую сторону.
  const rouble = 10000;
  const minor = Math.round(gross * rouble);
  const denominator = 100 * rouble;
  return Math.floor((minor * NDFL_RATE_PERCENT + denominator / 2) / denominator);
}

/** Сумма, которая придёт получателю на счёт. */
export function ndflNet(gross: number): number {
  return gross - ndflTax(gross);
}
