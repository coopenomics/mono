// Hand-written from components/contracts/cpp/expense/expense.hpp (C28-29 v3, MVP — Благорост).
// До появления codegen из ABI этот файл = SoT для cooptypes/expense.
// При regen ABI заменить ровно тем же набором имён интерфейсов, не ломая публичный API.

export type IAsset = string
export type IName = string
export type IChecksum256 = string
export type ITimePointSec = string
export type IUint8 = number
export type IUint32 = number
export type IUint64 = number | string

/**
 * Документ document2 (signact1/signact2 — двухподписные акты).
 * Точная копия C++ struct document2 из components/contracts/cpp/lib/domain/document_core.hpp.
 */
export interface IDocument2 {
  version: string
  hash: IChecksum256
  doc_hash: IChecksum256
  meta_hash: IChecksum256
  meta: string
  signatures: ISignature2[]
}

export interface ISignature2 {
  id: IUint32
  signed_hash: IChecksum256
  signer: IName
  public_key: string
  signature: string
  signed_at: ITimePointSec
  meta: string
}

/**
 * Перечисления expense::* — в TS экспонируются как `number` (uint8), сами литералы
 * (`enum`) задаются на стороне backend extension (`expense-proposal-status.enum.ts`
 * + `expense-item-status.enum.ts` + `expense-mechanics.enum.ts` + `expense-recipient-type.enum.ts`).
 */

export interface IItem {
  item_hash: IChecksum256
  /** Mechanics (ADVANCE=0, DIRECT=1). */
  mechanics: IUint8
  /** RecipientType (SELF=0, MEMBER=1, ORG=2). */
  recipient_type: IUint8
  recipient: IName
  description: string
  planned_amount: IAsset
  actual_amount: IAsset
  /** ItemStatus (APPROVED=0, PAID=1, REPORTED=2, RETURNED=3, OVERSPENT=4). */
  status: IUint8
}

/**
 * Callback на финализацию closeexp. Пустой `contract` (`""`) = нет callback.
 * `data` — base16/hex (eosio bytes) либо base64 в зависимости от транспорта.
 */
export interface ICallbackHandler {
  contract: IName
  action: IName
  data: string
}

// ─────────────────────────── Actions ───────────────────────────

/**
 * createexp — создание и подача СЗ-расхода (signact1 statement_doc, type=2010).
 */
export interface ICreateexp {
  coopname: IName
  username: IName
  proposal_hash: IChecksum256
  source_wallet: IName
  items: IItem[]
  callback: ICallbackHandler
  statement: IDocument2
}

/**
 * authexp — авторизация СЗ советом (signact2 decision_doc, type=2011).
 * После — CREATED → AUTHORIZED.
 */
export interface IAuthexp {
  coopname: IName
  proposal_hash: IChecksum256
  decision: IDocument2
}

/**
 * declexp — отклонение СЗ-предложения (CREATED/REPORT_SUBMITTED → DECLINED).
 * Capitalization Благороста НЕ запускается.
 */
export interface IDeclexp {
  coopname: IName
  proposal_hash: IChecksum256
  reason: string
}

/**
 * payexp — оплата item (ADVANCE = выдача аванса / DIRECT = прямая оплата).
 * Контракт: Ledger2::apply(operation_code, actual_amount); для DIRECT сразу за payexp — фоновый reportexp.
 */
export interface IPayexp {
  coopname: IName
  proposal_hash: IChecksum256
  item_hash: IChecksum256
  actual_amount: IAsset
}

/**
 * reportexp — закрытие item чеком (только ADVANCE).
 * Контракт: Ledger2::apply(ADVANCE_REPORT). Все items reported → PARTIALLY_PAID/CLOSED-эскалация
 * выносится в closeexp.
 */
export interface IReportexp {
  coopname: IName
  proposal_hash: IChecksum256
  item_hash: IChecksum256
}

/**
 * closeexp — финализация СЗ-отчёта советом. REPORT_SUBMITTED → CLOSED.
 * При наличии callback — inline action на (callback.contract, callback.action, callback.data).
 * **Триггерит capitalization Благороста** (см. capital::createrid через callback).
 */
export interface ICloseexp {
  coopname: IName
  proposal_hash: IChecksum256
}

/**
 * returnexp — возврат неиспользованного аванса (ADVANCE-остаток).
 * Контракт: Ledger2::apply(ADVANCE_RETURN).
 */
export interface IReturnexp {
  coopname: IName
  proposal_hash: IChecksum256
  item_hash: IChecksum256
  return_amount: IAsset
}

/**
 * overspendexp — доплата при перерасходе (только ADVANCE).
 * Контракт: Ledger2::apply(OVERSPEND) → сразу Ledger2::apply(ADVANCE_REPORT) одной транзакцией.
 */
export interface IOverspendexp {
  coopname: IName
  proposal_hash: IChecksum256
  item_hash: IChecksum256
  overspend_amount: IAsset
}

// ─────────────────────────── Tables ───────────────────────────

/**
 * Таблица `proposals` (scope = coopname).
 * Индексы on-chain: byhash (proposal_hash), byusername (username), bystatus (status).
 */
export interface IProposal {
  id: IUint64
  coopname: IName
  proposal_hash: IChecksum256
  username: IName
  source_wallet: IName
  /** ProposalStatus (CREATED=0, AUTHORIZED=1, PARTIALLY_PAID=2, REPORT_SUBMITTED=3, CLOSED=4, DECLINED=5). */
  status: IUint8
  items: IItem[]
  total_planned: IAsset
  total_actual: IAsset
  callback: ICallbackHandler
  statement_doc: IDocument2
  decision_doc: IDocument2
  created_at: ITimePointSec
  updated_at: ITimePointSec
}
