/**
 * Реквизиты подписи под документом: кто, когда и чем подписал.
 *
 * Переехал из контроллера вместе с контрактом подписанного документа:
 * зависимостей нет, а расширению путь `~/domain/**` недоступен.
 */
// Новые интерфейсы для обновленной версии документов
export interface ISignatureInfo {
  id: number;
  signed_hash: string;
  signer: string; // eosio::name в виде строки
  public_key: string;
  signature: string;
  signed_at: string; // time_point_sec в виде строки
  meta: string;
}
