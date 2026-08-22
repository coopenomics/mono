import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'
import { rawUserCertificateUnionSelector } from '../common/userCertificateUnionSelector'
import { rawSignedBlockchainDocumentSelector } from '../documents/signedBlockchainDocumentSelector'

export const rawBlockchainDecisionSelector = {
  approved: true,
  authorization: rawSignedBlockchainDocumentSelector,
  authorized: true,
  authorized_by: true,
  batch_id: true,
  coopname: true,
  created_at: true,
  expired_at: true,
  id: true,
  meta: true,
  statement: rawSignedBlockchainDocumentSelector,
  type: true,
  username: true,
  validated: true,
  votes_against: true,
  votes_for: true,
  callback_contract: true,
  confirm_callback: true,
  decline_callback: true,
  hash: true,
  username_certificate: rawUserCertificateUnionSelector,
  votes_for_certificates: rawUserCertificateUnionSelector,
  votes_against_certificates: rawUserCertificateUnionSelector,
  council_members_count: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['BlockchainDecision']> = rawBlockchainDecisionSelector

export type blockchainDecisionModel = ModelTypes['BlockchainDecision']
export const blockchainDecisionSelector = Selector('BlockchainDecision')(rawBlockchainDecisionSelector)
