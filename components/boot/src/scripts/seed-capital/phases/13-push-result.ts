/**
 * Фаза 13 — внесение паевого взноса по результатам интеллектуальной
 * деятельности (РИД).
 *
 * Контекст: после phase 12 сегменты в статусе `ready`, voting_bonus
 * рассчитан, intellectual_cost известен. Дальше каждый участник с
 * ненулевой интеллектуальной стоимостью оформляет паевой взнос РИД:
 *
 *   1) `capital::pushrslt` — заявление на внесение результата;
 *      создаёт запись в таблице `results` (статус `created`),
 *      сегмент: ready → statement.
 *   2) `soviet::confirmapprv` (председатель) — одобрение результата
 *      (запускает процедуру совета).
 *   3) `soviet::voteFor + authorize + exec` (председатель) —
 *      обработка решения совета; результат: authorized,
 *      сегмент: statement → approved → authorized.
 *   4) `capital::signact1` — пайщик подписывает Акт №1
 *      (приёма-передачи РИД); сегмент: authorized → act1.
 *   5) `capital::signact2` — председатель подписывает Акт №2;
 *      сегмент: act1 → contributed.
 *
 * После фазы:
 *   - все участники с intellectual_cost>0 в статусе `contributed`;
 *   - сегмент готов к конвертации (фаза 14).
 *
 * Идемпотентно: пропускаем участников с status === 'contributed'.
 *
 * Подписи в seed-фазе — фейковые (как в тестах капитала). Реальный
 * UI-сценарий генерирует документы через SDK и подписывает ключом
 * пайщика; для документации этого уровня детализации не требуется.
 */
import { CapitalContract, SovietContract } from 'cooptypes'
import { createHash, randomBytes } from 'node:crypto'
import Blockchain from '../../../blockchain'
import config from '../../../configs'
import { setDocumentSignatures } from '../../../utils/setDocumentSignatures'
import { fakeDocument } from '../../../tests/shared/fakeDocument'
import { fakeVote } from '../../../tests/shared/fakeVote'

const log = (...a: unknown[]) => console.error('[seed-capital:13]', ...a)

const COOPNAME = 'voskhod'
const CHAIRMAN = 'ant'
const COMPONENT_HASH = createHash('sha256').update('blago:project:49').digest('hex')

interface ISegmentRow {
  username: string
  status: string
  is_author: boolean | number
  is_creator: boolean | number
  intellectual_cost: string
}

