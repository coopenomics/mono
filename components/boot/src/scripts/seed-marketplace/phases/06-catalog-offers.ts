/**
 * Фаза 06 — наполненная витрина для скриншотов документации.
 *
 * Каталог с одним-двумя предложениями выглядит на скриншотах как пустой
 * стенд, а не как работающий стол заказов. Фаза заводит десять предложений
 * с фотографиями от «фонового» поставщика sidorov: он существует только ради
 * витрины, поэтому списки «Мои предложения» рабочих поставщиков сценариев
 * (ivanpetrov) остаются управляемыми.
 *
 * Требует фаз 01–05 (sidorov добавлен в SUPPLIERS фазы 04 и MEMBERS фазы 05)
 * и фикстуры docs-harness state/participants/sidorov.json.
 *
 * Идемпотентна: предложение пропускается, если у sidorov уже есть offer с тем
 * же product_name (любой статус). Одобрение председателем — только для только
 * что созданных.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client, Mutations, Queries, Zeus } from '@coopenomics/sdk'
import Blockchain from '../../../blockchain'
import config from '../../../configs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ASSETS_DIR = path.resolve(HERE, '../assets')
const STATE_DIR = path.resolve(HERE, '../../../../../docs-harness/state/participants')

const log = (...a: unknown[]) => console.error('[seed-marketplace:06]', ...a)

const CHAIRMAN = 'ant'
const CHAIRMAN_EMAIL = 'ivanov@example.com'
const SUPPLIER = 'sidorov'
const BRANAME = 'krg'

/** Категории витрины из базового справочника (marketplace-category.entity.ts). */
const CATEGORY_IDS = [1, 2, 5, 9]

interface SeedOffer {
  /** Имя файла фотографии в assets (без расширения). */
  slug: string
  product_name: string
  description: string
  category_id: number
  price_per_unit: string
  unit_of_measure: Zeus.MarketplaceUnitOfMeasure
  shelf_life_days: number
  min_supply_volume: number
}

const OFFERS: SeedOffer[] = [
  { slug: 'kartofel', product_name: 'Картофель деревенский', description: 'Картофель разных сортов нового урожая, выращен без химических удобрений. Хранится в прохладном месте.', category_id: 1, price_per_unit: '45.00', unit_of_measure: Zeus.MarketplaceUnitOfMeasure.KG, shelf_life_days: 30, min_supply_volume: 25 },
  { slug: 'morkov', product_name: 'Морковь с ботвой', description: 'Свежая морковь пучками, с грядки. Ботва пригодна для салатов и заготовок.', category_id: 1, price_per_unit: '60.00', unit_of_measure: Zeus.MarketplaceUnitOfMeasure.KG, shelf_life_days: 21, min_supply_volume: 10 },
  { slug: 'yabloki', product_name: 'Яблоки сезонные', description: 'Сладкие хрустящие яблоки из собственного сада. Сорт сезона, без парафина.', category_id: 1, price_per_unit: '120.00', unit_of_measure: Zeus.MarketplaceUnitOfMeasure.KG, shelf_life_days: 21, min_supply_volume: 15 },
  { slug: 'ogurtsy', product_name: 'Огурцы грунтовые', description: 'Хрустящие огурцы открытого грунта, собраны накануне поставки.', category_id: 1, price_per_unit: '150.00', unit_of_measure: Zeus.MarketplaceUnitOfMeasure.KG, shelf_life_days: 7, min_supply_volume: 10 },
  { slug: 'tomaty', product_name: 'Томаты сливовидные', description: 'Мясистые томаты для салатов и заготовок. Дозревают при комнатной температуре.', category_id: 1, price_per_unit: '180.00', unit_of_measure: Zeus.MarketplaceUnitOfMeasure.KG, shelf_life_days: 7, min_supply_volume: 10 },
  { slug: 'moloko', product_name: 'Молоко цельное', description: 'Цельное коровье молоко утренней дойки. Не сепарировано, жирность естественная.', category_id: 2, price_per_unit: '90.00', unit_of_measure: Zeus.MarketplaceUnitOfMeasure.LITER, shelf_life_days: 5, min_supply_volume: 20 },
  { slug: 'tvorog', product_name: 'Творог фермерский', description: 'Творог из цельного молока, традиционная закваска. Жирность 9%.', category_id: 2, price_per_unit: '350.00', unit_of_measure: Zeus.MarketplaceUnitOfMeasure.KG, shelf_life_days: 7, min_supply_volume: 5 },
  { slug: 'khleb', product_name: 'Хлеб подовый ржано-пшеничный', description: 'Подовый хлеб на закваске, выпечка в день поставки. Вес буханки около 700 г.', category_id: 5, price_per_unit: '140.00', unit_of_measure: Zeus.MarketplaceUnitOfMeasure.PIECE, shelf_life_days: 3, min_supply_volume: 20 },
  { slug: 'yaytsa', product_name: 'Яйца куриные домашние', description: 'Яйца кур свободного выгула. Цена за штуку, заказ любым количеством.', category_id: 9, price_per_unit: '12.00', unit_of_measure: Zeus.MarketplaceUnitOfMeasure.PIECE, shelf_life_days: 30, min_supply_volume: 60 },
  { slug: 'med', product_name: 'Мёд цветочный', description: 'Мёд разнотравья с собственной пасеки, урожай этого года. Без подкормки сахаром.', category_id: 9, price_per_unit: '600.00', unit_of_measure: Zeus.MarketplaceUnitOfMeasure.KG, shelf_life_days: 0, min_supply_volume: 3 },
]

