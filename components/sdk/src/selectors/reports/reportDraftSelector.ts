import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

export const rawReportDraftSelector = {
  id: true,
  ownerUsername: true,
  reportType: true,
  year: true,
  period: true,
  editsJson: true,
  editedFields: true,
  createdAt: true,
  updatedAt: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['ReportDraft']> = rawReportDraftSelector

export type reportDraftModel = ModelTypes['ReportDraft']
export const reportDraftSelector = Selector('ReportDraft')(rawReportDraftSelector)
