import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawProcessSummarySelector = {
  coopname: true,
  firstSeenAt: true,
  lastSeenAt: true,
  processHash: true,
  processType: true,
  username: true,
}

const _validateSummary: MakeAllFieldsRequired<ValueTypes['ProcessSummary']> =
  rawProcessSummarySelector

export const processSummarySelector = Selector('ProcessSummary')(rawProcessSummarySelector)

export const processSummaryPaginationSelector = Selector('ProcessSummaryPaginationResult')({
  currentPage: true,
  totalCount: true,
  totalPages: true,
  items: rawProcessSummarySelector,
})
