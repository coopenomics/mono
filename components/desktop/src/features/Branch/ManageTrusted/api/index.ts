import type { IBranch } from 'src/entities/Branch/model'
import type { IAddTrustedInput, IDeleteTrustedInput } from '../model'
import { client } from 'src/shared/api/client'
import { Mutations } from '@coopenomics/sdk'

async function addTrusted(data: IAddTrustedInput): Promise<IBranch> {
  const { [Mutations.Branches.AddTrustedAccount.name]: result } = await client.Mutation(
    Mutations.Branches.AddTrustedAccount.mutation,
    { variables: { data } },
  )
  return result
}

async function deleteTrusted(data: IDeleteTrustedInput): Promise<IBranch> {
  const { [Mutations.Branches.DeleteTrustedAccount.name]: result } = await client.Mutation(
    Mutations.Branches.DeleteTrustedAccount.mutation,
    { variables: { data } },
  )
  return result
}

export const api = {
  addTrusted,
  deleteTrusted,
}
