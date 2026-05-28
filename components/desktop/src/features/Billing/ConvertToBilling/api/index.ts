import { client } from 'src/shared/api/client'
import { Mutations } from '@coopenomics/sdk'
import type { IConvertToBillingInput } from '../model'

async function convertToBilling(input: IConvertToBillingInput) {
  const { [Mutations.Billing.Convert.name]: result } = await client.Mutation(
    Mutations.Billing.Convert.mutation,
    { variables: { input } },
  )
  return result
}

export const api = {
  convertToBilling,
}
