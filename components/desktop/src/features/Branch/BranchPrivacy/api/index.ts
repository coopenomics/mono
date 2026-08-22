import type { IBranch } from 'src/entities/Branch/model'
import type { IAddBranchWhitelistInput, IDeleteBranchWhitelistInput, ISetBranchPrivateInput } from '../model'
import { client } from 'src/shared/api/client'
import { Mutations } from '@coopenomics/sdk'

async function setBranchPrivate(data: ISetBranchPrivateInput): Promise<IBranch> {
  const { [Mutations.Branches.SetBranchPrivate.name]: result } = await client.Mutation(
    Mutations.Branches.SetBranchPrivate.mutation,
    { variables: { data } }
  )
  return result
}

async function addBranchWhitelist(data: IAddBranchWhitelistInput): Promise<IBranch> {
  const { [Mutations.Branches.AddBranchWhitelist.name]: result } = await client.Mutation(
    Mutations.Branches.AddBranchWhitelist.mutation,
    { variables: { data } }
  )
  return result
}

async function deleteBranchWhitelist(data: IDeleteBranchWhitelistInput): Promise<IBranch> {
  const { [Mutations.Branches.DeleteBranchWhitelist.name]: result } = await client.Mutation(
    Mutations.Branches.DeleteBranchWhitelist.mutation,
    { variables: { data } }
  )
  return result
}

export const api = {
  setBranchPrivate,
  addBranchWhitelist,
  deleteBranchWhitelist,
}
