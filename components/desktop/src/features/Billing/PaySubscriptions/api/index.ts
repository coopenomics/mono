import { client } from 'src/shared/api/client'
import { Mutations } from '@coopenomics/sdk'
import type { IPaySubscriptionsInput } from '../model'

async function paySubscriptions(input: IPaySubscriptionsInput) {
  const { [Mutations.Billing.Pay.name]: result } = await client.Mutation(
    Mutations.Billing.Pay.mutation,
    { variables: { input } },
  )
  return result
}

export const api = {
  paySubscriptions,
}
