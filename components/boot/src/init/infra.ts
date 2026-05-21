import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import axios from 'axios'
import ecc from 'eosjs-ecc'
import { Client as PgClient } from 'pg'
import { Generator, Registry } from '@coopenomics/factory'
import type { Cooperative } from 'cooptypes'
import { BranchContract, DraftContract, RegistratorContract, SovietContract } from 'cooptypes'
import mongoose, { Types } from 'mongoose'
import type { Account, Contract } from '../types'
import config from '../configs'
import Blockchain from '../blockchain'
import { sleep } from '../utils'
import { generateRandomSHA256 } from '../utils/randomHash'
import { initUsersInPostgres, initVaultInPostgres } from '../postgres-init'
import { CooperativeClass } from './cooperative'

export async function startInfra() {
  // инициализируем инстанс с ключами
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  // регистрируем базовые аккаунты
  for (const account of config.accounts) {
    const { name, ownerPublicKey, activePublicKey } = account as Account
    await blockchain.createStandartAccount(
      'eosio',
      name,
      ownerPublicKey || config.default_public_key,
      activePublicKey || config.default_public_key,
    )
  }

  // пре-активируем фичу для запуска
  const url = `${config.network.protocol}://${config.network.host}${config.network.port}`

  try {
    const response = await axios.post(
      `${url}/v1/producer/schedule_protocol_feature_activations`,
      {
        protocol_features_to_activate: [
          '0ec7e080177b2c02b278d5088611686b49d739925a92d9bfcacd7fc6b74053bd',
        ],
      },
    )
    console.log('ok -> init activation: ', response.data)
  }
  catch (e) {
    console.log('error -> init activation: ', e)
  }

  // чуть ждём
  await sleep(1000)

  // устанавливаем биос
  const bios = config.contracts.find(el => el.name === 'eosio.boot')
  await blockchain.setContract(bios as Contract)

  // чуть ждём
  await sleep(2000)

  // активируем все оставшиеся фичи
  for (const feature of config.features)
    await blockchain.activateFeature(feature)

  // чуть ждём
  await sleep(2000)

  // устанавливаем все оставшиеся контракты
  const filtered_contracts = config.contracts.filter(
    el => el.name !== 'eosio.boot',
  )
  for (const contract of filtered_contracts)
    await blockchain.setContract(contract)

  // 2s часто не хватает на свежем nodeos: setabi последнего контракта
  // ещё не финализирован, eosio.token::create падает с
  // "fetching abi for eosio.token: Read past end of buffer".
  await sleep(8000)

  console.log('создаём токен')
  await blockchain.createToken({
    issuer: 'eosio',
    maximum_supply: config.token.max_supply,
  })

  await sleep(2000)

  console.log('выпускаем токены')
  for (const allocation of config.allocations) {
    await blockchain.issueToken({
      to: allocation.to,
      quantity: allocation.quantity,
      memo: '',
    })
  }

  await sleep(2000)

  // выдаём кодовые разрешения всем указанным аккаунтам
  for (const account of config.accounts.filter(
    el => !!el.code_permissions_to,
  )) {
    for (const permission_to of account.code_permissions_to ?? []) {
      await blockchain.updateAccountPermissionsToCode(
        account.name,
        permission_to,
      )
    }
  }

  await sleep(1000)

  // инициализируем системный контракт
  await blockchain.initSystem({
    version: 0,
    core: `${config.token.precision},${config.token.symbol}`,
  })

  await sleep(1000)

  // инициализируем эмиссию
  await blockchain.initEmission({
    init_supply: config.emission.left_border,
    tact_duration: config.emission.tact_duration,
    emission_factor: config.emission.emission_factor,
  })

  await sleep(2000)

  await blockchain.initPowerup({
    args: {
      powerup_days: config.powerup.days,
      min_powerup_fee: config.powerup.min_powerup,
    },
  })

  await sleep(2000)

  for (const id in Registry) {
    const template = Registry[(id as unknown) as keyof typeof Registry]

    await blockchain.createDraft({
      scope: DraftContract.contractName.production,
      username: 'eosio',
      registry_id: id,
      lang: 'ru',
      title: template.Template.title,
      description: template.Template.description,
      context: template.Template.context,
      model: JSON.stringify(template.Template.model),
      translation_data: JSON.stringify(template.Template.translations.ru),
    })
  }

  console.log(`Арендуем ресурсы провайдеру`)
  await blockchain.powerup({
    payer: 'eosio',
    receiver: config.provider,
    days: config.powerup.days,
    payment: `10000.0000 ${config.token.symbol}`,
    transfer: true,
  })

  await blockchain.transfer({
    from: 'eosio',
    to: config.provider,
    quantity: `1000.0000 ${config.token.symbol}`,
    memo: '',
  })

  console.log('Базовая инфраструктура установлена')

  return blockchain
}

