// Epic 12 (Single-Hub v5): интерфейсы контракта billing.
// Контракт минимален и blockchain-blind: только convert/pay/migrate, без
// собственных таблиц (источник истины по payment_hash живёт на provider в
// таблице billing_invoice). Формат повторяет авто-генерируемые ABI-интерфейсы
// (eosio-abi2ts), поддерживается вручную до подключения контракта в общий
// abi2ts-пайплайн.

export type IAsset = string
export type IName = string
export type IChecksum256 = string
export type IPublicKey = string
export type ISignature = string
export type ITimePointSec = string
export type IUint32 = number
export type IUint64 = number | string

export interface ISignatureInfo {
  id: IUint32
  signed_hash: IChecksum256
  signer: IName
  public_key: IPublicKey
  signature: ISignature
  signed_at: ITimePointSec
  meta: string
}

export interface IDocument2 {
  version: string
  hash: IChecksum256
  doc_hash: IChecksum256
  meta_hash: IChecksum256
  meta: string
  signatures: ISignatureInfo[]
}

/**
 * Конвертация паевого взноса пайщика в членский на персональный биллинг-кошелёк
 * (`w.wal.bill`). Идемпотентна по `convert_hash` — детерминированный процесс-якорь
 * процесса billing::convert (используется и как `process_hash` в ledger2, и как
 * `package_hash` при `Soviet::make_complete_document`). Несёт подписанное
 * заявление пайщика (`document`, 1095.BillingConversionStatement).
 */
export interface IConvert {
  coopname: IName
  username: IName
  amount: IAsset
  convert_hash: IChecksum256
  document: IDocument2
}

/**
 * Списание с биллинг-кошелька пайщика суммарной стоимости подписок в
 * инфраструктурный кошелёк кооператива. Идемпотентно по `payment_hash`.
 * Состав и цены подписок on-chain не хранятся (зона оператора).
 */
export interface IPay {
  coopname: IName
  username: IName
  amount: IAsset
  payment_hash: IChecksum256
  memo: string
}

/**
 * Сервисное действие миграции таблиц контракта (no-op в v5 — таблиц нет).
 */
export interface IMigrate {
}
