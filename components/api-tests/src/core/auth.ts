/**
 * Вход пайщика так, как это делает SDK (Client.login): подпись времени
 * головного блока его ключом. Токены кешируются на прогон — вход не то, что
 * проверяет большинство тестов, а каждый лишний вход — лишний круг до цепи.
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
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

/**
 * Токен из кеша прогона, при первом обращении — вход.
 *
 * Пайщик, перешедший на пароль (стол документации входит так — иначе форма
 * входа не пускает), подписью больше не входит: сервер отвечает
 * AUTH_PASSWORD_SET_KEY_LOGIN_DISABLED. Для него токены берутся из файла
 * `API_TOKENS_FILE` — раннер сюиты documentation снимает их подписью ДО входа
 * со стола, — и продлеваются мутацией refresh; новая пара пишется обратно.
 */
export async function tokenOf(who: Who): Promise<string> {
  const cached = tokens.get(who.account)
  if (cached)
    return cached
  let token: string
  try {
    token = await login(who)
  }
  catch (e) {
    const stored = await refreshFromFile(who)
    if (!stored)
      throw e
    token = stored
  }
  tokens.set(who.account, token)
  return token
}

interface StoredTokens { access: string, refresh: string, email?: string }

/** Файл токенов раннера: { [account]: { access, refresh } }. */
export function tokensFile(): string | null {
  return process.env.API_TOKENS_FILE || null
}

export function readTokensFile(): Record<string, StoredTokens> {
  const file = tokensFile()
  if (!file || !fs.existsSync(file))
    return {}
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, StoredTokens>
}

export function writeTokensFile(all: Record<string, StoredTokens>): void {
  const file = tokensFile()
  if (!file)
    return
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(all, null, 2)}\n`)
}

async function refreshFromFile(who: Who): Promise<string | null> {
  // Токен из файла — тот, которым работает стол в браузере. Продлевать его
  // мутацией refresh нельзя: сервер гасит прежнюю пару, и стол теряет вход
  // посреди сценария. Токен доступа живёт 30 минут, засев укладывается; свежий
  // снимает харнесс повторным входом (docs-harness lib/tokens.mjs).
  const stored = readTokensFile()[who.account]
  return stored?.access ?? null
}

/** Забыть токен (после выхода или смены ключа). */
export function forgetToken(who: Who): void {
  tokens.delete(who.account)
}
