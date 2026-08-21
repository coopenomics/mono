/**
 * CoopID Story 1.3: permission `cert` (ES256K/K1, parent `active`) на аккаунтах
 * цепочки доверия `ano → voskhod → vostok`. Идемпотентна: существующий аккаунт —
 * skip; существующий `cert` с тем же ключом — skip, с другим — updateauth.
 *
 * Первая миграция на WharfKit (архитектура CoopID переводит блокчейн-IO на
 * WharfKit; eosjs-хелпер ../src/eos остаётся для старых миграций).
 *
 * Ключи `cert` резолвятся в порядке:
 *   1. env `<ACCOUNT>_CERT_PUBLIC_KEY` (обязательно для testnet/mainnet);
 *   2. для `vostok` — деривация из PEM `infra/coopid/secrets/coop_cert_key`
 *      (цепочка на chain обязана совпасть с ключом подписи controller'а);
 *   3. дев-fallback — стандартный ключ дев-сети (только NODE_ENV=local).
 */
import { createPrivateKey } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import * as path from 'node:path'
import { APIClient, Bytes, KeyType, PrivateKey, PublicKey } from '@wharfkit/antelope'
import { Session } from '@wharfkit/session'
import { WalletPluginPrivateKey } from '@wharfkit/wallet-plugin-privatekey'
import type { Migration } from '../src/migration_interface'
import { getDirname } from '../src/utils/dirname'

const CERT_ACCOUNTS = ['ano', 'voskhod', 'vostok'] as const
const DEV_DEFAULT_PUBLIC_KEY = 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV'

function pemToPublicKey(pemPath: string): string {
  const pem = readFileSync(pemPath, 'utf-8')
  const jwk = createPrivateKey(pem).export({ format: 'jwk' }) as { crv?: string, d?: string }
  if (jwk.crv !== 'secp256k1' || !jwk.d)
    throw new Error(`${pemPath}: ожидался приватный ключ secp256k1 (ES256K), получено crv=${jwk.crv}`)
  // JWK может опускать ведущие нули скаляра — выравниваем до 32 байт,
  // иначе получится валидный по форме, но ЧУЖОЙ публичный ключ.
  const d = Buffer.from(jwk.d, 'base64url')
  if (d.length > 32)
    throw new Error(`${pemPath}: скаляр d длиннее 32 байт (${d.length})`)
  const raw = Buffer.concat([Buffer.alloc(32 - d.length), d])
  return new PrivateKey(KeyType.K1, Bytes.from(raw)).toPublic().toString()
}

function resolveCertKey(account: string, repoRoot: string): string {
  const fromEnv = process.env[`${account.toUpperCase()}_CERT_PUBLIC_KEY`]
  if (fromEnv)
    return fromEnv

  if (account === 'vostok') {
    const pemPath = path.join(repoRoot, 'infra/coopid/secrets/coop_cert_key')
    if (existsSync(pemPath))
      return pemToPublicKey(pemPath)
  }

  const env = process.env.NODE_ENV || 'local'
  if (env !== 'local') {
    throw new Error(
      `Ключ cert для ${account} не задан: для окружения ${env} обязателен env ${account.toUpperCase()}_CERT_PUBLIC_KEY `
      + `(для vostok — либо PEM infra/coopid/secrets/coop_cert_key). Дев-fallback разрешён только в local.`,
    )
  }
  return DEV_DEFAULT_PUBLIC_KEY
}

export class InitialMigration implements Migration {
  async run(): Promise<void> {
    const endpoint = process.env.EOSIO_ENDPOINT
    const privateKey = process.env.EOSIO_PRIVATE_KEY
    if (!endpoint || !privateKey)
      throw new Error('EOSIO_ENDPOINT и EOSIO_PRIVATE_KEY обязательны (см. local.env)')

    const repoRoot = path.join(getDirname(import.meta.url), '../../..')
    // Ключи резолвим ДО любых транзакций — fail-fast при отсутствии PEM/env.
    const certKeys = Object.fromEntries(
      CERT_ACCOUNTS.map(account => [account, resolveCertKey(account, repoRoot)]),
    )

    const client = new APIClient({ url: endpoint })
    const info = await client.v1.chain.get_info()
    const chain = { id: String(info.chain_id), url: endpoint }
    const walletPlugin = new WalletPluginPrivateKey(privateKey)
    const sessionFor = (actor: string, permission = 'active') =>
      new Session({ chain, actor, permission, walletPlugin })

    for (const account of CERT_ACCOUNTS) {
      const exists = await client.v1.chain
        .get_account(account)
        .then(() => true, () => false)

      if (!exists) {
        // Создание аккаунтов — ТОЛЬКО dev: на testnet/mainnet аккаунты заводит
        // registrator (реестр, referer, eosio.prods), а owner/active на
        // общеизвестном дев-ключе означали бы немедленный захват аккаунта.
        if ((process.env.NODE_ENV || 'local') !== 'local')
          throw new Error(`Аккаунт ${account} не существует: вне local-сети миграция аккаунты не создаёт — заведите через registrator и повторите.`)
        await sessionFor('eosio').transact({
          actions: [{
            account: 'eosio',
            name: 'newaccount',
            authorization: [{ actor: 'eosio', permission: 'active' }],
            data: {
              creator: 'eosio',
              name: account,
              owner: { threshold: 1, keys: [{ key: DEV_DEFAULT_PUBLIC_KEY, weight: 1 }], accounts: [], waits: [] },
              active: { threshold: 1, keys: [{ key: DEV_DEFAULT_PUBLIC_KEY, weight: 1 }], accounts: [], waits: [] },
            },
          }],
        })
        console.log(`[052] создан аккаунт ${account} (дев-ключи)`)
      }

      const acc = await client.v1.chain.get_account(account)
      const certPerm = acc.permissions.find(p => String(p.perm_name) === 'cert')
      const desiredKey = certKeys[account]
      const currentKey = certPerm?.required_auth.keys[0]?.key?.toString()
      // Skip только при ТОЧНОМ совпадении всей структуры single-key auth:
      // дрейф (threshold>1, второй ключ, accounts/waits) чиним updateauth'ом.
      const isCleanSingleKey = certPerm
        && Number(certPerm.required_auth.threshold) === 1
        && certPerm.required_auth.keys.length === 1
        && certPerm.required_auth.accounts.length === 0
        && certPerm.required_auth.waits.length === 0

      if (isCleanSingleKey && currentKey && samePublicKey(currentKey, desiredKey)) {
        console.log(`[052] ${account}@cert уже на месте (${desiredKey}) — skip`)
        continue
      }

      await sessionFor(account).transact({
        actions: [{
          account: 'eosio',
          name: 'updateauth',
          authorization: [{ actor: account, permission: 'active' }],
          data: {
            account,
            permission: 'cert',
            parent: 'active',
            auth: { threshold: 1, keys: [{ key: desiredKey, weight: 1 }], accounts: [], waits: [] },
          },
        }],
      })
      console.log(
        certPerm
          ? `[052] ${account}@cert обновлён: ${currentKey} → ${desiredKey}`
          : `[052] ${account}@cert создан (parent active): ${desiredKey}`,
      )
    }
  }
}

/** Сравнение ключей с учётом legacy (EOS...) и нового (PUB_K1_...) форматов. */
function samePublicKey(a: string, b: string): boolean {
  try {
    return PublicKey.from(a).equals(PublicKey.from(b))
  }
  catch {
    return a === b
  }
}
