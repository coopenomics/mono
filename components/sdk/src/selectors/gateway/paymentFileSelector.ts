import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

export const rawPaymentFileSelector = {
  id: true,
  coopname: true,
  payment_hash: true,
  kind: true,
  storage_key: true,
  mime_type: true,
  size_bytes: true,
  checksum_sha256: true,
  original_filename: true,
  read_url: true,
  uploaded_at: true,
  uploaded_by_username: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['PaymentFile']> = rawPaymentFileSelector

export const paymentFileSelector = Selector('PaymentFile')(rawPaymentFileSelector)
