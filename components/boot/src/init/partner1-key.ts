import process from 'node:process'
import ecc from 'eosjs-ecc'

/**
 * Ключ аккаунта partner1 — подключённого кооператива dev-стенда. Нужен в двух
 * местах: boot:extra заводит им аккаунт в цепи ведущего, а связка двух стендов
 * (two_coop_slave.sh) ставит им узел ведомого кооператива.
 */
export async function partner1Keys(): Promise<{ privateKey: string, publicKey: string }> {
  // Источник WIF: env PARTNER1_WIF, иначе стандартный ключ dev-сети.
  // Фикстура docs-harness/state/cooperatives/partner1.json больше не читается
  // (решение владельца 25.10.2026): у стенда один стандартный ключ на всех,
  // вход без поиска «какой ключ у этого кооператива».
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
    const pub = await ecc.privateToPublic(DEFAULT_PARTNER1_WIF)
    seededKeys = { privateKey: DEFAULT_PARTNER1_WIF, publicKey: pub }
    console.log(`✓ partner1: используем DEFAULT_PARTNER1_WIF (pub=${pub.slice(0, 12)}…)`)
  }

  return seededKeys
}
