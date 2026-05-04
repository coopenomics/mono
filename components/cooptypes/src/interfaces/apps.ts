// Generated from contracts/cpp/apps/apps.abi (eosio::abi/1.2)
// Hand-written: eosio-abi2ts 1.2.2 не поддерживает optional-типы (`name?`, `checksum256?`),
// которые используются в action `setcoop` для частичного обновления полей.

export type IName = string
export type IChecksum256 = string
export type IPublicKey = string
export type ITimePointSec = string
export type IUint64 = number | string

/**
 * Структура scope релиза. `kind` — `"all"` | `"subnet"` | `"canary"`.
 * Для `kind="all"` `targets` — пустой массив, для `subnet`/`canary` —
 * список chain_id'ов или имён подсетей.
 */
export interface IScope {
  kind: IName
  targets: IName[]
}

// ── Tables ─────────────────────────────────────────────────────────────────

/**
 * Реестр зарегистрированных пакетов.
 */
export interface IPackage {
  package_id: IName
  package_name: string
  owner: IName
  compatible_subnets: IName[]
  last_active_version: string
  created_at: ITimePointSec
  updated_at: ITimePointSec
}

/**
 * Релиз пакета. `status` — `"active"` | `"superseded"` | `"withdrawn"`.
 */
export interface IRelease {
  id: IUint64
  package_id: IName
  version: string
  scope: IScope
  status: IName
  published_at: ITimePointSec
  superseded_at: ITimePointSec
  moderated_by: IName
  tarball_sha256: IChecksum256
  meta: string
}

/**
 * Подписка кооператива на пакет в конкретной подсети.
 */
export interface ISub {
  id: IUint64
  coopname: IName
  package_id: IName
  chain_id: IChecksum256
  plan: IName
  active: boolean
  start_at: ITimePointSec
  end_at: ITimePointSec
  created_at: ITimePointSec
  updated_at: ITimePointSec
}

/**
 * Кооператив, подключённый к каталогу. `signing_key` — отдельный subnet-signing-key,
 * не равный `eosio::active`.
 */
export interface ICoop {
  coopname: IName
  chain_id: IChecksum256
  subnet_label: IName
  signing_key: IPublicKey
  active: boolean
  registered_at: ITimePointSec
  key_rotated_at: ITimePointSec
}

// ── Actions ────────────────────────────────────────────────────────────────

export interface IRegpackage {
  coopname: IName
  package_id: IName
  package_name: string
  owner: IName
  compatible_subnets: IName[]
}

export interface ITransferpkg {
  coopname: IName
  package_id: IName
  new_owner: IName
}

export interface ISetrelease {
  coopname: IName
  package_id: IName
  version: string
  scope: IScope
  tarball_sha256: IChecksum256
  moderated_by: IName
  meta: string
}

export interface IReactivate {
  coopname: IName
  package_id: IName
  version: string
}

export interface IWithdraw {
  coopname: IName
  package_id: IName
  version: string
  reason: string
}

export interface ICleanup {
  package_id: IName
}

export interface IRegsub {
  coopname: IName
  subscriber: IName
  package_id: IName
  chain_id: IChecksum256
  plan: IName
  start_at: ITimePointSec
  end_at: ITimePointSec
}

export interface IExpsub {
  coopname: IName
  subscriber: IName
  package_id: IName
}

export interface IRegcoop {
  coopname: IName
  chain_id: IChecksum256
  subnet_label: IName
  signing_key: IPublicKey
}

/**
 * Все поля кроме `coopname` опциональны — позволяют частично обновлять row в `coops`,
 * включая ротацию `signing_key`.
 */
export interface ISetcoop {
  coopname: IName
  chain_id?: IChecksum256
  subnet_label?: IName
  signing_key?: IPublicKey
  active?: boolean
}

export interface IMigrate {}
