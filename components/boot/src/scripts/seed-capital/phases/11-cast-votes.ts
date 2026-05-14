/**
 * Фаза 11 — голосование всех участников и закрытие голосования.
 *
 * Сценарий:
 *   1) Читаем проект MVP v1: статус должен быть 'voting'.
 *   2) Читаем сегменты компонента → список участников с has_vote=true.
 *   3) Читаем таблицу `votes` → кто уже проголосовал (для идемпотентности).
 *   4) Для каждого ещё-не-голосовавшего участника:
 *        capital::submitvote с равномерным распределением
 *        project.voting.amounts.active_voting_amount между остальными
 *        участниками (себя исключаем). Остаток от деления отдаём
 *        последнему, чтобы сумма голосов точно сошлась.
 *   5) Когда проголосует последний — контракт сам переводит компонент
 *      в статус 'result'. Если же deadline истёк раньше, всё равно
 *      проверяем: если статус остался 'voting' — финализируем
 *      capital::cmpltvoting (на случай ручного запуска фазы после deadline).
 *
 * Идемпотентно:
 *   - status === 'result' | 'finalized' → no-op;
 *   - status === 'voting' → пропускаем тех, чьи голоса уже в таблице votes;
 *   - status === 'active' → ошибка (нужно сначала phase 10).
 */
import { CapitalContract } from 'cooptypes'
import { createHash } from 'node:crypto'
import Blockchain from '../../../blockchain'
import config from '../../../configs'

const log = (...a: unknown[]) => console.error('[seed-capital:11]', ...a)

const COOPNAME = 'voskhod'
const COMPONENT_HASH = createHash('sha256').update('blago:project:49').digest('hex')

interface IVotingAmounts {
  active_voting_amount: string
  total_voting_pool: string
}

interface IProjectRow {
  status?: string
  voting?: {
    total_voters?: number
    votes_received?: number
    amounts?: IVotingAmounts
  }
}

interface ISegmentRow {
  username: string
  has_vote: boolean | number
}

interface IVoteRow {
  project_hash: string
  voter: string
  recipient: string
  amount: string
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

async function getVoters(blockchain: Blockchain): Promise<string[]> {
  const rows = await blockchain.getTableRows(
    CapitalContract.contractName.production,
    COOPNAME,
    'segments',
    100,
    COMPONENT_HASH,
    COMPONENT_HASH,
    2,
    'sha256',
  ) as ISegmentRow[]
  return rows.filter((r) => Boolean(r.has_vote)).map((r) => r.username)
}

async function getAlreadyVoted(blockchain: Blockchain): Promise<Set<string>> {
  const rows = await blockchain.getTableRows(
    CapitalContract.contractName.production,
    COOPNAME,
    'votes',
    1000,
    COMPONENT_HASH,
    COMPONENT_HASH,
    2,
    'sha256',
  ) as IVoteRow[]
  const voted = new Set<string>()
  for (const r of rows) {
    if (r.project_hash === COMPONENT_HASH) voted.add(r.voter)
  }
  return voted
}

/**
 * Точное распределение `votingAmount` между `recipients` с шагом 0.0001.
 * Целочисленная арифметика по 1/10000 единицы избегает плавающей-точечной
 * ошибки. Остаток отдаём последнему получателю — сумма распределённых
 * голосов в точности равна голосующей сумме.
 */
function distributeEvenly(votingAmount: string, recipients: string[]) {
  const [num, currency] = votingAmount.split(' ')
  const totalUnits = Math.round(parseFloat(num) * 10000)
  const n = recipients.length
  if (n === 0) return [] as Array<{ recipient: string, amount: string }>
  const base = Math.floor(totalUnits / n)
  const remainder = totalUnits - base * n
  return recipients.map((recipient, i) => {
    const units = i === n - 1 ? base + remainder : base
    const amount = `${(units / 10000).toFixed(4)} ${currency}`
    return { recipient, amount }
  })
}

async function castVote(
  blockchain: Blockchain,
  voter: string,
  votes: Array<{ recipient: string, amount: string }>,
) {
  log(`capital::submitvote от ${voter} → распределение по ${votes.length} участникам`)
  for (const v of votes) log(`    ${voter} → ${v.recipient}: ${v.amount}`)
  await blockchain.api.transact({
    actions: [{
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.SubmitVote.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        voter,
        project_hash: COMPONENT_HASH,
        votes,
      } as CapitalContract.Actions.SubmitVote.ISubmitVote,
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

async function completeVotingIfStuck(blockchain: Blockchain) {
  const project = await getProject(blockchain)
  if (project?.status !== 'voting') return
  log(`статус всё ещё 'voting' — вызываем capital::cmpltvoting`)
  await blockchain.api.transact({
    actions: [{
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.CompleteVoting.actionName,
      authorization: [{ actor: COOPNAME, permission: 'active' }],
      data: {
        coopname: COOPNAME,
        project_hash: COMPONENT_HASH,
      } as CapitalContract.Actions.CompleteVoting.ICompleteVoting,
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

export async function phase11(): Promise<void> {
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  const project = await getProject(blockchain)
  if (!project) throw new Error(`компонент MVP v1 (${COMPONENT_HASH.slice(0, 12)}...) не найден`)
  log(`статус компонента: ${project.status}, votes_received=${project.voting?.votes_received ?? '?'}/${project.voting?.total_voters ?? '?'}`)

  if (project.status === 'result' || project.status === 'finalized') {
    log(`компонент уже в статусе ${project.status} — фаза no-op`)
    return
  }
  if (project.status !== 'voting') {
    throw new Error(`компонент в статусе ${project.status}; ожидался voting (нужен phase 10 — startvoting)`)
  }

  const votingAmount = project.voting?.amounts?.active_voting_amount
  if (!votingAmount) throw new Error('voting.amounts.active_voting_amount не найден в проекте')
  log(`голосующая сумма (active_voting_amount): ${votingAmount}`)

  const voters = await getVoters(blockchain)
  if (voters.length < 2) throw new Error(`должно быть ≥2 участников с has_vote=true; найдено: ${voters.length}`)
  log(`участники с правом голоса: [${voters.join(', ')}]`)

  const alreadyVoted = await getAlreadyVoted(blockchain)
  if (alreadyVoted.size > 0) log(`уже проголосовали: [${[...alreadyVoted].join(', ')}]`)

  for (const voter of voters) {
    if (alreadyVoted.has(voter)) {
      log(`${voter}: уже голосовал — пропуск`)
      continue
    }
    const recipients = voters.filter((v) => v !== voter)
    const distribution = distributeEvenly(votingAmount, recipients)
    await castVote(blockchain, voter, distribution)
  }

  // Последний голос обычно сам закрывает голосование. На всякий случай
  // (например, фазу запускают после deadline без полного кворума) — финализируем.
  await completeVotingIfStuck(blockchain)

  const after = await getProject(blockchain)
  log(`фаза 11 завершена — итоговый статус: ${after?.status}`)
}
