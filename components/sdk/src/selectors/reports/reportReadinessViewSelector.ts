import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

const rawMissingRequisiteFieldSelector = {
  key: true,
  label: true,
  reason: true,
  source: true,
}

export const rawReportReadinessViewSelector = {
  reportType: true,
  ready: true,
  missingFields: rawMissingRequisiteFieldSelector,
}

const _validate: MakeAllFieldsRequired<ValueTypes['ReportReadinessView']> = rawReportReadinessViewSelector

export type reportReadinessViewModel = ModelTypes['ReportReadinessView']
export const reportReadinessViewSelector = Selector('ReportReadinessView')(rawReportReadinessViewSelector)
