/**
 * Доменный интерфейс подготовки исходящего платежа по инвестированию
 * средств кооператива в ЦПП оператора платформы.
 */
export interface PrepareInvestmentInputDomainInterface {
  coopname: string;
  quantity: number;
  symbol: string;
  payment_hash: string;
  /** Реквизиты получателя (оператора) текстом — для отображения кассиру */
  payment_details_data: string;
  /** Назначение платежа */
  memo: string;
}
