import { api, type IInviteRecipientInput, type IResetKeyInput } from '../api'

export function useResetKey() {
  async function resetKey(data: IResetKeyInput): Promise<boolean> {
    return await api.resetKey(data)
  }

  async function inviteRecipient(data: IInviteRecipientInput): Promise<string> {
    return await api.inviteRecipient(data)
  }

  return {
    resetKey,
    inviteRecipient,
  }
}