export async function installInitialData(blockchain: Blockchain, isExtended = false) {
  const organizationData: Cooperative.Users.IOrganizationData = {
    username: 'voskhod',
    type: 'coop',
    short_name: 'ПК "Восход"',
    full_name: 'Потребительский Кооператив "ВОСХОД"',
    represented_by: {
      first_name: 'Иван',
      last_name: 'Иванов',
      middle_name: 'Иванович',
      position: 'Председатель',
      based_on: 'Решение общего собрания №1',
    },
    country: 'Российская Федерация',
    city: 'Москва',
    fact_address: '117593 г. Москва, муниципальный округ Ясенево, проезд Соловьиный, дом 1, помещение 1/1',
    full_address:
      '117593 г. Москва, муниципальный округ Ясенево, проезд Соловьиный, дом 1, помещение 1/1',
    email: 'copenomics@yandex.ru',
    phone: '+71234567890',
    details: {
      inn: '9728130611',
      ogrn: '1247700283346',
      kpp: '772801001',
    },

  }

  const generator = new Generator()
  // eslint-disable-next-line node/prefer-global/process
  await generator.connect(process.env.MONGO_URI as string)

  await generator.save('organization', organizationData)
  console.log('Провайдер добавлен: ', organizationData)

  await generator.save('paymentMethod', {
    is_default: true,
    method_id: randomUUID(),
    method_type: 'bank_transfer',
    username: 'voskhod',
    data: {
      account_number: '40703810038000110117',
      currency: 'RUB',
      card_number: '',
      bank_name: 'ПАО Сбербанк',
      details: {
        bik: '044525225',
        corr: '30101810400000000225',
        kpp: '773643001',
      },
    },
  })

  const userData: Cooperative.Users.IIndividualData = {
    username: 'ant',
    first_name: 'Иван',
    last_name: 'Иванов',
    middle_name: 'Иванович',
    birthdate: '1990/04/01',
    phone: '+71234567890',
    email: 'ivanov@example.com',
    full_address: 'Переулок Правды д. 1',
    passport: {
      series: 7122,
      number: 112233,
      issued_by: 'отделом УФМС по г. Москва',
      issued_at: '2010/05/10',
      code: '111-232',
    },
  }

  await generator.save('individual', userData)

  // добавляем переменные кооператива
  const vars: Cooperative.Model.IVars = {
    coopname: 'voskhod',
    full_abbr: 'Потребительский Кооператив',
    full_abbr_genitive: 'Потребительского Кооператива',
    full_abbr_dative: 'Потребительскому Кооперативу',
    short_abbr: 'ПК',
    website: 'цифровой-кооператив.рф',
    name: 'Восход',
    confidential_link: 'coopenomics.world/privacy',
    confidential_email: 'privacy@coopenomics.world',
    contact_email: 'contact@coopenomics.world',
    passport_request: 'no',
    wallet_agreement: {
      protocol_number: '10-04-2024',
      protocol_day_month_year: '10 апреля 2024 г.',
    },
    signature_agreement: {
      protocol_number: '10-04-2024',
      protocol_day_month_year: '10 апреля 2024 г.',
    },
    privacy_agreement: {
      protocol_number: '10-04-2024',
      protocol_day_month_year: '10 апреля 2024 г.',
    },
    user_agreement: {
      protocol_number: '10-04-2024',
      protocol_day_month_year: '10 апреля 2024 г.',
    },
    participant_application: {
      protocol_number: '10-04-2024',
      protocol_day_month_year: '10 апреля 2024 г.',
    },
    generator_program: {
      protocol_number: '1',
      protocol_day_month_year: '09.02.2026 10:24',
    },
    generation_contract_template: {
      protocol_number: '2',
      protocol_day_month_year: '09.02.2026 10:24',
    },
    blagorost_program: {
      protocol_number: '3',
      protocol_day_month_year: '09.02.2026 10:24',
    },
    generator_offer_template: {
      protocol_number: '4',
      protocol_day_month_year: '09.02.2026 10:27',
    },
    blagorost_offer_template: {
      protocol_number: '5',
      protocol_day_month_year: '09.02.2026 10:27',
    },
    deleted: false,
    block_num: 1,
  }

  // Сохраняем vars с указанием конкретного _id и _created_at
  // eslint-disable-next-line node/prefer-global/process
  await mongoose.connect(process.env.MONGO_URI as string)

  try {
    await mongoose.connection.collection('vars').insertOne({
      _id: new Types.ObjectId('69898c7d996550b4db4b1a36'),
      _created_at: new Date('2026-02-08T13:29:12.423Z'),
      ...vars,
    })
    console.log('Vars сохранены с указанным _id и _created_at')
  }
  catch (e) {
    console.log('Vars уже существуют, обновляем...')
    await mongoose.connection.collection('vars').updateOne(
      { coopname: 'voskhod' },
      {
        $set: {
          ...vars,
          _created_at: new Date('2026-02-08T13:29:12.423Z'),
        },
      },
    )
  }

  try {
    await mongoose.connection.collection('sync').deleteMany({})
    console.log('Все документы удалены из коллекции sync')
  }
  catch (e) {
    console.error('Ошибка при удалении:', e)
  }

  try {
    await mongoose.connection.collection('actions').deleteMany({})
    console.log('Все документы удалены из коллекции actions')
  }
  catch (e) {
    console.error('Ошибка при удалении:', e)
  }

  try {
    await mongoose.connection.collection('deltas').deleteMany({})
    console.log('Все документы удалены из коллекции deltas')
  }
  catch (e) {
    console.error('Ошибка при удалении:', e)
  }

  // Собираем пользователей для инициализации в PostgreSQL
  const usersToInit = [
    {
      username: 'ant',
      email: 'ivanov@example.com',
      type: 'individual' as const,
      role: 'chairman',
      status: 'active',
      is_registered: true,
    },
  ]

  // имитируем установку
  try {
    await mongoose.connection.collection('monos').insertOne({
      coopname: 'voskhod',
      status: 'active',
    })
  }
  catch (e) {
    console.log('system is exist')
  }
  // сохраняем зашированный ключ в vault
  try {
    await mongoose.connection.collection('vaults').insertOne({
      username: 'voskhod',
      permission: 'active',
      wif: '9d6479a9d77ead53fb0e5e54b3608a95:2046ee3c1577d48aecbee49e8f25c4c2df37ab02f15d73d0d1b6352f53a4b774cb9e71b6028fd7caf64568e195c7878dfbb5d2bf10a3766d90ba9e92ea724428',
    })
  }
  catch (e) { console.log('vault is exist') }

  console.log('Добавляем пайщика ant')

  await blockchain.addUser({
    coopname: 'voskhod',
    referer: '',
    username: 'ant',
    type: 'individual',
    created_at: '2025-01-15T10:00:00',
    initial: '100.0000 RUB',
    minimum: '200.0000 RUB',
    spread_initial: true,
    meta: 'Основатель кооператива ВОСХОД',
    registration_hash: generateRandomSHA256(),
  })

  console.log('Устанавливаем дефолтный публичный ключ для ant')

  await blockchain.changeKey({
    coopname: 'voskhod',
    changer: 'voskhod',
    username: 'ant',
    public_key: config.default_public_key,
  })

  // Если расширенный режим, сначала добавляем дополнительных пайщиков
  if (isExtended) {
    console.log('Добавляем дополнительных пайщиков для расширенного совета')

    const extraUsers = [
      {
        username: 'petr',
        first_name: 'Петр',
        last_name: 'Сидоров',
        middle_name: 'Сергеевич',
        email: 'sidorov@example.com',
      },
      {
        username: 'anna',
        first_name: 'Анна',
        last_name: 'Петрова',
        middle_name: 'Ивановна',
        email: 'petrova@example.com',
      },
      {
        username: 'mikhail',
        first_name: 'Михаил',
        last_name: 'Кузнецов',
        middle_name: 'Андреевич',
        email: 'kuznetsov@example.com',
      },
      {
        username: 'olga',
        first_name: 'Ольга',
        last_name: 'Соколова',
        middle_name: 'Викторовна',
        email: 'sokolova@example.com',
      },
    ]

    for (const user of extraUsers) {
      // Добавляем в MongoDB
      const userData: Cooperative.Users.IIndividualData = {
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        middle_name: user.middle_name,
        birthdate: '1990/04/01',
        phone: '+71234567890',
        email: user.email,
        full_address: 'г. Москва, ул. Примерная д. 1',
        passport: {
          series: 7122,
          number: Math.floor(Math.random() * 900000) + 100000,
          issued_by: 'отделом УФМС по г. Москва',
          issued_at: '2010/05/10',
          code: '111-232',
        },
      }

      await generator.save('individual', userData)

      // Добавляем пользователя в список для PostgreSQL
      usersToInit.push({
        username: user.username,
        email: user.email,
        type: 'individual' as const,
        role: 'member',
        status: 'active',
        is_registered: true,
      })

      console.log(`Добавляем пайщика ${user.username}`)

      // Добавляем в блокчейн
      await blockchain.addUser({
        coopname: 'voskhod',
        referer: user.username === 'petr' ? '' : 'petr',
        username: user.username,
        type: 'individual',
        created_at: '2025-01-15T10:00:00',
        initial: '100.0000 RUB',
        minimum: '300.0000 RUB',
        spread_initial: true,
        meta: `Член совета кооператива ВОСХОД - ${user.first_name} ${user.middle_name} ${user.last_name}`,
        registration_hash: generateRandomSHA256(),
      })

      console.log(`Устанавливаем дефолтный публичный ключ для ${user.username}`)

      await blockchain.changeKey({
        coopname: 'voskhod',
        changer: 'voskhod',
        username: user.username,
        public_key: config.default_public_key,
      })
    }
  }

  console.log('Инициализируем пользователей в PostgreSQL')
  await initUsersInPostgres(usersToInit)

  console.log('Инициализируем vault в PostgreSQL')
  await initVaultInPostgres()

  console.log('Создаём совет')

  const boardMembers: Array<{
    username: string
    is_voting: boolean
    position_title: string
    position: 'chairman' | 'member'
  }> = [
    {
      username: 'ant',
      is_voting: true,
      position_title: 'Председатель совета',
      position: 'chairman',
    },
  ]

  // Если расширенный режим, добавляем дополнительных членов
  if (isExtended) {
    boardMembers.push(
      {
        username: 'petr',
        is_voting: true,
        position_title: 'Член совета',
        position: 'member',
      },
      {
        username: 'anna',
        is_voting: true,
        position_title: 'Член совета',
        position: 'member',
      },
      {
        username: 'mikhail',
        is_voting: true,
        position_title: 'Член совета',
        position: 'member',
      },
      {
        username: 'olga',
        is_voting: true,
        position_title: 'Член совета',
        position: 'member',
      },
    )
  }

  await blockchain.createBoard({
    coopname: 'voskhod',
    username: 'ant',
    type: 'soviet',
    members: boardMembers,
    name: 'Совет',
    description: isExtended ? 'Совет кооператива ВОСХОД (расширенный состав)' : 'Совет кооператива ВОСХОД',
  })

  console.log('Создаём программы и соглашения')

  const cooperative = new CooperativeClass(blockchain)

  await cooperative.createPrograms(config.provider)

  console.log('Начальные данные установлены')
}

