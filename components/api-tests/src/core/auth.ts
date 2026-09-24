/**
 * Вход пайщика так, как это делает SDK (Client.login): подпись времени
 * головного блока его ключом. Токены кешируются на прогон — вход не то, что
 * проверяет большинство тестов, а каждый лишний вход — лишний круг до цепи.
 */
import ecc from 'eosjs-ecc'
import { gql } from './client'
import { CHAIN_URL } from './env'

export interface Who {
  /** Имя аккаунта в цепи. */
  account: string
  email: string
  wif: string
}

const tokens = new Map<string, string>()

/**
 * Новый вход — всегда свежий токен, в общий кеш не попадает: тест, который
 * потом выходит из этой сессии, не ломает токены остальным файлам.
 */
export async function login(who: Who): Promise<string> {
  const info: any = await (await fetch(`${CHAIN_URL}/v1/chain/get_info`)).json()
  const now = info.head_block_time as string
  const signature = ecc.signHash(ecc.sha256(Buffer.from(now, 'utf8'), 'hex'), who.wif)
  const d = await gql<any>(
    null,
    'mutation($d:LoginInput!){ login(data:$d){ tokens{ access{ token } } account{ username } } }',
    { d: { email: who.email, now, signature } },
  )
  return d.login.tokens.access.token as string
}

/** Токен из кеша прогона, при первом обращении — вход. */
export async function tokenOf(who: Who): Promise<string> {
  const cached = tokens.get(who.account)
  if (cached)
    return cached
  const token = await login(who)
  tokens.set(who.account, token)
  return token
}

/** Забыть токен (после выхода или смены ключа). */
export function forgetToken(who: Who): void {
  tokens.delete(who.account)
}
