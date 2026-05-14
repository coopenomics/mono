/**
 * Helper для интеграционных тестов walmove (operation `o.adj.walmove`).
 *
 * Перевод между кошельками одного бух.счёта через GraphQL-мутацию `walmoveWallets`.
 * Backend подписывает action `ledger2::walmove` ключом председателя из vault,
 * проверяя связь wallet→account по `Ledger2.LEDGER2_OPERATION_REGISTRY` ДО подписания.
 *
 * Возвращает {processHash, transactionId} — процесс-хэш можно использовать для
 * последующей проверки записи в `getLedger2History`.
 */

import { gql, type LoginResult } from '../shared/apiClient'

interface WalmoveResponse {
  walmoveWallets: { processHash: string; transactionId: string }
}

const WALMOVE_MUTATION = `mutation($i:WalmoveInput!){
  walmoveWallets(input:$i){ processHash transactionId }
}`

export async function walmove(
  login: LoginResult,
  coopname: string,
  username: string,
  fromWallet: string,
  toWallet: string,
  quantity: string,
  memo: string,
): Promise<{ processHash: string; transactionId: string }> {
  const data = await gql<WalmoveResponse>(login.token, WALMOVE_MUTATION, {
    i: { coopname, username, fromWallet, toWallet, quantity, memo },
  })
  return {
    processHash: data.walmoveWallets.processHash,
    transactionId: data.walmoveWallets.transactionId,
  }
}