// === Marketplace MVP «Стол заказов» фикстуры (см. docs-harness/scenarios/marketplace/PLAN.md §1) ===
// Заводятся в installExtraData чтобы reboot:extra сразу давал рабочий стенд для harness:
//   3 КУ (krg/odn/myt) + 5 ролевых пайщиков + 2 минимальных председателя КУ.
// WIF новых пайщиков сохраняем в components/docs-harness/state/participants/<username>.json,
// чтобы doc-shoot harness ходил под ними не пересоздавая ключи на каждом прогоне.

interface MarketplaceFixture {
  username: string
  first_name: string
  last_name: string
  middle_name: string
  email: string
}

const MARKETPLACE_PARTICIPANTS: MarketplaceFixture[] = [
  // Поток I/II — оба КУ-стороны и приёмки
  { username: 'chairkrg', first_name: 'Пётр', last_name: 'Иванов', middle_name: 'Сергеевич', email: 'chairkrg@voskhod.coop' },
  { username: 'trustedkrg', first_name: 'Михаил', last_name: 'Петров', middle_name: 'Андреевич', email: 'trustedkrg@voskhod.coop' },
  { username: 'opkrg', first_name: 'Александр', last_name: 'Кузнецов', middle_name: 'Владимирович', email: 'opkrg@voskhod.coop' },
  // Поток I/II — поставщик + заказчик
  { username: 'sidorov', first_name: 'Дмитрий', last_name: 'Сидоров', middle_name: 'Николаевич', email: 'sidorov@voskhod.coop' },
  { username: 'petrova', first_name: 'Екатерина', last_name: 'Петрова', middle_name: 'Александровна', email: 'petrova@voskhod.coop' },
  // «Для вида» — без полного штата, чисто чтобы карта ПВЗ была не из одного КУ
  { username: 'chairodn', first_name: 'Сергей', last_name: 'Орлов', middle_name: 'Васильевич', email: 'chairodn@voskhod.coop' },
  { username: 'chairmyt', first_name: 'Алексей', last_name: 'Мытищенко', middle_name: 'Григорьевич', email: 'chairmyt@voskhod.coop' },
]

