/**
 * Пароль пайщику без смены ключа — для стенда документации.
 *
 *   pnpm --filter @coopenomics/boot exec esno components/api-tests/src/seed/passwords.ts <who.json> <пароль>
 *
 * Форма входа стола с ключом доступа ставит пароль сама, но при этом ротирует
 * ключ пайщика в цепи (SDK migrate, rotate по умолчанию). Засев стенда
 * подписывает действия председателя его ключом из boot — после ротации они
 * отвергались бы. Поэтому председателю пароль ставится здесь, тем же REST
 * `coop/migration`, но без нового ключа: vault несёт текущий ключ под новым
 * паролём, ключ в цепи прежний. Блоб шифруется по-настоящему (@coopenomics/auth,
 * argon2id + AES-GCM): стол при входе расшифровывает им ключ для рукопожатия.
 *
 * После установки пароля вход подписью для пайщика закрыт — токены засеву
 * даёт вход со стола (docs-harness lib/tokens.mjs).
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import ecc from 'eosjs-ecc'
import type { Who } from '../core/auth'
import { API_URL, CHAIN_URL, REPO_ROOT } from '../core/env'

async function main(): Promise<void> {
  const [whoFile, password] = process.argv.slice(2)
  if (!whoFile || !password) {
    console.error('Usage: passwords.ts <who.json> <пароль>')
    process.exit(2)
  }
  // Пакет auth в зависимостях api-tests не числится — берём собранный dist по пути.
  const auth: any = await import(path.join(REPO_ROOT, 'components/auth/dist/index.mjs'))
  const list = JSON.parse(fs.readFileSync(whoFile, 'utf8')) as Who[]
  const base = API_URL.replace(/\/v1\/graphql\/?$/, '')
  let failed = 0
  for (const who of list) {
    const info: any = await (await fetch(`${CHAIN_URL}/v1/chain/get_info`)).json()
    const ts = info.head_block_time as string
    const pwHash = crypto.createHash('sha256').update(password, 'utf8').digest('hex')
    const message = auth.canonicalMigrationMessage({ ts, pw_hash: pwHash })
    const signature = ecc.sign(message, who.wif)
    const vault = await auth.encryptPrivateKey(who.wif, password, { subject_type: 'participant', subject_id: who.account })
    const r = await fetch(`${base}/coop/migration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: who.email, timestamp: ts, signature, new_password: password, vault }),
    })
    const text = await r.text()
    if (r.ok) {
      console.error(`[passwords] ${who.account}: пароль поставлен, ключ прежний`)
    }
    else {
      failed++
      console.error(`[passwords] ${who.account}: отказ ${r.status} ${text.slice(0, 200)}`)
    }
  }
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
