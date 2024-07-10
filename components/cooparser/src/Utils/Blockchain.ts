import type { RpcInterfaces } from 'eosjs'
import fetch from 'node-fetch'
import { eosioApi } from '../config'

export const getInfo = () => fetch(`${eosioApi}/v1/chain/get_info`).then((res: any) => res.json())

export function fetchAbi(account_name: string) {
  return fetch(`${eosioApi}/v1/chain/get_abi`, {
    method: 'POST',
    body: JSON.stringify({
      account_name,
    }),
  }).then(async (res: any) => {
    const response = await res.json()
    return {
      account_name,
      abi: response.abi as RpcInterfaces.Abi,
    }
  })
}