interface MarketplaceBranchSeed {
  braname: string
  trustee: string
  short_name: string
  full_name: string
  city: string
  fact_address: string
  phone: string
  email: string
  based_on: string
}

const MARKETPLACE_BRANCHES: MarketplaceBranchSeed[] = [
  {
    braname: 'krg',
    trustee: 'chairkrg',
    short_name: 'КУ Красногорск',
    full_name: 'Кооперативный участок «Красногорск»',
    city: 'Красногорск',
    fact_address: 'Московская область, г. Красногорск, ул. Заводская, д. 1',
    phone: '+79991230101',
    email: 'krg@voskhod.coop',
    based_on: 'решение собрания совета №СС-1 от 20 мая 2026 г',
  },
  {
    braname: 'odn',
    trustee: 'chairodn',
    short_name: 'КУ Одинцово',
    full_name: 'Кооперативный участок «Одинцово»',
    city: 'Одинцово',
    fact_address: 'Московская область, г. Одинцово, ул. Центральная, д. 12',
    phone: '+79991230202',
    email: 'odn@voskhod.coop',
    based_on: 'решение собрания совета №СС-1 от 20 мая 2026 г',
  },
  {
    braname: 'myt',
    trustee: 'chairmyt',
    short_name: 'КУ Мытищи',
    full_name: 'Кооперативный участок «Мытищи»',
    city: 'Мытищи',
    fact_address: 'Московская область, г. Мытищи, Олимпийский проспект, д. 5',
    phone: '+79991230303',
    email: 'myt@voskhod.coop',
    based_on: 'решение собрания совета №СС-1 от 20 мая 2026 г',
  },
]

