import type { ISignedDocumentDomainInterface } from '@coopenomics/innercoop';

/**
 * Доменный интерфейс для создания вывода средств (withdraw)
 */
export interface CreateWithdrawInputDomainInterface {
  coopname: string;
  username: string;
  quantity: number;
  symbol: string;
  method_id: string;
  statement: ISignedDocumentDomainInterface;
  payment_hash: string; // Хеш платежа, генерируется на фронтенде
}
