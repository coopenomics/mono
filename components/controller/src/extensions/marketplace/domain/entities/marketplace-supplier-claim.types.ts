import type { ISignedDocument } from '@coopenomics/innercoop';
import type { MarketplaceReturnClaimPhoto } from './marketplace-return-claim.types';

/**
 * Гарантийная претензия поставщику (компонент 68, задача 99D-13).
 *
 * Возникает по решению совета об отмене сделки (`onmktrtauth`) по заказу с
 * внешним поставщиком: кооператив оплатил имущество, а оно вернулось на склад
 * участка по рекламации пайщика. Зеркало on-chain `marketplace::claims`
 * (hash = хэш рекламации = process_hash процесса p.mkt.claim):
 *
 *   PENDING  ↔ pending   — выставлена, ждёт ответа поставщика
 *   ADMITTED ↔ admitted  — поставщик признал (или срок ответа истёк при
 *                          включённом автоприёме): долг к удержанию из выплат
 *   REFUSED  ↔ refused   — поставщик отказал: основание для иска
 */
export const MarketplaceSupplierClaimStatuses = {
  PENDING: 'PENDING',
  ADMITTED: 'ADMITTED',
  REFUSED: 'REFUSED',
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
  /** Момент решения совета — от него считается срок автоприёма. */
  issued_at: Date;
  decided_at: Date | null;
  refuse_reason: string | null;
  /** Претензия признана автоматически по истечении срока ответа. */
  auto_admitted: boolean;
  issue_tx_hash: string;
  decide_tx_hash: string | null;
  created_at: Date;
  updated_at: Date;
}