// trusted[] КУ Красногорск — кроме председателя ещё доверенное лицо и оператор.
const MARKETPLACE_TRUSTED_KRG = ['trustedkrg', 'opkrg']

// Кто к какому КУ присоединяется (registry 101 — SelectBranchStatement).
// Это не marketplace-функция, а функция управления: когда у кооператива >=3 КУ
// (см. cooperator_account.is_branched), каждый пайщик обязан выбрать КУ, на
// котором он голосует на общих собраниях. Председатели КУ остаются на «своих»
// участках; председатель кооператива (ant) и совет — на главном (krg).
const PARTICIPANT_BRANCH_ASSIGNMENT: Array<{ username: string, braname: string }> = [
  // Совет — все голосуют через КУ Красногорск (главный)
  { username: 'ant', braname: 'krg' },
  { username: 'petr', braname: 'krg' },
  { username: 'anna', braname: 'krg' },
  { username: 'mikhail', braname: 'krg' },
  { username: 'olga', braname: 'krg' },
  // Marketplace-фикстуры
  { username: 'chairkrg', braname: 'krg' },
  { username: 'trustedkrg', braname: 'krg' },
  { username: 'opkrg', braname: 'krg' },
  { username: 'sidorov', braname: 'krg' },
  { username: 'petrova', braname: 'krg' },
  // Председатели прочих КУ
  { username: 'chairodn', braname: 'odn' },
  { username: 'chairmyt', braname: 'myt' },
]

// Где harness ищет фикстуры по умолчанию. components/boot/src/init/infra.ts → ../../docs-harness/state/participants.
function harnessFixturesDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url))
  return path.resolve(here, '..', '..', '..', 'docs-harness', 'state', 'participants')
}

async function getOnChainActiveKey(blockchain: Blockchain, username: string): Promise<string | null> {
  try {
    const acc = await blockchain.api.rpc.get_account(username)
    const active = acc.permissions?.find((p: any) => p.perm_name === 'active')
    return active?.required_auth?.keys?.[0]?.key ?? null
  }
  catch {
    return null
  }
}

async function ensureMarketplaceExtensionEnabled(pg: PgClient): Promise<void> {
  // Дефолт-конфиг marketplace (из components/controller/.../marketplace/types.ts).
  // schema_version=0 → ExtensionSchemaMigrationService при init coopback пройдёт
  // миграции v1→v6 по порядку; v4 (marketplace-bootstrap-v4) сделает
  // marketplaceCategoryRepository.upsertBaseline() и заполнит marketplace_category.
  const defaultMarketplaceConfig = {
    enabled: true,
    debug: false,
    lastSyncTimestamp: '',
    coopAcceptance: {
      accepted: false,
      document_registry_id: 0,
      accepted_at: '',
      accepted_by_board_decision_id: '',
    },
    writeoff: {
      auto_proposal_enabled: false,
      expiry_grace_days: 7,
    },
  }
  await pg.query(`
    INSERT INTO extensions (name, enabled, schema_version, config, created_at, updated_at)
    VALUES ('market', true, 0, $1::jsonb, NOW(), NOW())
    ON CONFLICT (name) DO NOTHING
  `, [JSON.stringify(defaultMarketplaceConfig)])
  console.log('[mvp] extension `market` активирован (schema_version=0 → миграции v1-v6 при следующем старте coopback)')
}

