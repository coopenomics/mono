import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

export const rawExpenseFileSelector = {
  id: true,
  coopname: true,
  proposal_hash: true,
  item_hash: true,
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

const _validate: MakeAllFieldsRequired<ValueTypes['ExpenseFile']> = rawExpenseFileSelector

export const expenseFileSelector = Selector('ExpenseFile')(rawExpenseFileSelector)
