/**
 * Фаза 06b — одобрение витрины фонового поставщика.
 *
 * Вызывается НЕ из глобального prepare, а из хвоста сценария
 * chairman/offer-moderation: одобрять витрину раньше нельзя — сценарии
 * catalog-empty и offer-moderation рассчитывают на «до модерации» состояние.
 *
 * Идемпотентна: одобряет только PENDING-предложения sidorov.
 */
import { Client, Mutations, Queries } from '@coopenomics/sdk'
import Blockchain from '../../../blockchain'
import config from '../../../configs'

const log = (...a: unknown[]) => console.error('[seed-marketplace:06b]', ...a)

const CHAIRMAN = 'ant'
const CHAIRMAN_EMAIL = 'ivanov@example.com'
const SUPPLIER = 'sidorov'
const WARRANTY_DAYS = 3

export async function phase06b(): Promise<void> {
  const wif = config.private_keys[0]
  if (!wif) throw new Error('EOSIO_PRV_KEY не задан — председателя нечем логинить')

  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()
  const info = await blockchain.getInfo()

  const chairman = Client.create({
    api_url: process.env.CONTROLLER_GRAPHQL_URL || 'http://127.0.0.1:2998/v1/graphql',
    chain_url: `${config.network.protocol}://${config.network.host}${config.network.port}`,
    chain_id: info.chain_id,
    wif,
    username: CHAIRMAN,
  })
  await chairman.login(CHAIRMAN_EMAIL, wif)

  const listed = await chairman.Query(Queries.Marketplace.ListAllOffers.query, {
    variables: { input: {} },
  } as never) as never as Record<string, { items?: Array<{ id: string, supplier_account: string, product_name: string, status: string }> }>
  const pending = (listed[Queries.Marketplace.ListAllOffers.name]?.items ?? [])
    .filter(o => o.supplier_account === SUPPLIER && o.status === 'PENDING_MODERATION')

  if (!pending.length) {
    log('PENDING-предложений витрины нет — пропуск')
    return
  }
  for (const offer of pending) {
    await chairman.Mutation(Mutations.Marketplace.ApproveOffer.mutation, {
      variables: { input: { offer_id: offer.id, warranty_days: WARRANTY_DAYS } },
    } as never)
    log(`одобрено «${offer.product_name}»`)
  }
  log(`витрина одобрена: ${pending.length} предложений`)
}
