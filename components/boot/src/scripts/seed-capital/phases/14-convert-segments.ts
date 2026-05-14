/**
 * Фаза 14 — конвертация сегментов и финализация проекта.
 *
 * После phase 13 каждый участник в статусе `contributed`. На странице
 * «Результаты» у него активна кнопка «Получить долю» — она открывает
 * диалог с рубильником между Главным кошельком и программой Благорост:
 *
 *   wallet_amount   ─── переводится в Главный кошелёк (свободные средства);
 *                       ограничен available_for_wallet сегмента.
 *   capital_amount  ─── переводится в кошелёк программы Благорост
 *                       (заблокированные паевые взносы; реинвестиция).
 *
 * Сумма wallet_amount + capital_amount = available_for_program (полный
 * размер доли участника). Контракт сам гарантирует, что wallet_amount
 * не превышает available_for_wallet.
 *
 * Чтобы документация показывала разные положения рубильника, для трёх
 * участников выбраны разные стратегии:
 *
 *   ant         → 100 % в Главный кошелёк   (рубильник вправо)
 *   ivanpetrov  → 50 / 50                    (рубильник посередине)
 *   ekaterina   → 100 % в Благорост          (рубильник влево)
 *
 * Если у кого-то available_for_wallet=0, фактический wallet_amount
 * усечётся до 0 — это ограничение контракта, а не фазы.
 *
 * После всех конвертаций — `capital::finalizeproj` (project: result →
 * finalized).
 *
 * Идемпотентно: сегмент после convertsegm удаляется из таблицы;
 * пропускаем участников, у которых сегмента нет.
 */
import { CapitalContract } from 'cooptypes'
import { createHash, randomBytes } from 'node:crypto'
import Blockchain from '../../../blockchain'
import config from '../../../configs'
import { fakeDocument } from '../../../tests/shared/fakeDocument'

const log = (...a: unknown[]) => console.error('[seed-capital:14]', ...a)

const COOPNAME = 'voskhod'
const COMPONENT_HASH = createHash('sha256').update('blago:project:49').digest('hex')

// Доля available_for_wallet, которая уйдёт в Главный кошелёк.
// Остаток (от available_for_program) — в Благорост.
const WALLET_RATIO_BY_USERNAME: Record<string, number> = {
  ant: 1.0,         // рубильник вправо: всё в Главный кошелёк
  ivanpetrov: 0.5,  // 50 / 50
  ekaterina: 0.0,   // рубильник влево: всё в Благорост
}

interface ISegmentRow {
  username: string
  status: string
  available_for_wallet: string
  available_for_program: string
}

interface IProjectRow {
  status?: string
}

function randomSha256(): string {
  return createHash('sha256').update(randomBytes(32)).digest('hex')
}

function parseRub(asset: string): number {
  return parseFloat(asset.split(' ')[0])
}

function fmtRub(amountRub: number): string {
  // Округляем вниз до 4 знаков, чтобы не превысить available.
  const units = Math.floor(amountRub * 10000)
  return `${(units / 10000).toFixed(4)} RUB`
}

async function getProject(blockchain: Blockchain): Promise<IProjectRow | undefined> {
  const rows = await blockchain.getTableRows(
    CapitalContract.contractName.production,
    COOPNAME,
    'projects',
    1,
    COMPONENT_HASH,
    COMPONENT_HASH,
    3,
    'sha256',
  )
  return rows[0]
}

async function getSegments(blockchain: Blockchain): Promise<ISegmentRow[]> {
  return await blockchain.getTableRows(
    CapitalContract.contractName.production,
    COOPNAME,
    'segments',
    100,
    COMPONENT_HASH,
    COMPONENT_HASH,
    2,
    'sha256',
  ) as ISegmentRow[]
}

async function convertSegment(
  blockchain: Blockchain,
  username: string,
  walletAmount: string,
  capitalAmount: string,
) {
  const convertHash = randomSha256()
  log(`capital::convertsegm ${username} → wallet=${walletAmount}, capital=${capitalAmount}`)
  await blockchain.api.transact({
    actions: [{
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.ConvertSegment.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        username,
        project_hash: COMPONENT_HASH,
        convert_hash: convertHash,
        wallet_amount: walletAmount,
        capital_amount: capitalAmount,
        convert_statement: fakeDocument,
      } as CapitalContract.Actions.ConvertSegment.IConvertSegment,
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

async function finalizeProject(blockchain: Blockchain) {
  log(`capital::finalizeproj`)
  await blockchain.api.transact({
    actions: [{
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.FinalizeProject.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        project_hash: COMPONENT_HASH,
      } as CapitalContract.Actions.FinalizeProject.IFinalizeProject,
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

export async function phase14(): Promise<void> {
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  const project = await getProject(blockchain)
  if (!project) throw new Error(`компонент MVP v1 не найден`)
  log(`статус компонента: ${project.status}`)
  if (project.status === 'finalized') {
    log(`компонент уже finalized — фаза no-op`)
    return
  }
  if (project.status !== 'result') {
    throw new Error(`компонент в статусе ${project.status}; ожидался result`)
  }

  const segments = await getSegments(blockchain)
  log(`сегменты к конвертации: ${segments.map((s) => `${s.username}(${s.status})`).join(', ')}`)

  for (const s of segments) {
    if (s.status !== 'contributed') {
      log(`${s.username}: статус ${s.status} (ожидалось contributed) — пропуск`)
      continue
    }
    const ratio = WALLET_RATIO_BY_USERNAME[s.username] ?? 0.0
    const availWallet = parseRub(s.available_for_wallet)
    const availProgram = parseRub(s.available_for_program)

    // Сколько хочется в Главный кошелёк, ограничиваем фактическим лимитом.
    const desiredWallet = availWallet * ratio
    const walletAmount = Math.min(desiredWallet, availWallet)
    const capitalAmount = availProgram - walletAmount

    if (capitalAmount < 0) {
      throw new Error(`${s.username}: capital_amount<0 (avail_program=${availProgram}, wallet=${walletAmount})`)
    }

    log(`${s.username}: avail_wallet=${availWallet}, avail_program=${availProgram}, ratio=${ratio}`)
    await convertSegment(blockchain, s.username, fmtRub(walletAmount), fmtRub(capitalAmount))
  }

  // После всех convertsegm все сегменты компонента удалены из таблицы.
  // Проект можно перевести в finalized.
  const remaining = await getSegments(blockchain)
  if (remaining.length > 0) {
    log(`остались сегменты: ${remaining.map((s) => s.username).join(', ')} — finalizeproj пропускаем`)
  } else {
    await finalizeProject(blockchain)
  }

  const after = await getProject(blockchain)
  log(`фаза 14 завершена — итоговый статус: ${after?.status}`)
}
