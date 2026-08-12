import type { Mutations } from '@coopenomics/sdk';
import { api } from '../api';
import { useBranchStore, type IBranch } from 'src/entities/Branch/model';
import { useSystemStore } from 'src/entities/System/model';

export type IEditBranchInput = Mutations.Branches.EditBranch.IInput['data']

export function useEditBranch() {
  const store = useBranchStore()
  const { info } = useSystemStore()

  async function editBranch(
    branch: IBranch
  ): Promise<IBranch> {

    const data: IEditBranchInput = {
      based_on: branch.represented_by.based_on,
      braname: branch.braname,
      coopname: branch.coopname,
      email: branch.email,
      fact_address: branch.fact_address,
      full_name: branch.full_name,
      phone: branch.phone,
      short_name: branch.short_name,
      trustee: branch.trustee?.username ?? ''
    }

    const result = await api.editBranch(data)

    await store.loadBranches({ coopname: info.coopname })

    return result
  }
  return { editBranch };
}
