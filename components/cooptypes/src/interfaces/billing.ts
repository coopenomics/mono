// Epic 12: интерфейсы контракта billing (оплата подписок членскими взносами).
// Формат повторяет авто-генерируемые ABI-интерфейсы (eosio-abi2ts), но billing
// мал и стабилен (ровно convert/pay/migrate + таблица payments), поэтому
// поддерживается вручную до подключения контракта в общий abi2ts-пайплайн.

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
 * (`w.wal.bill`). Несёт подписанное заявление пайщика (`document`).
 */
export interface IConvert {
  coopname: IName
  username: IName
  amount: IAsset
  convert_hash: IChecksum256
  document: IDocument2
}

/**
 * Epic 13 v5.1 — бездокументарная конвертация членского взноса в AXON
 * (членский → AXON по курсу 10:1 с эмиссией токена через eosio::injection).
 * Подпись `coopname@active`, автономно (PowerupPlugin coopback'а пайщика).
 * Идемпотентность по `payment_hash` — на стороне provider'а.
 */
export interface IConverttoaxn {
  coopname: IName
  amount: IAsset
  payment_hash: IChecksum256
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
 * Сервисное действие миграции таблиц контракта.
 */
export interface IMigrate {
}

/**
 * Строка реестра проведённых платежей (`payments`, scope = аккаунт контракта).
 * Anti-replay: повтор транзакции с тем же `payment_hash` отклоняется on-chain,
 * что исключает двойное списание средств при потере подтверждения инициатором.
 * Записи старше TTL подчищаются скользящим окном при каждой новой записи.
 */
export interface IPayment {
  id: IUint64
  payment_hash: IChecksum256
  paid_at: ITimePointSec
}
