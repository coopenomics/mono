import type { Zeus } from '@coopenomics/sdk';

/** Обеспечительная часть заказа — как её отдаёт карточка одного заказа. */
export interface OrderSecurePart {
  state: Zeus.MarketplaceSecurePartState;
  amount: string;
  charge_at?: unknown;
  settled_at?: unknown;
}
