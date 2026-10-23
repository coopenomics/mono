/**
 * Внешний уровень: ключ входа кооператива в каталог приложений (реестр
 * apps.catalog-access, 487-34).
 *
 * Узел с подключённым каталогом сам выпускает ключ и публикует его открытую
 * часть разрешением `<coop>@catalog`: дочернее к active, ровно один ключ, без
 * делегирования. Каталог сверяет по нему подпись входа. Ключ отдельный от
 * ключа кооператива, поэтому его утечка не даёт распоряжаться аккаунтом.
 *
 * Требует поднятого стенда с кооперативом voskhod и каталогом
 * (APPS_CATALOG_DELIVERY_URL у контроллера).
 */
import { describe, expect, it } from 'vitest'
import Blockchain from '../blockchain'
import config from '../configs'

const COOP = 'voskhod'

const bc = new Blockchain(config.network, config.private_keys)

async function permissionsOf(account: string) {
  await bc.update_pass_instance()
  const acc = await bc.api.rpc.get_account(account)
  return (name: string) => acc.permissions.find((p: any) => p.perm_name === name)
}

describe('ключ входа в каталог приложений', () => {
  it('узел опубликовал voskhod@catalog: родитель active, один ключ, без делегирования', async () => {
    const of = await permissionsOf(COOP)
    const catalog = of('catalog')
    expect(catalog).toBeDefined()
    expect(catalog.parent).toBe('active')
    expect(catalog.required_auth.threshold).toBe(1)
    expect(catalog.required_auth.keys).toHaveLength(1)
    expect(catalog.required_auth.accounts).toHaveLength(0)
    expect(catalog.required_auth.waits).toHaveLength(0)
  })

  it('ключ каталога не совпадает ни с одним ключом active и owner', async () => {
    const of = await permissionsOf(COOP)
    const catalogKey = of('catalog').required_auth.keys[0].key
    for (const name of ['active', 'owner']) {
      const keys = (of(name)?.required_auth.keys ?? []).map((k: any) => k.key)
      expect(keys).not.toContain(catalogKey)
    }
  })
})
