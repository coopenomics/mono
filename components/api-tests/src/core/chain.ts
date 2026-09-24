/**
 * Цепь стенда: чтение таблиц и отправка действий от лица участника.
 *
 * Отправка напрямую в цепь нужна там, где клиент пайщика так и ходит (подпись
 * заявлений ключом пайщика) либо где тест готовит состояние. Проверяемый
 * результат тест всё равно читает через API контроллера — зеркало узла и есть
 * то, что видит пайщик.
 */
import { Api, JsonRpc } from 'eosjs'
import { JsSignatureProvider } from 'eosjs/dist/eosjs-jssig'
import type { Who } from './auth'
import { CHAIN_URL } from './env'

export const rpc = new JsonRpc(CHAIN_URL, { fetch: fetch as any })

export interface Action {
  account: string
  name: string
  data: Record<string, unknown>
  /** По умолчанию — active того, кто подписывает. */
  authorization?: { actor: string, permission: string }[]
}

/**
 * Одинаковые действия в пределах одного блока цепь отвергает как duplicate
 * transaction. Каждая транзакция прогона получает свой срок действия — так
 * повтор того же действия в тесте остаётся отдельной транзакцией.
 */
let seq = 0
function expireSeconds(): number {
  seq = (seq + 1) % 3000
  return 120 + seq
}

export async function transact(who: Who, actions: Action[]): Promise<any> {
  const api = new Api({
    rpc,
    signatureProvider: new JsSignatureProvider([who.wif]),
    textDecoder: new TextDecoder() as any,
    textEncoder: new TextEncoder() as any,
  })
  return api.transact({
    actions: actions.map(a => ({
      account: a.account,
      name: a.name,
      authorization: a.authorization ?? [{ actor: who.account, permission: 'active' }],
      data: a.data,
    })),
  }, { blocksBehind: 3, expireSeconds: expireSeconds() })
}

/** Все строки таблицы (без пагинации — стенд маленький). */
export async function tableRows<T = any>(code: string, scope: string, table: string, opts: { lower?: string, upper?: string, index?: number, keyType?: string } = {}): Promise<T[]> {
  const r = await rpc.get_table_rows({
    json: true,
    code,
    scope,
    table,
    limit: 10_000,
    lower_bound: opts.lower,
    upper_bound: opts.upper,
    index_position: opts.index,
    key_type: opts.keyType,
  } as any)
  return r.rows as T[]
}

/** Сообщение ассерта контракта из ошибки eosjs («assertion failure with message: …»). */
export function chainMessage(e: unknown): string {
  const any = e as any
  const details = any?.json?.error?.details
  if (Array.isArray(details) && details[0]?.message)
    return String(details[0].message).replace(/^assertion failure with message:\s*/, '')
  return String(any?.message ?? e)
}
