import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'
import { rawExtendedBlockchainActionSelector } from '../common/rawExtendedBlockchainActionSelector'
import { rawDocumentAggregateSelector } from '../documents/documentAggregateSelector'

/** ActDetailAggregate — Аггрегат c документом для акта */
export const rawActDetailAggregateSelector = {
  action: rawExtendedBlockchainActionSelector,
  documentAggregate: rawDocumentAggregateSelector,
}

/** DecisionDetailAggregate — для поля documentAggregate указываем union (rawDecisionDocumentAggregateSelector). */
export const rawDecisionDetailAggregateSelector = {
  action: rawExtendedBlockchainActionSelector,
  documentAggregate: rawDocumentAggregateSelector,
  votes_against: rawExtendedBlockchainActionSelector,
  votes_for: rawExtendedBlockchainActionSelector,
}

/** StatementDetailAggregate — для поля documentAggregate указываем rawStatementDocumentAggregateSelector. */
export const rawStatementDetailAggregateSelector = {
  action: rawExtendedBlockchainActionSelector,
  documentAggregate: rawDocumentAggregateSelector,
}

/**
 * DocumentPackageAggregate, собирающий всё воедино:
 * - acts (ActDetailAggregate)
 * - decision (DecisionDetailAggregate)
 * - links (документный агрегат)
 * - statement (StatementDetailAggregate)
 */
export const rawDocumentPackageAggregateSelector = {
  acts: rawActDetailAggregateSelector,
  decision: rawDecisionDetailAggregateSelector,
  links: rawDocumentAggregateSelector,
  statement: rawStatementDetailAggregateSelector,
  registry_hash: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['DocumentPackageAggregate']> = rawDocumentPackageAggregateSelector

export type documentPackageAggregateModel = ModelTypes['DocumentPackageAggregate']
export const documentPackageAggregateSelector = Selector('DocumentPackageAggregate')(rawDocumentPackageAggregateSelector)
