/**
 * Токены пайщиков подписью — в файл для засева стенда документации.
 *
 *   pnpm --filter @coopenomics/boot exec esno components/api-tests/src/seed/tokens.ts <who.json> <tokens.json>
 *
 * who.json — список { account, email, wif }. Снимается ДО входа этих пайщиков
 * со стола: вход со стола переводит пайщика на пароль, после чего подпись его
 * больше не впускает, а фазам засева токены нужны и после. Пайщик, уже
 * перешедший на пароль, пропускается, его прежняя запись в файле остаётся.
 */
import fs from 'node:fs'
import process from 'node:process'
import ecc from 'eosjs-ecc'
import type { Who } from '../core/auth'
import { readTokensFile, writeTokensFile } from '../core/auth'
import { gql } from '../core/client'
import { CHAIN_URL } from '../core/env'

const LOGIN = 'mutation($d:LoginInput!){ login(data:$d){ tokens{ access{ token } refresh{ token } } account{ username } } }'

async function main(): Promise<void> {
  const [whoFile, out] = process.argv.slice(2)
  if (!whoFile || !out) {
    console.error('Usage: tokens.ts <who.json> <tokens.json>')
    process.exit(2)
  }
  process.env.API_TOKENS_FILE = out
  const list = JSON.parse(fs.readFileSync(whoFile, 'utf8')) as Who[]
  const all = readTokensFile()
  for (const who of list) {
    try {
      const info: any = await (await fetch(`${CHAIN_URL}/v1/chain/get_info`)).json()
      const now = info.head_block_time as string
      const signature = ecc.signHash(ecc.sha256(Buffer.from(now, 'utf8'), 'hex'), who.wif)
      const d = await gql<any>(null, LOGIN, { d: { email: who.email, now, signature } })
      all[who.account] = { access: d.login.tokens.access.token, refresh: d.login.tokens.refresh.token, email: who.email }
      console.error(`[tokens] ${who.account}: токены сняты`)
    }
    catch (e) {
      console.error(`[tokens] ${who.account}: вход подписью не прошёл (${(e as Error).message.slice(0, 120)})${all[who.account] ? ', прежние токены оставлены' : ''}`)
    }
  }
  writeTokensFile(all)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
