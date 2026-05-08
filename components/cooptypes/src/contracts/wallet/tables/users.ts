import type * as Wallet from '../../../interfaces/wallet'

export const tableName = 'users'
// scope — coopname.

/**
 * @interface
 * Owner программных соглашений пайщика. Полный текст document лежит в action data,
 * не в state.
 */
export type IUser = Wallet.IUser
export type IProgramAgreement = Wallet.IProgramAgreement
