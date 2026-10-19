import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

export const rawCooperativeCharterSelector = {
  id: true,
  coopname: true,
  username: true,
  checksum_sha256: true,
  mime_type: true,
  size_bytes: true,
  original_filename: true,
  read_url: true,
  uploaded_at: true,
  uploaded_by_username: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['CooperativeCharter']> = rawCooperativeCharterSelector

export const cooperativeCharterSelector = Selector('CooperativeCharter')(rawCooperativeCharterSelector)
