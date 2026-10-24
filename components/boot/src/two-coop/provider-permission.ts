/**
 * Разрешение `<оператор>@provider` на свежей цепи ведущего стенда (487-34).
 *
 * Провайдер подписывает канал оператора каталога (кооперативы и подписки на
 * приложения) ключом этого разрешения, каталог сверяет подпись с его ключом в
 * цепи. Разрешение дочернее к active и ни к одному действию не привязано:
 * транзакцию этим ключом не подписать. На боевых контурах оператор публикует
 * его один раз; на стенде цепь перезапускается с нуля, и без этого шага
 * каталог отвечает провайдеру «cooperative not registered».
 *
 * Открытая часть берётся из закрытого ключа провайдера (CATALOG_PROVIDER_KEY
 * его .env.dev-stack). Повтор безопасен: тот же ключ в цепи — ничего не пишем.
 * Вызывает components/boot/scripts/two_coop_master.sh.
 */
import process from 'node:process'
import ecc from 'eosjs-ecc'
import config from '../configs'
import Blockchain from '../blockchain'

const OPERATOR = process.env.OPERATOR_ACCOUNT || config.provider
const PERMISSION = 'provider'

async function main() {
  const providerKey = process.env.CATALOG_PROVIDER_KEY?.trim()
  if (!providerKey)
    throw new Error('CATALOG_PROVIDER_KEY не задан')
  const publicKey: string = await ecc.privateToPublic(providerKey)

  const bc = new Blockchain(config.network, config.private_keys)
  await bc.update_pass_instance()

  const account = await bc.api.rpc.get_account(OPERATOR)
  const current = account.permissions.find((p: any) => p.perm_name === PERMISSION)
  const keys: string[] = (current?.required_auth.keys ?? []).map((k: any) => k.key)
  if (keys.length === 1 && keys[0] === publicKey) {
    console.log(`✓ ${OPERATOR}@${PERMISSION} уже стоит с ключом провайдера`)
    return
  }

  await bc.api.transact(
    {
      actions: [{
        account: 'eosio',
        name: 'updateauth',
        authorization: [{ actor: OPERATOR, permission: 'active' }],
        data: {
          account: OPERATOR,
          permission: PERMISSION,
          parent: 'active',
          auth: { threshold: 1, keys: [{ key: publicKey, weight: 1 }], accounts: [], waits: [] },
        },
      }],
    },
    { blocksBehind: 3, expireSeconds: 30 },
  )
  console.log(`✓ опубликовано ${OPERATOR}@${PERMISSION}: канал оператора каталога`)
}

main().catch((e) => {
  console.error(`✗ ${OPERATOR}@${PERMISSION}: ${e?.json?.error?.details?.[0]?.message ?? e?.message ?? e}`)
  process.exit(1)
})
