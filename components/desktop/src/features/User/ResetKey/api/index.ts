import { Mutations, Queries } from '@coopenomics/sdk'
import { client } from 'src/shared/api/client'

export type IResetKeyInput = Mutations.Accounts.ResetKey.IInput['data']
export type IInviteRecipientInput = Queries.Accounts.InviteRecipient.IInput['data']

async function resetKey(data: IResetKeyInput): Promise<boolean> {
  const {[Mutations.Accounts.ResetKey.name]: result} = await client.Mutation(Mutations.Accounts.ResetKey.mutation, {variables: {
    data
  }})

  return result
}

/** Почта приглашённого по токену из письма; токен не расходуется. */
async function inviteRecipient(data: IInviteRecipientInput): Promise<string> {
  const {[Queries.Accounts.InviteRecipient.name]: result} = await client.Query(Queries.Accounts.InviteRecipient.query, {variables: {
    data
  }})

  return result.email
}

export const api = {
  resetKey,
  inviteRecipient,
}
