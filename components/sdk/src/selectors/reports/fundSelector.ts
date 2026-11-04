import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

// Фонд кооператива на кошельке учётной книги: настройки, остаток, обороты за период (задача 99D-24).
export const rawReportsFundSelector = {
  id: true,
  kind: true,
  name: true,
  description: true,
  percent: true,
  wallet: true,
  wallet_name: true,
  account: true,
  available: true,
  income: true,
  outcome: true,
}

const _validateFund: MakeAllFieldsRequired<ValueTypes['ReportsFund']> = rawReportsFundSelector

export type reportsFundModel = ModelTypes['ReportsFund']
export const reportsFundSelector = Selector('ReportsFund')(rawReportsFundSelector)

// Реестр фондов: пять фондов с остатками и оборотами за период.
export const rawReportsFundsRegistrySelector = {
  funds: rawReportsFundSelector,
}

const _validateRegistry: MakeAllFieldsRequired<ValueTypes['ReportsFundsRegistry']> = rawReportsFundsRegistrySelector

export type reportsFundsRegistryModel = ModelTypes['ReportsFundsRegistry']
export const reportsFundsRegistrySelector = Selector('ReportsFundsRegistry')(rawReportsFundsRegistrySelector)

// Движение по фонду: одна операция учётной книги со знаком относительно фонда.
export const rawReportsFundMovementSelector = {
  global_sequence: true,
  block_num: true,
  created_at: true,
  operation_code: true,
  operation_name: true,
  direction: true,
  amount: true,
  counterparty_wallet: true,
  counterparty_name: true,
  process_hash: true,
  process_type: true,
  username: true,
  memo: true,
}

const _validateMovement: MakeAllFieldsRequired<ValueTypes['ReportsFundMovement']> = rawReportsFundMovementSelector

export type reportsFundMovementModel = ModelTypes['ReportsFundMovement']
export const reportsFundMovementSelector = Selector('ReportsFundMovement')(rawReportsFundMovementSelector)

// Страница истории фонда.
export const rawReportsFundHistoryPaginationSelector = {
  items: rawReportsFundMovementSelector,
  totalCount: true,
  totalPages: true,
  currentPage: true,
}

const _validateHistory: MakeAllFieldsRequired<ValueTypes['ReportsFundHistoryPaginationResult']> = rawReportsFundHistoryPaginationSelector

export type reportsFundHistoryPaginationModel = ModelTypes['ReportsFundHistoryPaginationResult']
export const reportsFundHistoryPaginationSelector = Selector('ReportsFundHistoryPaginationResult')(rawReportsFundHistoryPaginationSelector)
