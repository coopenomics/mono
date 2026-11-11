import { Selector } from '../../zeus/index'

export const expenseCounterpartySelector = Selector('ExpenseCounterparty')({
  id: true,
  braname: true,
  kind: true,
  name: true,
  tax_id: true,
  requisites: { key: true, label: true, value: true },
  requisites_text: true,
  payment_purpose: true,
  archived: true,
  creator: true,
  created_at: true,
  can_manage: true,
})

export const expenseCounterpartyFormSelector = Selector('ExpenseCounterpartyForm')({
  country: true,
  kinds: {
    kind: true,
    fields: { key: true, label: true, required: true, length: true, pattern: true, group: true, tax_id: true },
  },
})
