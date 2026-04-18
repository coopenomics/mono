import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

const rawRequisiteFieldViewSelector = {
  value: true,
  source: true,
}

export const rawReportRequisitesViewSelector = {
  coopname: true,
  inn: rawRequisiteFieldViewSelector,
  kpp: rawRequisiteFieldViewSelector,
  ogrn: rawRequisiteFieldViewSelector,
  orgName: rawRequisiteFieldViewSelector,
  address: rawRequisiteFieldViewSelector,
  phone: rawRequisiteFieldViewSelector,
  signerLastName: rawRequisiteFieldViewSelector,
  signerFirstName: rawRequisiteFieldViewSelector,
  signerMiddleName: rawRequisiteFieldViewSelector,
  chairmanPositionFromOrg: rawRequisiteFieldViewSelector,
  okved: rawRequisiteFieldViewSelector,
  okfs: rawRequisiteFieldViewSelector,
  okopf: rawRequisiteFieldViewSelector,
  oktmo: rawRequisiteFieldViewSelector,
  okpo: rawRequisiteFieldViewSelector,
  sfrRegNumber: rawRequisiteFieldViewSelector,
  chairmanPosition: rawRequisiteFieldViewSelector,
  signerSnils: rawRequisiteFieldViewSelector,
  signerRepDoc: rawRequisiteFieldViewSelector,
}

const _validate: MakeAllFieldsRequired<ValueTypes['ReportRequisitesView']> = rawReportRequisitesViewSelector

export type reportRequisitesViewModel = ModelTypes['ReportRequisitesView']
export const reportRequisitesViewSelector = Selector('ReportRequisitesView')(rawReportRequisitesViewSelector)
