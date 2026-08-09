import type { Mutations } from '@coopenomics/sdk'
import { api } from '../api'
import { useBranchStore, type IBranch } from 'src/entities/Branch/model'
import { useSystemStore } from 'src/entities/System/model'

export type ISetBranchPrivateInput = Mutations.Branches.SetBranchPrivate.IInput['data']
export type IAddBranchWhitelistInput = Mutations.Branches.AddBranchWhitelist.IInput['data']
export type IDeleteBranchWhitelistInput = Mutations.Branches.DeleteBranchWhitelist.IInput['data']

export function useBranchPrivacy() {
  const store = useBranchStore()
  const { info } = useSystemStore()

  async function setBranchPrivate(data: ISetBranchPrivateInput): Promise<IBranch> {
    const branch = await api.setBranchPrivate(data)
    await store.loadBranches({ coopname: info.coopname })
    return branch
  }

  async function addBranchWhitelist(data: IAddBranchWhitelistInput): Promise<IBranch> {
    const branch = await api.addBranchWhitelist(data)
    await store.loadBranches({ coopname: info.coopname })
    return branch
  }

  async function deleteBranchWhitelist(data: IDeleteBranchWhitelistInput): Promise<IBranch> {
    const branch = await api.deleteBranchWhitelist(data)
    await store.loadBranches({ coopname: info.coopname })
    return branch
  }

  return { setBranchPrivate, addBranchWhitelist, deleteBranchWhitelist }
}