function randomSha256(): string {
  return createHash('sha256').update(randomBytes(32)).digest('hex')
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

async function pushResult(
  blockchain: Blockchain,
  username: string,
  contributionAmount: string,
  resultHash: string,
  statement: ReturnType<typeof setDocumentSignatures>,
) {
  log(`capital::pushrslt ${username} → contribution=${contributionAmount} (result_hash=${resultHash.slice(0, 12)}...)`)
  await blockchain.api.transact({
    actions: [{
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.PushResult.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        username,
        project_hash: COMPONENT_HASH,
        result_hash: resultHash,
        contribution_amount: contributionAmount,
        debt_amount: '0.0000 RUB',
        statement,
        debt_hashes: [],
      } as CapitalContract.Actions.PushResult.IPushResult,
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

async function sovietApprove(blockchain: Blockchain, approvalHash: string) {
  log(`soviet::confirmapprv ${CHAIRMAN} → ${approvalHash.slice(0, 12)}...`)
  const approvedDoc = JSON.parse(JSON.stringify(fakeDocument))
  approvedDoc.signatures[0].signer = CHAIRMAN
  await blockchain.api.transact({
    actions: [{
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Approves.ConfirmApprove.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        username: CHAIRMAN,
        approval_hash: approvalHash,
        approved_document: approvedDoc,
      } as SovietContract.Actions.Approves.ConfirmApprove.IConfirmApprove,
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

interface IBoardMember {
  username: string
  is_voting: number | boolean
}
interface IBoardRow {
  id: number
  members?: IBoardMember[]
}

async function getVotingBoardMembers(blockchain: Blockchain): Promise<string[]> {
  const boards = await blockchain.getTableRows(
    SovietContract.contractName.production,
    COOPNAME,
    'boards',
    10,
  ) as IBoardRow[]
  const board = boards[0]
  if (!board?.members?.length) return [CHAIRMAN]
  return board.members
    .filter((m) => Boolean(m.is_voting))
    .map((m) => m.username)
}

async function processLastDecision(blockchain: Blockchain) {
  const decisions = await blockchain.getTableRows(
    SovietContract.contractName.production,
    COOPNAME,
    SovietContract.Tables.Decisions.tableName,
    100,
  ) as Array<{ id: number }>
  const last = decisions[decisions.length - 1]
  if (!last) throw new Error('soviet::decisions пуст — нечего голосовать')

  // boot:extra собирает совет из 5 членов (ant chairman + petr/anna/mikhail/olga).
  // soviet::authorize требует консенсус — голосовать должны все voting-члены.
  // boot (1 chairman) тоже работает — там список = [ant], одного голоса хватает.
  const voters = await getVotingBoardMembers(blockchain)
  log(`soviet decision id=${last.id} — голосуют ${voters.length} члена совета (${voters.join(', ')})`)

  const voteActions = voters.map((voter) => ({
    account: SovietContract.contractName.production,
    name: SovietContract.Actions.Decisions.VoteFor.actionName,
    authorization: [{ actor: voter, permission: 'active' }],
    data: {
      ...fakeVote,
      coopname: COOPNAME,
      username: voter,
      decision_id: String(last.id),
    } as unknown as SovietContract.Actions.Decisions.VoteFor.IVoteForDecision,
  }))

  const authData: SovietContract.Actions.Decisions.Authorize.IAuthorize = {
    coopname: COOPNAME,
    chairman: CHAIRMAN,
    decision_id: last.id,
    document: fakeDocument,
  }
  const execData: SovietContract.Actions.Decisions.Exec.IExec = {
    executer: CHAIRMAN,
    coopname: COOPNAME,
    decision_id: last.id,
  }

  await blockchain.api.transact({
    actions: [
      ...voteActions,
      {
        account: SovietContract.contractName.production,
        name: SovietContract.Actions.Decisions.Authorize.actionName,
        authorization: [{ actor: CHAIRMAN, permission: 'active' }],
        data: authData,
      },
      {
        account: SovietContract.contractName.production,
        name: SovietContract.Actions.Decisions.Exec.actionName,
        authorization: [{ actor: CHAIRMAN, permission: 'active' }],
        data: execData,
      },
    ],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

async function signAct1(
  blockchain: Blockchain,
  username: string,
  resultHash: string,
  act: ReturnType<typeof setDocumentSignatures>,
) {
  log(`capital::signact1 ${username} → ${resultHash.slice(0, 12)}...`)
  await blockchain.api.transact({
    actions: [{
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.SignAct1.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        username,
        result_hash: resultHash,
        act,
      } as CapitalContract.Actions.SignAct1.ISignAct1,
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

async function signAct2(
  blockchain: Blockchain,
  resultHash: string,
  act: ReturnType<typeof setDocumentSignatures>,
) {
  log(`capital::signact2 ${CHAIRMAN} → ${resultHash.slice(0, 12)}...`)
  await blockchain.api.transact({
    actions: [{
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.SignAct2.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        chairman: CHAIRMAN,
        result_hash: resultHash,
        act,
      } as CapitalContract.Actions.SignAct2.ISignAct2,
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

async function contributeForUser(blockchain: Blockchain, username: string, amount: string) {
  const resultHash = randomSha256()
  const statement = setDocumentSignatures([username])
  await pushResult(blockchain, username, amount, resultHash, statement)
  await sovietApprove(blockchain, resultHash)
  await processLastDecision(blockchain)
  await signAct1(blockchain, username, resultHash, statement)
  const act2 = setDocumentSignatures([username, CHAIRMAN])
  await signAct2(blockchain, resultHash, act2)
}

export async function phase13(): Promise<void> {
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  const segments = await getSegments(blockchain)
  log(`сегменты: ${segments.map((s) => `${s.username}(${s.status},ic=${s.intellectual_cost})`).join(', ')}`)

  for (const s of segments) {
    if (s.status === 'contributed' || s.status === 'finalized') {
      log(`${s.username}: уже ${s.status} — пропуск`)
      continue
    }
    if (s.status !== 'ready') {
      throw new Error(`${s.username}: неожиданный статус ${s.status}; ожидался ready (нужна phase 12)`)
    }
    const amount = parseFloat(s.intellectual_cost.split(' ')[0])
    if (amount <= 0) {
      log(`${s.username}: intellectual_cost=${s.intellectual_cost} — паевой взнос РИД пропускаем`)
      continue
    }
    log(`--- ${s.username}: вносим РИД на ${s.intellectual_cost} ---`)
    await contributeForUser(blockchain, s.username, s.intellectual_cost)
  }

  const after = await getSegments(blockchain)
  for (const s of after) {
    log(`итог [${s.username}] status=${s.status}`)
  }
  log('фаза 13 завершена')
}
