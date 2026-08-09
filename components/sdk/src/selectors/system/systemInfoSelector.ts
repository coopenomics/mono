import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'
import { rawBlockchainAccountSelector } from '../common/blockchainAccountSelector'
import { rawBlockchainInfoSelector } from './blockchainInfoSelector'
import { rawCooperatorAccountSelector } from './cooperatorAccountSelector'

export const rawSymbolsSelector = {
  root_symbol: true,
  root_govern_symbol: true,
  root_precision: true,
  root_govern_precision: true,
}

export const rawPublicChairmanSelector = {
  first_name: true,
  last_name: true,
  middle_name: true,
}

export const rawOrganizationDetailsSelector = {
  inn: true,
  kpp: true,
  ogrn: true,
}

export const rawContactsSelector = {
  chairman: rawPublicChairmanSelector,
  details: rawOrganizationDetailsSelector,
  email: true,
  full_address: true,
  full_name: true,
  phone: true,
}

export const rawAgreementVarSelector = {
  protocol_day_month_year: true,
  protocol_number: true,
}

export const rawVarsSelector = {
  confidential_email: true,
  confidential_link: true,
  contact_email: true,
  coopenomics_agreement: rawAgreementVarSelector,
  coopname: true,
  full_abbr: true,
  full_abbr_dative: true,
  full_abbr_genitive: true,
  name: true,
  participant_application: rawAgreementVarSelector,
  passport_request: true,
  statute_link: true,
  privacy_agreement: rawAgreementVarSelector,
  short_abbr: true,
  signature_agreement: rawAgreementVarSelector,
  user_agreement: rawAgreementVarSelector,
  wallet_agreement: rawAgreementVarSelector,
  website: true,
}

export const rawSettingsSelector = {
  coopname: true,
  provider_name: true,
  authorized_default_workspace: true,
  authorized_default_route: true,
  non_authorized_default_workspace: true,
  non_authorized_default_route: true,
  is_registration_open: true,
  created_at: true,
  updated_at: true,
}

export const rawBoardMemberSelector = {
  username: true,
  first_name: true,
  last_name: true,
  middle_name: true,
  is_chairman: true,
}

export const rawFeaturesSelector = {
  search: true,
}

export const rawSystemInfoSelector = {
  blockchain_info: rawBlockchainInfoSelector,
  cooperator_account: rawCooperatorAccountSelector,
  coopname: true,
  blockchain_account: rawBlockchainAccountSelector,
  system_status: true,
  is_providered: true,
  is_unioned: true,
  union_link: true,
  contacts: rawContactsSelector,
  vars: rawVarsSelector,
  symbols: rawSymbolsSelector,
  settings: rawSettingsSelector,
  board_members: rawBoardMemberSelector,
  features: rawFeaturesSelector,
}

const _validate: MakeAllFieldsRequired<ValueTypes['SystemInfo']> = rawSystemInfoSelector

export const systemInfoSelector = Selector('SystemInfo')(rawSystemInfoSelector)
