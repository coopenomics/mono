/* eslint-disable node/prefer-global/process */
import crypto from 'node:crypto'
import { Client } from 'pg'
import { SovietContract } from 'cooptypes'
import type Blockchain from '../blockchain'
import { GOVERN_SYMBOL, provider } from '../configs'

/** Разрешение аккаунта, ключом которого робот подписывает голоса. */
const ROBOT_PERMISSION = 'robot'

/**
 * Что предустановка отдаёт роботу: приём пайщика. Совет повторяет голос
 * председателя по этому типу решения, остальные типы остаются ручными.
 */
const AUTOMATED_TYPE = 'joincoop'

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

  for (const type of ['votefor', 'voteagainst']) {
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

/** Запись в реестре автоматизаций контракта совета. */
async function automate(bc: Blockchain, boardId: number, member: string, voteTypes: string[], authorizeTypes: string[]) {
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

/** Таблица ключей робота: расширение ещё не включено, схему создаём сами. */
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
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
  })

  try {
    await client.connect()
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
  }
  finally {
    await client.end()
  }
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
 * Совет из пяти человек — это пять входов в кабинет на каждое решение о приёме
 * пайщика. После предустановки хватает голоса председателя: робот повторяет его
 * за остальных, собирает протокол и исполняет решение. Само расширение при этом
 * не включается — председатель включает его сам, а разрешения и ключи уже готовы.
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

  // Председатель — источник воли: голосует он сам, роботу отдаёт только подпись
  // протокола. Остальные члены совета повторяют его голос.
  await automate(blockchain, boardId, chairman, [], [AUTOMATED_TYPE])
  for (const member of voters)
    await automate(blockchain, boardId, member, [AUTOMATED_TYPE], [])

  await saveRobotKeys(keys)

  console.log(`
Робот совета предустановлен на решение о приёме пайщика (${AUTOMATED_TYPE}):
 - председатель ${chairman} голосует сам, протокол подписывает робот;
 - повторяют его голос: ${voters.join(', ')}.
Расширение «Робот совета» выключено — включите его на столе расширений,
разрешения и ключи уже на месте.
`)
}
