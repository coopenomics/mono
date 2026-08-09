/**
 * Фаза 03 — привязка тестовых пайщиков к кооперативному участку.
 *
 * Зачем. Кооператив работает по двухэтапной системе управления, поэтому
 * пайщик без участка при каждом входе получает полноэкранный диалог «Выберите
 * кооперативный участок». Пока выбор не сохранён, диалог возвращается на
 * каждом заходе и перехватывает клики — ни один сценарий Стола заказов до
 * своего экрана не доходит.
 *
 * Выбор участка — платформенный шаг, а не часть Стола заказов: пайщик
 * подписывает заявление (registry SelectBranchStatement), после чего
 * контроллер пушит выбор в цепь. Гонять эту процедуру в начале каждого
 * UI-сценария значит проверять платформу вместо проверяемого экрана, поэтому
 * она живёт здесь.
 *
 * Ключи. Пайщиков заводит harness через add-plain-participant, и у каждого
 * СВОЙ keypair (общий dev-ключ только у аккаунтов из boot: ant/petr/anna/…),
 * поэтому WIF читаем из state-файлов harness — это единственное место, где они
 * сохранены при создании.
 *
 * Идемпотентна: пайщик, у которого участок уже выбран, пропускается.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client, Mutations } from '@coopenomics/sdk'
import Blockchain from '../../../blockchain'
import config from '../../../configs'

const log = (...a: unknown[]) => console.error('[seed-marketplace:03]', ...a)

const COOPNAME = 'voskhod'
const BRANAME = 'krg'

// Кого привязываем и под каким e-mail логинить. Профили совпадают с реестром
// фикстур harness (components/docs-harness/lib/fixtures.mjs): расхождение имён
// сразу оставит пайщика без участка, а сценарий — с диалогом поверх экрана.
const MEMBERS = ['ekaterina', 'ivanpetrov', 'trustedkrg', 'petrova', 'orderer2']

const STATE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../docs-harness/state/participants',
)

interface IFixture { username: string, email: string, wif: string }

function readFixture(username: string): IFixture | null {
  const file = path.join(STATE_DIR, `${username}.json`)
  if (!fs.existsSync(file)) return null
  const f = JSON.parse(fs.readFileSync(file, 'utf8')) as IFixture
  return f?.wif ? f : null
}

export async function phase03(): Promise<void> {
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  const info = await blockchain.getInfo()
  const chainUrl = `${config.network.protocol}://${config.network.host}${config.network.port}`
  const apiUrl = process.env.CONTROLLER_GRAPHQL_URL || 'http://127.0.0.1:2998/v1/graphql'

  // Участок пайщика хранится в soviet::participants.braname (в таблицах
  // контракта branch его нет — там только сам участок и его доверенные).
  const readAssigned = async () => {
    const rows = await blockchain.getTableRows('soviet', COOPNAME, 'participants', 1000)
      .catch(() => [] as Array<{ username?: string, braname?: string }>)
    return new Set(
      rows.filter((r: { braname?: string }) => !!r.braname)
        .map((r: { username?: string }) => r.username)
        .filter(Boolean) as string[],
    )
  }
  const assigned = await readAssigned()

  for (const username of MEMBERS) {
    if (assigned.has(username)) {
      log(`${username} уже привязан — пропуск`)
      continue
    }
    const fixture = readFixture(username)
    if (!fixture) {
      log(`${username}: нет state-файла с ключом — пропуск (создай фикстуру harness'ом)`)
      continue
    }

    const client = Client.create({
      api_url: apiUrl,
      chain_url: chainUrl,
      chain_id: info.chain_id,
      wif: fixture.wif,
      username,
    })
    try {
      await client.login(fixture.email, fixture.wif)
    }
    catch (e) {
      log(`${username}: логин не прошёл (${(e as Error).message ?? e}) — пропуск`)
      continue
    }

    const genResp = await client.Mutation(Mutations.Branches.GenerateSelectBranchDocument.mutation, {
      variables: {
        data: { coopname: COOPNAME, username, braname: BRANAME },
      } as Mutations.Branches.GenerateSelectBranchDocument.IInput,
    }) as Record<string, Record<string, unknown>>
    const doc = genResp[Mutations.Branches.GenerateSelectBranchDocument.name]

    const signedRaw = await client.Document.signDocument(
      doc as Parameters<typeof client.Document.signDocument>[0],
      username,
    )

    await client.Mutation(Mutations.Branches.SelectBranch.mutation, {
      variables: {
        data: {
          coopname: COOPNAME,
          braname: BRANAME,
          username,
          document: signedRaw,
        },
      } as Mutations.Branches.SelectBranch.IInput,
    })
    log(`${username} → участок ${BRANAME}`)
  }

  // Проверяем результат, а не факт отправки: молчаливый «успех» здесь означал
  // бы, что диалог всё равно встретит сценарий.
  const now = await readAssigned()
  const missing = MEMBERS.filter(m => !now.has(m))
  if (missing.length) log(`внимание: без участка остались ${missing.join(', ')}`)
  else log('все тестовые пайщики привязаны к участку')
}

