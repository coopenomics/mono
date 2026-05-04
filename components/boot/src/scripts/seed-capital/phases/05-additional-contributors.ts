/**
 * Фаза 05 — регистрация дополнительных пайщиков как Contributor в Капитале.
 *
 * Для серии инструкций по «Генерации» нужны минимум три участника:
 * `ant` (председатель, регистрируется фазой 04) + `ivanpetrov` + `ekaterina`.
 * Они будут авторами/исполнителями компонента и голосуют по Водянову друг
 * за друга при приёмке результата.
 *
 * Фаза идёт по тому же пути, что и `04-contributor.ts`, но параметризованно:
 * для каждого пайщика — Generate → Sign → Complete. Идемпотентна (Generate
 * на уже зарегистрированного отдаёт пустой bundle или ошибку).
 *
 * WIF и email пайщиков читаются из `components/docs-harness/state/participants/<u>.json`
 * — единый источник истины для тестовых фикстур (см. orchestrator
 * `components/docs-harness/bin/shoot.mjs`). Фикстуры создаёт orchestrator
 * через `add-plain-participant.ts` до запуска seed-фаз.
 */
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Client, Mutations } from '@coopenomics/sdk'
import Blockchain from '../../../blockchain'
import config from '../../../configs'

const log = (...a: unknown[]) => console.error('[seed-capital:05]', ...a)

const COOPNAME = 'voskhod'

const here = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(here, '../../../../../..')
const STATE_DIR = path.join(REPO_ROOT, 'components/docs-harness/state/participants')

interface IFixture {
  username: string
  email: string
  wif: string
}

function readFixture(username: string): IFixture {
  const file = path.join(STATE_DIR, `${username}.json`)
  if (!fs.existsSync(file)) {
    throw new Error(
      `Фикстура «${username}» не найдена: ${file}. ` +
      `Перед запуском фазы 05 orchestrator (bin/shoot.mjs) должен создать её через add-plain-participant. ` +
      `Если ты запускаешь фазу руками — добавь имя в meta.fixtures сценария или создай файл через add-plain-participant.ts вручную.`,
    )
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as { username?: string; email?: string; wif?: string }
  if (!data.wif || !data.email) {
    throw new Error(`Фикстура ${file}: отсутствует wif или email. Содержимое: ${JSON.stringify(data)}`)
  }
  return { username, email: data.email, wif: data.wif }
}

interface IGeneratedDoc {
  uuid?: string
  hash: string
  html: string
  meta: Record<string, unknown> | string
  binary?: string
  full_title?: string
}

interface IRegDocsBundle {
  generation_contract?: IGeneratedDoc
  storage_agreement: IGeneratedDoc
  blagorost_agreement?: IGeneratedDoc
  generator_offer?: IGeneratedDoc
}

interface IContributorProfile {
  about: string
  rate_per_hour: string
  hours_per_day: number
}

const PROFILES: Record<string, IContributorProfile> = {
  ivanpetrov: { about: 'Разработчик. Полный стек.', rate_per_hour: '1500', hours_per_day: 8 },
  ekaterina: { about: 'Дизайнер интерфейсов и проектировщик.', rate_per_hour: '1200', hours_per_day: 6 },
}

async function registerContributor(
  fix: IFixture,
  apiUrl: string,
  chainUrl: string,
  chainId: string,
): Promise<void> {
  const client = Client.create({
    api_url: apiUrl,
    chain_url: chainUrl,
    chain_id: chainId,
    wif: fix.wif,
    username: fix.username,
  })
  log(`логин ${fix.email} (${fix.username})...`)
  await client.login(fix.email, fix.wif)

  log(`GenerateCapitalRegistrationDocuments → ${fix.username}`)
  let bundle: IRegDocsBundle | undefined
  try {
    const genResp = await client.Mutation(
      Mutations.Capital.GenerateCapitalRegistrationDocuments.mutation,
      {
        variables: {
          data: {
            coopname: COOPNAME,
            username: fix.username,
            lang: 'ru',
          },
        } as Mutations.Capital.GenerateCapitalRegistrationDocuments.IInput,
      },
    ) as Record<string, IRegDocsBundle>
    bundle = genResp[Mutations.Capital.GenerateCapitalRegistrationDocuments.name]
  } catch (e) {
    log(`Generate отказал для ${fix.username} — вероятно уже зарегистрирован: ${(e as Error).message ?? e}`)
    return
  }
  if (!bundle?.storage_agreement) {
    log(`controller вернул пустой bundle для ${fix.username} — пропуск`)
    return
  }

  const signed: Record<string, unknown> = {}
  let sigId = 1
  for (const key of ['generation_contract', 'storage_agreement', 'blagorost_agreement', 'generator_offer'] as const) {
    const doc = bundle[key]
    if (!doc) continue
    log(`подписываю ${key} (${fix.username}, id=${sigId})`)
    signed[key] = await client.Document.signDocument(
      doc as Parameters<typeof client.Document.signDocument>[0],
      fix.username,
      sigId++,
    )
  }

  const profile = PROFILES[fix.username] ?? { about: '', rate_per_hour: '0', hours_per_day: 0 }
  log(`CompleteCapitalRegistration → ${fix.username}`)
  await client.Mutation(
    Mutations.Capital.CompleteCapitalRegistration.mutation,
    {
      variables: {
        data: {
          coopname: COOPNAME,
          username: fix.username,
          ...signed,
          about: profile.about,
          rate_per_hour: profile.rate_per_hour,
          hours_per_day: profile.hours_per_day,
        },
      } as Mutations.Capital.CompleteCapitalRegistration.IInput,
    },
  )
  log(`Contributor зарегистрирован: ${fix.username}`)
}

export async function phase05(): Promise<void> {
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  const info = await blockchain.getInfo()
  const chainId = info.chain_id
  const chainUrl = `${config.network.protocol}://${config.network.host}${config.network.port}`
  const apiUrl = process.env.CONTROLLER_GRAPHQL_URL || 'http://127.0.0.1:2998/v1/graphql'

  for (const username of ['ivanpetrov', 'ekaterina']) {
    const fix = readFixture(username)
    await registerContributor(fix, apiUrl, chainUrl, chainId)
  }

  log('фаза 05 завершена')
}
