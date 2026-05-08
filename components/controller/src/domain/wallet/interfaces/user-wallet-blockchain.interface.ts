/**
 * Данные строки `ledger2::userwallets` (L3 учёт по USER_SHARED-кошелькам).
 *
 * `coopname` — из `delta.scope`. Запись существует только при ненулевом
 * (available, blocked); `walletop`/`migrate3` стирают её при обнулении.
 */
export interface IUserWalletBlockchainData {
  id: string;
  coopname: string;
  wallet_name: string;
  username: string;
  available: string;
  blocked: string;
}
