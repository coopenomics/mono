import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

/**
 * Доменный интерфейс для создания заявки кооператива на инвестирование
 * собственных средств в ЦПП кооператива-оператора платформы
 */
export interface CreateCooperativeInvestmentInputDomainInterface {
  coopname: string;
  quantity: number;
  symbol: string;
  statement: ISignedDocumentDomainInterface;
  payment_hash: string; // Хеш платежа (invest_hash), генерируется на фронтенде
}
