import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

export const rawAvailableReportSelector = {
  type: true,
  name: true,
  period: true,
  deadline: true,
  lastGeneratedAt: true,
  nextDeadlineDate: true,
  readyToGenerate: true,
  missingFields: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['AvailableReport']> = rawAvailableReportSelector

export type availableReportModel = ModelTypes['AvailableReport']
export const availableReportSelector = Selector('AvailableReport')(rawAvailableReportSelector)
