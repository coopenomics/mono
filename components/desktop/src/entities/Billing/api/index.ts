import { client } from 'src/shared/api/client'
import { Queries } from '@coopenomics/sdk'
import type { IBillingSummary } from '../model'

async function loadBillingSummary(coopname: string, period?: number): Promise<IBillingSummary> {
  const { [Queries.Billing.GetBillingSummary.name]: result } = await client.Query(
    Queries.Billing.GetBillingSummary.query,
    { variables: { coopname, period } },
  )
  return result as IBillingSummary
}

export const api = {
  loadBillingSummary,
}
