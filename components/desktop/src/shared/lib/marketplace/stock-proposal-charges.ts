/** Числовое значение актива «1234.5678 RUB» для сравнений и расчётов. */
export function parseAssetAmount(value: string | null | undefined): number {
  if (!value) return 0;
  const numeric = value.trim().split(/\s+/)[0]?.replace(/[^\d.-]/g, '') ?? '';
  const n = Number.parseFloat(numeric);
  return Number.isFinite(n) ? n : 0;
}

export interface StockProposalChargeSums {
  member_amount: string;
  convert_amount: string | null;
}

/**
 * Разложение списания по бандлу выдачи для гейта «подпись на месте»:
 * членский — только если > 0; паевой — всегда (конвертация при подписи +
 * уже профондированные заказы).
 */
export function computeStockProposalCharges(
  totalCost: string | number,
  sums?: StockProposalChargeSums | null,
): { member: number; share: number } {
  const total = Number.parseFloat(String(totalCost)) || 0;
  if (!sums) {
    return { member: 0, share: total };
  }
  const member = parseAssetAmount(sums.member_amount);
  const convert = parseAssetAmount(sums.convert_amount);
  const share =
    convert > 0 ? convert + Math.max(0, total - member - convert) : Math.max(0, total - member);
  return { member, share };
}
