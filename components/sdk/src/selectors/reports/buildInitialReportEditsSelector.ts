import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

export const rawBuildInitialReportEditsSelector = {
  editsJson: true,
  editedFields: true,
  hasDraft: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['BuildInitialReportEdits']> =
  rawBuildInitialReportEditsSelector

export type buildInitialReportEditsModel = ModelTypes['BuildInitialReportEdits']
export const buildInitialReportEditsSelector = Selector('BuildInitialReportEdits')(
  rawBuildInitialReportEditsSelector,
)