interface ParticipantState {
  username: string
  email: string
  wif: string
}

async function makeClient(username: string, email: string, wif: string) {
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()
  const info = await blockchain.getInfo()
  const client = Client.create({
    api_url: process.env.CONTROLLER_GRAPHQL_URL || 'http://127.0.0.1:2998/v1/graphql',
    chain_url: `${config.network.protocol}://${config.network.host}${config.network.port}`,
    chain_id: info.chain_id,
    wif,
    username,
  })
  await client.login(email, wif)
  return client
}

export async function phase06(): Promise<void> {
  const chairmanWif = config.private_keys[0]
  if (!chairmanWif) throw new Error('EOSIO_PRV_KEY не задан — председателя нечем логинить')

  const stateFile = path.join(STATE_DIR, `${SUPPLIER}.json`)
  if (!fs.existsSync(stateFile)) {
    throw new Error(`нет ${stateFile} — сначала фикстура «${SUPPLIER}» (docs-harness ensureFixture)`)
  }
  const supplier = JSON.parse(fs.readFileSync(stateFile, 'utf8')) as ParticipantState

  const chairman = await makeClient(CHAIRMAN, CHAIRMAN_EMAIL, chairmanWif)

  // Категории витрины: сервер отбивает дубликаты — повторный вызов не ошибка.
  try {
    await chairman.Mutation(Mutations.Marketplace.AddAvailableCategories.mutation, {
      variables: { input: { categoryIds: CATEGORY_IDS } },
    } as never)
    log(`категории ${CATEGORY_IDS.join(', ')} включены`)
  }
  catch (e) {
    log(`категории уже включены (${(e as Error).message.slice(0, 80)})`)
  }

  try {
    await chairman.Mutation(Mutations.Marketplace.AddSupplier.mutation, {
      variables: { input: { member_account: SUPPLIER } },
    } as never)
    log(`${SUPPLIER} добавлен в реестр поставщиков`)
  }
  catch (e) {
    log(`${SUPPLIER} уже в реестре (${(e as Error).message.slice(0, 80)})`)
  }

  // Существующие предложения sidorov — идемпотентность по product_name.
  const listed = await chairman.Query(Queries.Marketplace.ListAllOffers.query, {
    variables: { input: {} },
  } as never) as never as Record<string, { items?: Array<{ supplier_account: string, product_name: string }> }>
  const existing = new Set(
    (listed[Queries.Marketplace.ListAllOffers.name]?.items ?? [])
      .filter(o => o.supplier_account === SUPPLIER)
      .map(o => o.product_name),
  )

  const sidorov = await makeClient(supplier.username, supplier.email, supplier.wif)

  for (const offer of OFFERS) {
    if (existing.has(offer.product_name)) {
      log(`«${offer.product_name}» уже есть — пропуск`)
      continue
    }
    const imagePath = path.join(ASSETS_DIR, `${offer.slug}.jpg`)
    if (!fs.existsSync(imagePath)) throw new Error(`нет фотографии ${imagePath}`)
    const base64 = fs.readFileSync(imagePath).toString('base64')

    const created = await sidorov.Mutation(Mutations.Marketplace.CreateOffer.mutation, {
      variables: {
        input: {
          product_name: offer.product_name,
          description: offer.description,
          category_id: offer.category_id,
          price_per_unit: offer.price_per_unit,
          unit_of_measure: offer.unit_of_measure,
          quantity_available: null,
          unlimited_flag: true,
          delivery_points: [{ braname: BRANAME, min_supply_volume: offer.min_supply_volume }],
          shelf_life_days: offer.shelf_life_days,
          images: [{ base64, mime_type: 'image/jpeg' }],
        },
      },
    } as never) as never as Record<string, { id: string }>
    const offerId = created[Mutations.Marketplace.CreateOffer.name]?.id
    if (!offerId) throw new Error(`createOffer не вернул id для «${offer.product_name}»`)
    log(`создано «${offer.product_name}» (${offerId})`)

    await chairman.Mutation(Mutations.Marketplace.ApproveOffer.mutation, {
      variables: { input: { offer_id: offerId, warranty_days: 3 } },
    } as never)
    log(`одобрено «${offer.product_name}»`)
  }

  log('витрина наполнена')
}
