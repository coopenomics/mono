/**
 * Фаза 12 — пересчёт сегментов и расчёт голосов после голосования.
 *
 * После phase 11 компонент в статусе `result`, но сегменты застряли в
 * `generation` с `is_votes_calculated=0` и `voting_bonus=0`. На странице
 * «Результаты компонента» это та точка, где пайщики видят кнопки
 * «Пересчитать результат» и «Рассчитать голоса». В будущем шаг будет
 * автоматическим — пока вызываем явно.
 *
 * Сценарий:
 *   1) Для каждого участника компонента — `capital::rfrshsegment`
 *      (пересчёт CRPS-полей; статус сегмента: generation → ready).
 *   2) Для каждого участника с has_vote=true — `capital::calcvotes`
 *      (расчёт voting_bonus по методу Водянова; is_votes_calculated=true).
 *
 * После фазы:
 *   - все сегменты в статусе `ready`;
 *   - voting_bonus заполнен у тех, кто голосовал;
 *   - на странице «Результаты» становится активной кнопка «Внести результат».
 *
 * Идемпотентно: проверяем status сегмента и is_votes_calculated.
 */
import { CapitalContract } from 'cooptypes'
import { createHash } from 'node:crypto'
import Blockchain from '../../../blockchain'
import config from '../../../configs'

const log = (...a: unknown[]) => console.error('[seed-capital:12]', ...a)

const COOPNAME = 'voskhod'
const COMPONENT_HASH = createHash('sha256').update('blago:project:49').digest('hex')

interface ISegmentRow {
  username: string
  status: string
  has_vote: boolean | number
  is_votes_calculated: boolean | number
}

interface IProjectRow {
  status?: string
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

async function refreshSegment(blockchain: Blockchain, username: string) {
  log(`capital::rfrshsegment ${username}`)
  await blockchain.api.transact({
    actions: [{
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.RefreshSegment.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        project_hash: COMPONENT_HASH,
        username,
      } as CapitalContract.Actions.RefreshSegment.IRefreshSegment,
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

async function calcVotes(blockchain: Blockchain, username: string) {
  log(`capital::calcvotes ${username}`)
  await blockchain.api.transact({
    actions: [{
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.CalculateVotes.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        project_hash: COMPONENT_HASH,
        username,
      } as CapitalContract.Actions.CalculateVotes.IFinalVoting,
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

export async function phase12(): Promise<void> {
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  const project = await getProject(blockchain)
  if (!project) throw new Error(`компонент MVP v1 не найден`)
  log(`статус компонента: ${project.status}`)
  if (project.status !== 'result' && project.status !== 'finalized') {
    throw new Error(`компонент в статусе ${project.status}; ожидался result (нужны фазы 10+11)`)
  }

  const segments = await getSegments(blockchain)
  log(`сегменты: ${segments.map((s) => `${s.username}(${s.status})`).join(', ')}`)

  // 1) refreshSegment — для каждого, кто ещё в generation.
  for (const s of segments) {
    if (s.status === 'generation') {
      await refreshSegment(blockchain, s.username)
    } else {
      log(`${s.username}: статус ${s.status} — rfrshsegment пропускаем`)
    }
  }

  // 2) calcvotes — для каждого с has_vote=true и is_votes_calculated=false.
  // Перечитываем сегменты после refresh.
  const refreshed = await getSegments(blockchain)
  for (const s of refreshed) {
    if (Boolean(s.has_vote) && !Boolean(s.is_votes_calculated)) {
      await calcVotes(blockchain, s.username)
    } else {
      log(`${s.username}: has_vote=${s.has_vote} votes_calculated=${s.is_votes_calculated} — calcvotes пропускаем`)
    }
  }

  const after = await getSegments(blockchain)
  for (const s of after) {
    log(`итог [${s.username}] status=${s.status} votes_calculated=${s.is_votes_calculated}`)
  }
  log('фаза 12 завершена')
}
