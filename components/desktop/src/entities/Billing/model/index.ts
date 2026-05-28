import type { Queries } from '@coopenomics/sdk'

// Тип строго из SDK
export type IBillingSummary =
  Queries.Billing.GetBillingSummary.IOutput[typeof Queries.Billing.GetBillingSummary.name]
