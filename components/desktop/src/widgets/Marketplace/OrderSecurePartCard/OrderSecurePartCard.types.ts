import type { Zeus } from '@coopenomics/sdk';

/** Обеспечительная часть заказа — как её отдаёт карточка одного заказа. */
export interface OrderSecurePart {
  state: Zeus.MarketplaceSecurePartState;
  amount: string;
  charge_at?: unknown;
  settled_at?: unknown;
  /** Списано в членский взнос участка (после прогона первого числа). */
  charged_amount?: string;
  /** Возвращено пайщику на свободный паевой Стола заказов по итогу месяца. */
  returned_amount?: string;
  /** Коэффициент экономического участия за месяц, проценты; пусто до списания. */
  rate_percent?: string | null;
}
