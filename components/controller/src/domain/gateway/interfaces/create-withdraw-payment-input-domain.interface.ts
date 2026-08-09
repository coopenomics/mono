import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Доменный интерфейс для создания исходящего платежа (withdraw)
 */
export interface CreateWithdrawPaymentInputDomainInterface {
  coopname: string;
  username: string;
  quantity: number;
  symbol: string;
  method_id: string;
  statement: ISignedDocument;
  payment_hash: string; // Хеш платежа для связи с withdraw
}
