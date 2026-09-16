import type { ISignedDocument } from '@coopenomics/innercoop';
import type { MarketplaceReturnClaimPhoto } from './marketplace-return-claim.types';

/**
 * Гарантийная претензия поставщику (компонент 68, задача 99D-13).
 *
 * Возникает по решению совета об отмене сделки (`onmktrtauth`) по заказу с
 * внешним поставщиком: кооператив оплатил имущество, а оно вернулось на склад
 * участка по рекламации пайщика. Зеркало on-chain `marketplace::claims`
 * (process_hash процесса p.mkt.claim):
 *
 *   PENDING  ↔ pending   — выставлена; поставщик по умолчанию не согласен,
 *                          сумма на кошельке непризнанных претензий (основание
 *                          для иска), кооператив ничего не делает
 *   ADMITTED ↔ admitted  — поставщик признал: долг к удержанию из выплат
 *
 * Несогласие в цепь не пишется: кнопка «Не согласен» лишь показывает
 * контакты участка, где лежит имущество.
 */
export const MarketplaceSupplierClaimStatuses = {
  PENDING: 'PENDING',
  ADMITTED: 'ADMITTED',
} as const;

export type MarketplaceSupplierClaimStatus =
  (typeof MarketplaceSupplierClaimStatuses)[keyof typeof MarketplaceSupplierClaimStatuses];

export interface MarketplaceSupplierClaimProps {
  id: string;
  coopname: string;
  /** Хэш рекламации — он же хэш претензии on-chain и нитка процесса p.mkt.claim. */
  claim_hash: string;
  /** Заявление на гарантийный возврат (marketplace_return_claim), из которого выросла претензия. */
  return_claim_id: string;
  order_id: string;
  order_hash: string;
  supplier_account: string;
  orderer_account: string;
  /** Участок, на котором принято имущество и где поставщик может его забрать. */
  delivery_braname: string;
  actual_quantity: number;
  /** Сумма претензии — стоимость возвращённого имущества. */
  amount: string;
  reason_text: string;
  /** Результат осмотра имущества оператором участка. */
  inspection_result: string;
  photos: MarketplaceReturnClaimPhoto[];
  /** Рекламация 1106 с двумя подписями — пайщика и оператора участка. */
  reclamation: ISignedDocument | null;
  status: MarketplaceSupplierClaimStatus;
  /** Момент решения совета — выставление претензии. */
  issued_at: Date;
  /** Момент признания поставщиком. */
  decided_at: Date | null;
  issue_tx_hash: string;
  decide_tx_hash: string | null;
  created_at: Date;
  updated_at: Date;
}
