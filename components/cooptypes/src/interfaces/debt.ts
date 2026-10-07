// Описание действий и таблиц контракта debt — в формате eosio-abi2ts (eosio::abi/1.2).
// Источник — components/contracts/cpp/debt/debt.hpp и lib/domain/table_debt_*.hpp.

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

export interface ICreateloan {
  coopname: IName
  username: IName
  collateral: IName
  debt_hash: IChecksum256
  amount: IAsset
  due_at: ITimePointSec
  statement: IDocument2
  contract: IDocument2
}

export interface ILoanauth {
  coopname: IName
  debt_hash: IChecksum256
  decision: IDocument2
}

export interface ILoandecl {
  coopname: IName
  debt_hash: IChecksum256
  reason: string
}

export interface ILoansigned {
  coopname: IName
  username: IName
  debt_hash: IChecksum256
  signed_contract: IDocument2
}

export interface ILoansgndecl {
  coopname: IName
  username: IName
  debt_hash: IChecksum256
  reason: string
}

export interface ILoanpaid {
  coopname: IName
  debt_hash: IChecksum256
}

export interface ILoanpaydecl {
  coopname: IName
  debt_hash: IChecksum256
  reason: string
}

export interface IRetrypay {
  coopname: IName
  debt_hash: IChecksum256
}

export interface ICancelloan {
  coopname: IName
  debt_hash: IChecksum256
  reason: string
}

export interface IRepayloan {
  coopname: IName
  username: IName
  debt_hash: IChecksum256
  amount: IAsset
  statement: IDocument2
}

export interface IExtendloan {
  coopname: IName
  username: IName
  debt_hash: IChecksum256
  new_due_at: ITimePointSec
  statement: IDocument2
}

export interface ILoanextok {
  coopname: IName
  username: IName
  debt_hash: IChecksum256
  approved_statement: IDocument2
}

export interface ILoanextdecl {
  coopname: IName
  username: IName
  debt_hash: IChecksum256
  reason: string
}

export interface ISweep {
  coopname: IName
  limit: IUint32
}

export interface IRegloan {
  coopname: IName
  username: IName
  debt_hash: IChecksum256
  source_ref: IChecksum256
  amount: IAsset
  due_at: ITimePointSec
  statement: IDocument2
  contract: IDocument2
}

export interface ISettleloan {
  coopname: IName
  debt_hash: IChecksum256
  amount: IAsset
}

export interface IWroffloan {
  coopname: IName
  debt_hash: IChecksum256
}

export interface IMigrate {
}

export interface ICleanup {
}

export interface IDebt {
  id: IUint64
  coopname: IName
  username: IName
  status: IName
  debt_hash: IChecksum256
  collateral: IName
  source: IName
  source_ref: IChecksum256
  amount: IAsset
  remaining: IAsset
  pledged: IAsset
  created_at: ITimePointSec
  issued_at: ITimePointSec
  due_at: ITimePointSec
  requested_due_at: ITimePointSec
  overdue_at: ITimePointSec
  statement: IDocument2
  contract: IDocument2
  signed_contract: IDocument2
  decision: IDocument2
  extension_statement: IDocument2
  last_pay_error: string
  memo: string
}

export interface ISummary {
  username: IName
  total: IAsset
}
