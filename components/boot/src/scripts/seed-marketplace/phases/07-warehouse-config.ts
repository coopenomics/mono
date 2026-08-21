/**
 * Фаза 07 — включение адресного хранения (Эпик 19) для сценариев склада.
 *
 * Боксы и координатные ячейки — включаемые опции конфига расширения «market».
 * По умолчанию всё выключено, и вкладки «Боксы»/«Типы боксов», как и сетка
 * раскладки, в UI не появляются. Документация склада без включённых опций
 * неснимаема.
 *
 * `posting_on_reception_required` оставляем выключенным: обязательное указание
 * места при закрывающей подписи изменило бы поведение сценариев приёмки сюиты.
 *
 * Идемпотентна: если обе опции уже включены — no-op.
 */
import { Client, Mutations, Queries } from '@coopenomics/sdk'
import Blockchain from '../../../blockchain'
import config from '../../../configs'

const log = (...a: unknown[]) => console.error('[seed-marketplace:07]', ...a)

const CHAIRMAN = 'ant'
const CHAIRMAN_EMAIL = 'ivanov@example.com'
const EXTENSION = 'market'

export async function phase07(): Promise<void> {
  const wif = config.private_keys[0]
  if (!wif) throw new Error('EOSIO_PRV_KEY не задан — председателя нечем логинить')

  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()
  const info = await blockchain.getInfo()

  const client = Client.create({
    api_url: process.env.CONTROLLER_GRAPHQL_URL || 'http://127.0.0.1:2998/v1/graphql',
    chain_url: `${config.network.protocol}://${config.network.host}${config.network.port}`,
    chain_id: info.chain_id,
    wif,
    username: CHAIRMAN,
  })
  await client.login(CHAIRMAN_EMAIL, wif)

  const listed = await client.Query(Queries.Extensions.GetExtensions.query, {
    variables: { data: { name: EXTENSION } },
  } as never) as never as Record<string, Array<{ name: string, enabled: boolean, config: Record<string, unknown> }>>
  const ext = (listed[Queries.Extensions.GetExtensions.name] ?? []).find(e => e.name === EXTENSION)
  if (!ext) throw new Error(`расширение «${EXTENSION}» не установлено — сначала boot/установка стола`)

  const warehouse = (ext.config?.warehouse ?? {}) as Record<string, unknown>
  if (warehouse.containers_enabled === true && warehouse.cells_enabled === true) {
    log('боксы и ячейки уже включены — пропуск')
    return
  }

  const nextConfig = {
    ...ext.config,
    warehouse: {
      posting_on_reception_required: false,
      ...warehouse,
      containers_enabled: true,
      cells_enabled: true,
    },
  }

  await client.Mutation(Mutations.Extensions.UpdateExtension.mutation, {
    variables: { data: { name: EXTENSION, enabled: ext.enabled, config: nextConfig } },
  } as never)
  log('адресное хранение включено: containers_enabled=true, cells_enabled=true')
}
