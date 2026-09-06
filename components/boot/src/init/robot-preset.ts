/* eslint-disable node/prefer-global/process */
import crypto from 'node:crypto'
import { Client } from 'pg'
import { Cooperative, SovietContract } from 'cooptypes'
import type Blockchain from '../blockchain'
import { GOVERN_SYMBOL, provider } from '../configs'

/** Разрешение аккаунта, ключом которого робот подписывает голоса. */
const ROBOT_PERMISSION = 'robot'

/**
 * Приём пайщика: совет повторяет голос председателя (режим «как председатель»).
 * Решение принимает человек, робот лишь избавляет остальных от четырёх входов
 * в кабинет.
 */
const FOLLOWED_TYPE = 'joincoop'

/**
 * Решения Стола заказов: на стенде они автоматизированы полностью — весь совет
 * вместе с председателем голосует «сразу», протоколы подписывает робот. Так
 * видно, за сколько платформа проводит выдачу и возврат паевого взноса без
 * единого человека; на боевом контуре такой режим совет выбирает сам.
 *
 * Список берётся из общего реестра решений, а не перечисляется здесь: появится
 * новое решение Стола заказов — предустановка подхватит его сама.
 */
function marketplaceTypes(): string[] {
  return Object.values(Cooperative.Document.decisionTypesRegistry)
    .filter(info => info.extension === 'market')
    .map(info => info.type)
}

interface RobotKeyRow {
  member: string
  wif: string
  pub: string
}

/**
 * Ключ робота для стенда выводится из строки, а не случаен: после перезагрузки
 * цепи он тот же самый и восстанавливается, не заглядывая в базу. Годится
 * только для стендов — на боевом контуре ключ создаёт член совета у себя на
 * устройстве и роботу отдаёт только копию.
 */
async function standRobotKey(member: string): Promise<{ wif: string, pub: string }> {
  const ecc = (await import('eosjs-ecc')).default ?? (await import('eosjs-ecc'))
  const wif: string = ecc.seedPrivate(`soviet-robot:${provider}:${member}`)
  return { wif, pub: ecc.privateToPublic(wif) }
}

