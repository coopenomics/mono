import { client } from 'src/shared/api/client'
import { Mutations } from '@coopenomics/sdk'

async function resetRegistration(): Promise<
  Mutations.Accounts.ResetRegistration.IOutput[typeof Mutations.Accounts.ResetRegistration.name]
> {
  const { [Mutations.Accounts.ResetRegistration.name]: result } = await client.Mutation(
    Mutations.Accounts.ResetRegistration.mutation,
    {}
  )

  return result
}

export const api = {
  resetRegistration,
}
