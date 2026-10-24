import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import ecc from 'eosjs-ecc'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Ключ аккаунта partner1 — подключённого кооператива dev-стенда. Нужен в двух
 * местах: boot:extra заводит им аккаунт в цепи ведущего, а связка двух стендов
 * (two_coop_slave.sh) ставит им узел ведомого кооператива.
 */
export async function partner1Keys(): Promise<{ privateKey: string, publicKey: string }> {
  // Источники WIF (по приоритету): env PARTNER1_WIF → фикстура
  // docs-harness/state/cooperatives/partner1.json → DEFAULT_PARTNER1_WIF.
  //
  // DEFAULT_PARTNER1_WIF — общеизвестный test-ключ EOSIO (тот же, что у root
  // системного eosio в boot/configs/config.ini). На dev-стенде использовать
  // безопасно: контур закрытый, на проде partner1 не существует. Стабильный
  // дефолт удобнее env-override'ов и фикстур — каждый reboot:extra даёт тот
  // же signin, без записи в .env.
  const DEFAULT_PARTNER1_WIF = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'
  let seededKeys: { privateKey: string, publicKey: string } | undefined
  const envWif = process.env.PARTNER1_WIF?.trim()
  if (envWif) {
    try {
      const pub = await ecc.privateToPublic(envWif)
      seededKeys = { privateKey: envWif, publicKey: pub }
      console.log(`✓ partner1: используем PARTNER1_WIF из env (pub=${pub.slice(0, 12)}…)`)
    }
    catch (e: any) {
      console.warn(`⚠ PARTNER1_WIF недопустим (${e.message}) — пробуем фикстуру`)
    }
  }
  if (!seededKeys) {
    try {
      const fixturePath = resolve(
        __dirname,
        '../../../docs-harness/state/cooperatives/partner1.json',
      )
      if (existsSync(fixturePath)) {
        const fx = JSON.parse(readFileSync(fixturePath, 'utf-8'))
        if (fx?.wif) {
          // publicKey не хранится в фикстуре — деривим из приватного.
          const pub = fx.publicKey || await ecc.privateToPublic(fx.wif)
          seededKeys = { privateKey: fx.wif, publicKey: pub }
          console.log(`✓ partner1: используем seeded WIF из фикстуры (pub=${pub.slice(0, 12)}…)`)
        }
      }
    }
    catch (e: any) {
      console.warn(`⚠ partner1 fixture read failed (${e.message}) — пробуем дефолт`)
    }
  }
  if (!seededKeys) {
    const pub = await ecc.privateToPublic(DEFAULT_PARTNER1_WIF)
    seededKeys = { privateKey: DEFAULT_PARTNER1_WIF, publicKey: pub }
    console.log(`✓ partner1: используем DEFAULT_PARTNER1_WIF (pub=${pub.slice(0, 12)}…)`)
  }

  return seededKeys
}