/** Отдельное разрешение аккаунта с ключом робота и привязка к голосованию. */
async function issueRobotPermission(bc: Blockchain, member: string, pub: string) {
  await bc.update_pass_instance()
  await bc.api.transact({
    actions: [{
      account: 'eosio',
      name: 'updateauth',
      authorization: [{ actor: member, permission: 'active' }],
      data: {
        account: member,
        permission: ROBOT_PERMISSION,
        parent: 'active',
        auth: { threshold: 1, keys: [{ key: pub, weight: 1 }], accounts: [], waits: [] },
      },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })

  for (const type of SovietContract.robotLinkedActions) {
    try {
      await bc.api.transact({
        actions: [{
          account: 'eosio',
          name: 'linkauth',
          authorization: [{ actor: member, permission: 'active' }],
          data: { account: member, code: SovietContract.contractName.production, type, requirement: ROBOT_PERMISSION },
        }],
      }, { blocksBehind: 3, expireSeconds: 30 })
    }
    catch (e: any) {
      // Повторная загрузка на той же цепи: привязка уже стоит.
      if (!/same as old/.test(String(e?.message ?? e)))
        throw e
    }
  }
}

type FollowRule = SovietContract.Interfaces.IFollowRule

/** Запись в реестре автоматизаций контракта совета. */
async function automate(
  bc: Blockchain,
  boardId: number,
  member: string,
  voteTypes: string[],
  followRules: FollowRule[],
  authorizeTypes: string[],
) {
  await bc.update_pass_instance()
  await bc.api.transact({
    actions: [{
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Decisions.Automate.actionName,
      authorization: [{ actor: member, permission: 'active' }],
      data: {
        coopname: provider,
        board_id: boardId,
        member,
        permission_name: ROBOT_PERMISSION,
        vote_types: voteTypes,
        follow_rules: followRules,
        authorize_types: authorizeTypes,
        limit: `0.0000 ${GOVERN_SYMBOL}`,
        expires_at: '1970-01-01T00:00:00',
      },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

/** Тот же шифр, которым секреты кооператива хранит контроллер: aes-256-cbc на sha256(SERVER_SECRET). */
function encryptWif(wif: string): string {
  const key = crypto.createHash('sha256').update(process.env.SERVER_SECRET as string).digest()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  return `${iv.toString('hex')}:${cipher.update(wif, 'utf8', 'hex') + cipher.final('hex')}`
}

/** Одно подключение к базе стенда на операцию: параметры те же, что у контроллера. */
async function withPg<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
  })
  try {
    await client.connect()
    return await fn(client)
  }
  finally {
    await client.end()
  }
}

/** Таблица ключей робота: расширение ставится этой же предустановкой, схему создаём сами. */
async function ensureRobotKeysTable(client: Client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.soviet_robot_keys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      coopname VARCHAR(13) NOT NULL,
      member VARCHAR(13) NOT NULL,
      permission_name VARCHAR(13) NOT NULL,
      encrypted_wif TEXT NOT NULL,
      public_key VARCHAR(80) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "IDX_soviet_robot_keys_coopname_member"
    ON public.soviet_robot_keys (coopname, member)
  `)
}

/**
 * Ключи кладём прямо в хранилище робота, чтобы расширение заработало сразу
 * после включения: штатный путь (мутация делегирования с рабочего стола)
 * требует уже включённого расширения, а здесь его ещё нет.
 */
async function saveRobotKeys(rows: RobotKeyRow[]) {
  await withPg(async (client) => {
    await ensureRobotKeysTable(client)

    for (const row of rows) {
      await client.query(
        `INSERT INTO public.soviet_robot_keys (coopname, member, permission_name, encrypted_wif, public_key)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (coopname, member) DO UPDATE SET
           permission_name = EXCLUDED.permission_name,
           encrypted_wif = EXCLUDED.encrypted_wif,
           public_key = EXCLUDED.public_key,
           updated_at = now()`,
        [provider, row.member, ROBOT_PERMISSION, encryptWif(row.wif), row.pub],
      )
    }
    console.log(`Ключи робота сохранены в хранилище расширения: ${rows.map(r => r.member).join(', ')}`)
  })
}

/**
 * Расширение «Робот совета» на стенде включается сразу: предустановка нужна
 * именно для того, чтобы посмотреть, как решения проходят без людей, а
 * выключенное расширение не сделает ни одного голоса. В обычной загрузке
 * расширения нет вовсе — председатель ставит его из каталога, как любое
 * приложение.
 *
 * Значения конфига повторяют дефолты расширения
 * (`soviet-robot-extension.module.ts`): boot не может импортировать код
 * контроллера, а схема расширения всё равно подставит их при чтении.
 */
async function enableRobotExtension() {
  await withPg(async (client) => {
    await client.query(
      `INSERT INTO "extensions" (name, enabled, config, schema_version, created_at, updated_at)
       VALUES ('robot', true, $1, 1, now(), now())
       ON CONFLICT (name) DO UPDATE SET enabled = true, updated_at = now()`,
      [JSON.stringify({ max_attempts: 5, retry_backoff_sec: 5 })],
    )
    console.log('Расширение «Робот совета» установлено и включено')
  })
}

/** Совет кооператива: идентификатор, председатель и остальные голосующие члены. */
async function readSoviet(bc: Blockchain) {
  const boards: any[] = await bc.getTableRows(SovietContract.contractName.production, provider, 'boards', 100)
  const board = boards.find(b => String(b.type) === 'soviet')
  if (!board)
    throw new Error('Совет кооператива не найден: предустановка робота невозможна')

  const members: any[] = board.members ?? []
  const chairman = members.find(m => String(m.position) === 'chairman')
  if (!chairman)
    throw new Error('В совете нет председателя: предустановка робота невозможна')

  return {
    boardId: Number(board.id),
    chairman: String(chairman.username),
    voters: members
      .filter(m => m.is_voting && String(m.username) !== String(chairman.username))
      .map(m => String(m.username)),
  }
}

/**
 * Предустановка робота решений совета для стенда.
 *
 * Совет из пяти человек — это пять входов в кабинет на каждое решение. После
 * предустановки приёму пайщика хватает голоса председателя: робот повторяет его
 * за остальных, собирает протокол и исполняет решение. Решения Стола заказов
 * идут полностью на роботе — ни одного живого голоса. Само расширение при этом
 * же включается: стенд для того и нужен, чтобы посмотреть, как решения проходят
 * без людей. В обычной загрузке расширения нет — председатель ставит его из
 * каталога, как любое приложение.
 */
export async function installRobotPreset(blockchain: Blockchain): Promise<void> {
  if (!process.env.SERVER_SECRET) {
    console.log('SERVER_SECRET не задан — предустановка робота пропущена')
    return
  }

  const { boardId, chairman, voters } = await readSoviet(blockchain)
  const keys: RobotKeyRow[] = []

  for (const member of [chairman, ...voters]) {
    const key = await standRobotKey(member)
    await issueRobotPermission(blockchain, member, key.pub)
    keys.push({ member, wif: key.wif, pub: key.pub })
  }

  const market = marketplaceTypes()

  // Приём пайщика: голосует председатель, остальные повторяют за ним.
  // Стол заказов: голосуют все и сразу, протоколы подписывает робот, — решение
  // проходит целиком без людей.
  await automate(blockchain, boardId, chairman, market, [], [FOLLOWED_TYPE, ...market])
  for (const member of voters)
    await automate(blockchain, boardId, member, market, [{ decision_type: FOLLOWED_TYPE, follow: chairman }], [])

  await saveRobotKeys(keys)
  await enableRobotExtension()

  console.log(`
Робот совета предустановлен:
 - приём пайщика (${FOLLOWED_TYPE}): голосует председатель ${chairman}, за ним повторяют ${voters.join(', ')};
 - Стол заказов (${market.join(', ')}): голосует весь совет сразу, протоколы подписывает робот — решение проходит без людей.
Расширение «Робот совета» установлено и включено — стенд считает решения сам.
`)
}