async function ensureMarketplaceParticipant(
  blockchain: Blockchain,
  generator: Generator,
  pg: PgClient,
  coopname: string,
  fixture: MarketplaceFixture,
): Promise<{ username: string, wif: string | null, publicKey: string }> {
  const existingKey = await getOnChainActiveKey(blockchain, fixture.username)
  let wif: string | null = null
  let publicKey: string

  if (existingKey) {
    console.log(`[mvp] ${fixture.username}: уже on-chain, ключ ${existingKey}`)
    publicKey = existingKey
  }
  else {
    wif = await ecc.randomKey()
    publicKey = ecc.privateToPublic(wif)
    console.log(`[mvp] ${fixture.username}: новый keypair pub=${publicKey}`)

    const addData: RegistratorContract.Actions.AddUser.IAddUser = {
      coopname,
      referer: '',
      username: fixture.username,
      type: 'individual',
      created_at: new Date().toISOString().slice(0, 19),
      initial: '100.0000 RUB',
      minimum: '100.0000 RUB',
      spread_initial: false,
      meta: `Marketplace fixture ${fixture.first_name} ${fixture.last_name}`,
      registration_hash: generateRandomSHA256(),
    }
    await blockchain.api.transact({
      actions: [{
        account: RegistratorContract.contractName.production,
        name: RegistratorContract.Actions.AddUser.actionName,
        authorization: [{ actor: coopname, permission: 'active' }],
        data: addData,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })

    const keyData: RegistratorContract.Actions.ChangeKey.IChangeKey = {
      coopname,
      username: fixture.username,
      public_key: publicKey,
      changer: coopname,
    }
    await blockchain.api.transact({
      actions: [{
        account: RegistratorContract.contractName.production,
        name: RegistratorContract.Actions.ChangeKey.actionName,
        authorization: [{ actor: coopname, permission: 'active' }],
        data: keyData,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })
  }

  // Mongo individual upsert
  const individual: Cooperative.Users.IIndividualData = {
    username: fixture.username,
    first_name: fixture.first_name,
    last_name: fixture.last_name,
    middle_name: fixture.middle_name,
    birthdate: '1990/01/01',
    phone: '+70000000000',
    email: fixture.email,
    full_address: 'Тестовый адрес (marketplace fixture)',
    passport: {
      series: 1111,
      number: 100000 + Math.floor(Math.random() * 899999),
      issued_by: 'УФМС России (тест)',
      issued_at: '2010/01/01',
      code: '000-000',
    },
  }
  await generator.save('individual', individual)

  // PG users upsert
  await pg.query(`
    INSERT INTO "users" (username, email, type, role, status, is_registered,
                        has_account, is_email_verified, public_key,
                        created_at, updated_at)
    VALUES ($1, $2, 'individual', 'user', 'active', true,
            true, true, $3,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (username) DO UPDATE SET
      email = EXCLUDED.email,
      public_key = EXCLUDED.public_key,
      status = 'active',
      is_registered = true,
      updated_at = CURRENT_TIMESTAMP
  `, [fixture.username, fixture.email, publicKey])

  return { username: fixture.username, wif, publicKey }
}

async function ensureMarketplaceBranch(
  blockchain: Blockchain,
  generator: Generator,
  coopname: string,
  b: MarketplaceBranchSeed,
) {
  // Mongo organization upsert (для desktop UI «Реестр КУ»)
  const orgData: Cooperative.Users.IOrganizationData = {
    username: b.braname,
    type: 'coop',
    short_name: b.short_name,
    full_name: b.full_name,
    represented_by: {
      first_name: '',
      last_name: '',
      middle_name: '',
      position: 'председатель кооперативного участка',
      based_on: b.based_on,
    },
    country: 'Российская Федерация',
    city: b.city,
    fact_address: b.fact_address,
    full_address: b.fact_address,
    email: b.email,
    phone: b.phone,
    details: { inn: '', ogrn: '', kpp: '' },
  }
  try {
    await generator.save('organization', orgData)
  }
  catch (e: any) {
    console.log(`[mvp] organization ${b.braname} save failed: ${e.message ?? e}`)
  }

  // On-chain createbranch (idempotent)
  const existing = await blockchain.api.rpc.get_table_rows({
    code: 'branch',
    scope: coopname,
    table: 'branches',
    lower_bound: b.braname,
    upper_bound: b.braname,
    limit: 1,
  }).catch(() => ({ rows: [] }))

  if (existing.rows && existing.rows.length > 0) {
    console.log(`[mvp] createbranch ${b.braname}: уже on-chain, пропускаю`)
    return
  }

  const data: BranchContract.Actions.CreateBranch.ICreateBranch = {
    coopname,
    braname: b.braname,
    trustee: b.trustee,
  }
  await blockchain.api.transact({
    actions: [{
      account: BranchContract.contractName.production,
      name: BranchContract.Actions.CreateBranch.actionName,
      authorization: [{ actor: coopname, permission: 'active' }],
      data,
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
  console.log(`[mvp] createbranch ${b.braname} → trustee=${b.trustee} OK`)
}

// Эмулирует процесс «выбора КУ пайщиком»: генерирует псевдо-документ
// (registry 101 SelectBranchStatement) с meta {coopname, username, braname} и
// отправляет on-chain soviet::selectbranch action под кооперативной active-permission
// (как делает backend branch.adapter.ts:selectBranch). После этого
// participant_account.braname для пользователя on-chain становится `braname`
// → desktop watch-branch-overlay видит noBraname=false и не показывает overlay.
//
// `userWif` — приватный ключ пайщика. Контракт soviet::selectbranch вызывает
// verify_document_or_fail → assert_recover_key(sig.signed_hash, sig.signature,
// sig.public_key) для каждой подписи. Поэтому signature ДОЛЖНА быть реальной
// ECDSA подписью signed_hash приватным ключом пайщика, иначе action падает
// «expected key different than recovered key».
async function ensureParticipantBranchOnChain(
  blockchain: Blockchain,
  coopname: string,
  username: string,
  braname: string,
  userWif: string,
) {
  // Idempotent reboot:extra: skip если пайщик уже на этом КУ
  try {
    const acc = await blockchain.api.rpc.get_table_rows({
      code: 'registrator',
      scope: coopname,
      table: 'accounts',
      lower_bound: username,
      upper_bound: username,
      limit: 1,
      json: true,
    })
    const current = acc?.rows?.[0]?.participant_account?.braname
    if (current === braname) {
      console.log(`[mvp] selectbranch ${username} → ${braname}: уже выбран, пропускаю`)
      return
    }
  }
  catch {}

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  // Уникальный hash для каждого пайщика — иначе soviet::newsubmitted ругается на duplicate
  const seed = `${coopname}/${username}/${braname}/${Date.now()}/${Math.random()}`
  const hash: string = ecc.sha256(seed)
  const publicKey: string = ecc.privateToPublic(userWif)
  const signature: string = ecc.signHash(hash, userWif)

  const document: any = {
    version: '1.0.0',
    hash,
    doc_hash: hash,
    meta_hash: hash,
    meta: JSON.stringify({
      registry_id: 101,
      coopname,
      username,
      braname,
      created_at: now,
    }),
    signatures: [{
      id: 1,
      signed_hash: hash,
      signer: username,
      public_key: publicKey,
      signature,
      signed_at: now.replace(' ', 'T'),
      meta: '{}',
    }],
  }

  const data = {
    coopname,
    username,
    braname,
    document,
  } as SovietContract.Actions.Branches.SelectBranch.ISelectBranch
  try {
    await blockchain.api.transact({
      actions: [{
        account: SovietContract.contractName.production,
        name: SovietContract.Actions.Branches.SelectBranch.actionName,
        authorization: [{ actor: coopname, permission: 'active' }],
        data,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })
    console.log(`[mvp] selectbranch ${username} → ${braname} OK`)
  }
  catch (e: any) {
    console.log(`[mvp] selectbranch ${username} → ${braname} failed: ${e.message ?? e}`)
  }
}

async function ensureMarketplaceTrusted(
  blockchain: Blockchain,
  coopname: string,
  braname: string,
  trusted: string,
) {
  const data: BranchContract.Actions.AddTrusted.IAddTrusted = {
    coopname,
    braname,
    trusted,
  }
  try {
    await blockchain.api.transact({
      actions: [{
        account: BranchContract.contractName.production,
        name: BranchContract.Actions.AddTrusted.actionName,
        authorization: [{ actor: coopname, permission: 'active' }],
        data,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })
    console.log(`[mvp] addtrusted ${braname} ← ${trusted} OK`)
  }
  catch (e: any) {
    const msg = String(e.message ?? e)
    if (msg.includes('already')) {
      console.log(`[mvp] addtrusted ${braname} ← ${trusted}: уже добавлен`)
    }
    else {
      console.log(`[mvp] addtrusted ${braname} ← ${trusted} failed: ${msg}`)
    }
  }
}

export async function installExtraData(blockchain: Blockchain) {
  console.log('=== Marketplace MVP фикстуры (PLAN.md §1) ===')

  const coopname = config.provider
  const mongoUri = process.env.MONGO_URI
  if (!mongoUri) throw new Error('MONGO_URI не задан — installExtraData требует Mongo для individual/organization')

  const generator = new Generator()
  await generator.connect(mongoUri)

  const pg = new PgClient({
    host: process.env.POSTGRES_HOST,
    port: Number.parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
  })
  await pg.connect()

  // 1. Создаём 7 ролевых пайщиков (включая 3 trustee для КУ).
  // Заодно собираем WIFs для использования в selectBranch шаге ниже.
  const fixturesDir = harnessFixturesDir()
  try {
    fs.mkdirSync(fixturesDir, { recursive: true })
  }
  catch {}

  // Совет (ant/petr/anna/mikhail/olga) использует общий default WIF — он же
  // EOSIO_PRV_KEY (см. installInitialData → blockchain.changeKey задаёт всем
  // default_public_key). Marketplace-фикстуры — свои random WIFs.
  const userWifs: Record<string, string> = {
    ant: config.private_keys[0],
    petr: config.private_keys[0],
    anna: config.private_keys[0],
    mikhail: config.private_keys[0],
    olga: config.private_keys[0],
  }

  for (const fixture of MARKETPLACE_PARTICIPANTS) {
    try {
      const r = await ensureMarketplaceParticipant(blockchain, generator, pg, coopname, fixture)
      if (r.wif) {
        userWifs[fixture.username] = r.wif
        const fp = path.join(fixturesDir, `${fixture.username}.json`)
        fs.writeFileSync(fp, JSON.stringify({
          username: fixture.username,
          email: fixture.email,
          wif: r.wif,
          publicKey: r.publicKey,
          coopname,
        }))
        console.log(`[mvp] fixture saved → ${fp}`)
      }
      else {
        // Reboot после которого пайщик уже on-chain — попробуем прочитать WIF из state/<username>.json
        try {
          const fp = path.join(fixturesDir, `${fixture.username}.json`)
          if (fs.existsSync(fp)) {
            const cached = JSON.parse(fs.readFileSync(fp, 'utf8'))
            if (cached.wif) userWifs[fixture.username] = cached.wif
          }
        }
        catch {}
      }
    }
    catch (e: any) {
      console.log(`[mvp] participant ${fixture.username} failed: ${e.message ?? e}`)
    }
  }

  // 2. Создаём 3 КУ (krg/odn/myt) — trustee должны быть уже on-chain
  for (const b of MARKETPLACE_BRANCHES)
    await ensureMarketplaceBranch(blockchain, generator, coopname, b)

  // 3. Доверенные лица КУ Красногорск (доверенное лицо + оператор)
  for (const trusted of MARKETPLACE_TRUSTED_KRG)
    await ensureMarketplaceTrusted(blockchain, coopname, 'krg', trusted)

  // 4. Выбор КУ для каждого пайщика (registry 101 SelectBranchStatement).
  // После создания >=3 КУ кооператив стал is_branched=true, и каждый пайщик
  // обязан выбрать КУ — иначе на первом входе показывается blocking overlay.
  // Это требование управления (общие собрания), не marketplace.
  for (const a of PARTICIPANT_BRANCH_ASSIGNMENT) {
    const wif = userWifs[a.username]
    if (!wif) {
      console.log(`[mvp] selectbranch ${a.username}: WIF не найден, пропускаю`)
      continue
    }
    await ensureParticipantBranchOnChain(blockchain, coopname, a.username, a.braname, wif)
  }

  // 5. Активируем extension `market` в реестре расширений кооператива.
  // Без этой записи MarketplacePlugin.initialize() бросает «Конфиг не найден»,
  // bootstrap-миграции v1-v6 не запускаются → marketplace_category пустая →
  // фронт UI Стола заказов («Категория *» в форме offer-create) залипает на
  // валидации. В проде это делает chairman через GraphQL installExtension;
  // в boot:extra сидируем напрямую через PG с schema_version=0, чтобы при
  // следующем старте coopback миграции прогнались по порядку и засеяли
  // baseline-категории (9 продовольственных + «Прочее»).
  await ensureMarketplaceExtensionEnabled(pg)

  await pg.end()
  await mongoose.disconnect().catch(() => {})

  console.log('=== Marketplace MVP фикстуры установлены ===')
}
