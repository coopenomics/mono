import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Доменный интерфейс для создания исходящего платежа
 */
export interface CreateOutgoingPaymentInputDomainInterface {
  coopname: string;
  username: string;
  quantity: string;
  symbol: string;
  method_id: string;
  memo?: string;
  statement: ISignedDocument;
}
