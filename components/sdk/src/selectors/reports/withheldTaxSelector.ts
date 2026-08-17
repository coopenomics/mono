import { Selector } from '../../zeus/index'

/** Удержанный налог: долг перед бюджетом и то, что уже отправлено кассиру. */
export const withheldTaxStateSelector = Selector('WithheldTaxState')({
  withheld: true,
  in_payment: true,
  available: true,
})

export const withheldTaxRequisiteRowSelector = Selector('WithheldTaxRequisiteRow')({
  label: true,
  value: true,
})

/** Заявка бухгалтера кассиру на перечисление налога. */
export const withheldTaxPaymentSelector = Selector('WithheldTaxPayment')({
  hash: true,
  amount: true,
  symbol: true,
  memo: true,
  status: true,
  message: true,
  recipient_name: true,
  requisite_rows: withheldTaxRequisiteRowSelector,
  created_at: true,
  completed_at: true,
  report_year: true,
  report_period: true,
  report_period_label: true,
})

export const withheldTaxPaymentPageSelector = Selector('WithheldTaxPaymentPage')({
  items: withheldTaxPaymentSelector,
  totalCount: true,
  totalPages: true,
  currentPage: true,
})
