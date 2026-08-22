/**
 * Контрактный уровень: подача результата и акты приёма РИД
 * (реестр capital.result-submission, level contract).
 *
 * Путь результата: участник вносит результат (`pushrslt`) → совет авторизует →
 * участник подписывает акт-1 (`signact1`) → председатель подписывает акт-2
 * (`signact2`, здесь и приходуется РИД) → участник конвертирует свою долю
 * (`convertsegm`, здесь доля превращается в паевой и/или средства программы, а
 * сама доля и результат стираются).
 *
 * Тест самодостаточен: заводит свой проект, двух участников (голосование
 * требует, чтобы было кому распределять голоса), проводит проект через
 * голосование до статуса «завершён» и дальше ведёт результат по всей цепочке.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CapitalContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { generateRandomSHA256 } from '../utils/randomHash'
import { signAppendix } from './capital/signAppendix'
import { getSegment } from './capital/getSegment'
import { commitToResult } from './capital/commitToResult'
import { refreshSegment } from './capital/refreshSegment'
import { processStartVoting } from './capital/processStartVoting'
import { createVoteDistribution, submitVote } from './capital/submitVote'
import { processCompleteVoting } from './capital/processCompleteVoting'
import { processCalculateVotes } from './capital/processCalculateVotes'
import { processApprove } from './capital/processApprove'
import { processLastDecision } from './soviet/processLastDecision'
import { fakeDocument } from './shared/fakeDocument'
import { waitForProcessNaming } from './shared/processNaming'
import { ratePerHour } from './capital/consts'
import { COOP, bootstrapMember, programFreePool, rub } from './capital/programInvest'

const bc = new Blockchain(config.network, config.private_keys)
const ZERO_HASH = '0'.repeat(64)

const PLAN_HOURS = 100
const PLAN_EXPENSES = 10_000
const COMMIT_HOURS_A = 10
const COMMIT_HOURS_B = 20

let project = ''
let alice = ''
let bob = ''

/** Документ, подписанный указанными участниками (fakeDocument мутабелен — копируем). */
function signedByAll(...signers: string[]) {
  return {
    ...fakeDocument,
    signatures: signers.map((signer, i) => ({ ...fakeDocument.signatures[0], id: i + 1, signer })),
  }
}

async function getResultRow(resultHash: string): Promise<any | undefined> {
  const rows = await bc.getTableRows(
    CapitalContract.contractName.production, COOP, 'results', 1000,
  ) as any[]
  return rows.find(r => r.result_hash === resultHash)
}

async function userWallet(username: string, walletName: string) {
  const rows = await bc.getTableRows('ledger2', COOP, 'userwallets', 1000) as any[]
  const row = rows.find(r => r.username === username && r.wallet_name === walletName)
  return Number.parseFloat(String(row?.available ?? '0').split(' ')[0])
}

const num = (a: unknown) => Number.parseFloat(String(a ?? '0').split(' ')[0])

const resultHashes: Record<string, string> = {}

async function send(name: string, data: Record<string, unknown>) {
  return bc.api.transact({
    actions: [{
      account: CapitalContract.contractName.production,
      name,
      authorization: [{ actor: COOP, permission: 'active' }],
      data,
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

async function getProjectRow(hash: string): Promise<any> {
  const rows = await bc.getTableRows(
    CapitalContract.contractName.production, COOP, 'projects', 1, hash, hash, 3, 'sha256',
  ) as any[]
  return rows[0]
}

/** Участник, допущенный к работам по проекту. */
async function admitted(): Promise<string> {
  const username = await bootstrapMember(bc, { deposit: 0 })
  await signAppendix(bc, COOP, username, project, generateRandomSHA256())
  return username
}

describe('Благорост — подача результата и акты приёма РИД (contract, живая цепь)', () => {
  beforeAll(async () => {
    await bc.update_pass_instance()

    project = generateRandomSHA256()
    await send(CapitalContract.Actions.CreateProject.actionName, {
      coopname: COOP,
      project_hash: project,
      parent_hash: ZERO_HASH,
      title: `Проект результата ${project.slice(0, 8)}`,
      description: 'Проект контрактного теста подачи результата.',
      invite: '',
      data: '',
      meta: '',
    })

    alice = await admitted()
    bob = await admitted()

    await send(CapitalContract.Actions.SetMaster.actionName, {
      coopname: COOP, project_hash: project, master: alice,
    })
    await send(CapitalContract.Actions.SetPlan.actionName, {
      coopname: COOP,
      master: alice,
      project_hash: project,
      plan_creators_hours: PLAN_HOURS,
      plan_expenses: rub(PLAN_EXPENSES),
      plan_hour_cost: ratePerHour,
    })
    await send(CapitalContract.Actions.StartProject.actionName, {
      coopname: COOP, project_hash: project,
    })

    // Второго участника делаем соавтором — голосование распределяет голоса
    // между ОСТАЛЬНЫМИ участниками, поэтому их должно быть минимум двое.
    await send(CapitalContract.Actions.AddAuthor.actionName, {
      coopname: COOP, project_hash: project, author: bob,
    })

    // Часы работ: без вкладов у сегмента нулевая стоимость, а pushrslt требует
    // её положительной.
    await commitToResult(bc, COOP, project, alice, COMMIT_HOURS_A)
    await commitToResult(bc, COOP, project, bob, COMMIT_HOURS_B)
    // Обновление долей здесь НЕ делаем: у rfrshsegment нет nonce, и тот же
    // вызов после подсчёта голосов оказывался побайтно той же транзакцией —
    // цепь отбивала её как дубликат. Достаточно одного обновления, после
    // подсчёта: только оно и переводит долю из генерации в готовность.

    const started = await getProjectRow(project)
    expect(started.status, 'предусловие: проект запущен').toBe('active')
  }, 1_800_000)

  it('подготовка: проект доводится до «завершён», доли участников готовы к внесению результата', async () => {
    await processStartVoting(bc, { coopname: COOP, project_hash: project } as any)

    const voters = [alice, bob]
    for (const voter of voters) {
      // Голосующая сумма — общая по проекту, распределяется между ОСТАЛЬНЫМИ
      // участниками (себе голосовать нельзя), поэтому их и передаём.
      const row = await getProjectRow(project)
      const votingAmount = row.voting.amounts.active_voting_amount
      const recipients = voters.filter(v => v !== voter)
      const votes = createVoteDistribution(recipients, voter, votingAmount)
      await submitVote(bc, COOP, voter, project, votes)
    }

    await processCompleteVoting(bc, { coopname: COOP, project_hash: project } as any)

    for (const voter of voters) {
      await processCalculateVotes(bc, { coopname: COOP, username: voter, project_hash: project } as any)
      // Подсчёт голосов меняет доли, поэтому сегмент нужно обновить — иначе он
      // остаётся в состоянии генерации и результат внести нельзя.
      await refreshSegment(bc, COOP, project, voter)
    }

    const finished = await getProjectRow(project)
    expect(finished.status, 'после завершения голосования проект обязан быть «завершён»').toBe('result')

    for (const voter of voters) {
      const segment = await getSegment(bc, COOP, project, voter)
      expect(segment.status, `сегмент ${voter} обязан быть готов к внесению результата`).toBe('ready')
      expect(Number.parseFloat(segment.total_segment_cost),
        `у ${voter} обязана быть ненулевая стоимость вклада`).toBeGreaterThan(0)
    }
  }, 1_800_000)

  it('результаты внесены обоими участниками и ждут решения совета (pushrslt)', async () => {
    for (const who of [alice, bob]) {
      const segment = await getSegment(bc, COOP, project, who)
      const resultHash = generateRandomSHA256()
      resultHashes[who] = resultHash

      await send(CapitalContract.Actions.PushResult.actionName, {
        coopname: COOP,
        username: who,
        project_hash: project,
        result_hash: resultHash,
        contribution_amount: segment.total_segment_cost,
        debt_amount: segment.debt_amount,
        statement: signedByAll(who),
        debt_hashes: [],
      })

      const result = await getResultRow(resultHash)
      expect(result, `результат ${who} обязан появиться`).toBeDefined()
      expect(result.status, 'свежевнесённый результат ждёт решения совета').toBe('created')
    }
  }, 900_000)

  it('cap.rid.side.01: акт-1 до решения совета отклоняется', async () => {
    await expect(
      send(CapitalContract.Actions.SignAct1.actionName, {
        coopname: COOP, username: alice, result_hash: resultHashes[alice], act: signedByAll(alice),
      }),
    ).rejects.toThrow(/должен быть авторизован советом/i)
  }, 600_000)

  it('совет авторизует оба результата', async () => {
    for (const who of [alice, bob]) {
      await processApprove(bc, COOP, resultHashes[who])
      await processLastDecision(bc, COOP)
      const result = await getResultRow(resultHashes[who])
      expect(result.status, `результат ${who} обязан стать авторизованным`).toBe('authorized')
    }
  }, 900_000)

  it('cap.rid.side.02: акт-1 по чужому результату отклоняется', async () => {
    await expect(
      send(CapitalContract.Actions.SignAct1.actionName, {
        coopname: COOP, username: alice, result_hash: resultHashes[bob], act: signedByAll(alice),
      }),
    ).rejects.toThrow(/Только участник может подписать акт для своего результата/i)
  }, 600_000)

  it('cap.rid.side.04: акт-1 без подписи самого участника отклоняется', async () => {
    await expect(
      send(CapitalContract.Actions.SignAct1.actionName, {
        coopname: COOP, username: alice, result_hash: resultHashes[alice], act: signedByAll(bob),
      }),
    ).rejects.toThrow()
  }, 600_000)

  it('cap.rid.side.06: акт-2 до подписания акта-1 отклоняется', async () => {
    await expect(
      send(CapitalContract.Actions.SignAct2.actionName, {
        coopname: COOP, chairman: 'ant', result_hash: resultHashes[alice], act: signedByAll(alice, 'ant'),
      }),
    ).rejects.toThrow(/Первый акт должен быть подписан/i)
  }, 600_000)

  it('акт-1 подписан обоими участниками', async () => {
    for (const who of [alice, bob]) {
      await send(CapitalContract.Actions.SignAct1.actionName, {
        coopname: COOP, username: who, result_hash: resultHashes[who], act: signedByAll(who),
      })
      const result = await getResultRow(resultHashes[who])
      expect(result.status, `результат ${who} обязан перейти в акт-1`).toBe('act1')
      const segment = await getSegment(bc, COOP, project, who)
      expect(segment.status, `доля ${who} обязана перейти в акт-1`).toBe('act1')
    }
  }, 900_000)

  it('cap.rid.side.05: акт-2 не председателем совета отклоняется', async () => {
    await expect(
      send(CapitalContract.Actions.SignAct2.actionName, {
        coopname: COOP, chairman: bob, result_hash: resultHashes[alice], act: signedByAll(alice, bob),
      }),
    ).rejects.toThrow(/Только председатель может принять имущество/i)
  }, 600_000)

  it('cap.rid.side.08: акт-2 без подписи участника отклоняется', async () => {
    await expect(
      send(CapitalContract.Actions.SignAct2.actionName, {
        coopname: COOP, chairman: 'ant', result_hash: resultHashes[alice], act: signedByAll('ant'),
      }),
    ).rejects.toThrow()
  }, 600_000)

  it('cap.rid.side.12: конвертация доли до подписания акта-2 отклоняется', async () => {
    const segment = await getSegment(bc, COOP, project, alice)
    await expect(
      send(CapitalContract.Actions.ConvertSegment.actionName, {
        coopname: COOP,
        username: alice,
        project_hash: project,
        result_hash: resultHashes[alice],
        wallet_amount: rub(0),
        capital_amount: segment.available_for_program,
        convert_statement: signedByAll(alice),
      }),
    ).rejects.toThrow(/act2|Результат не внесён/i)
  }, 600_000)

  it('cap.rid.happy.01 (акт-2): председатель принимает РИД — имущество приходуется, доля переходит в «внесено»', async () => {
    for (const who of [alice, bob]) {
      const segmentBefore = await getSegment(bc, COOP, project, who)
      await send(CapitalContract.Actions.SignAct2.actionName, {
        coopname: COOP, chairman: 'ant', result_hash: resultHashes[who], act: signedByAll(who, 'ant'),
      })

      const result = await getResultRow(resultHashes[who])
      expect(result.status, `результат ${who} обязан перейти в акт-2`).toBe('act2')
      const segmentAfter = await getSegment(bc, COOP, project, who)
      expect(segmentAfter.status, `доля ${who} обязана стать внесённой`).toBe('contributed')
      expect(num(segmentAfter.available_for_program),
        `у ${who} обязана остаться доступная к конвертации сумма`).toBeCloseTo(num(segmentBefore.available_for_program), 2)
    }
  }, 900_000)

  it('cap.rid.side.10: при нулевом долге погашение ссуды не проводится', async () => {
    // У участников этого проекта ссуд не было, поэтому result.debt_amount = 0.
    // Приём РИД обязан пройти, а проводки погашения в нитке результата быть не
    // должно: она применяется только при ненулевом долге.
    const naming = await waitForProcessNaming(resultHashes[alice], COOP, ['o.cap.accept'])

    expect(naming.byOperation['o.cap.accept'],
      'приём РИД обязан быть проведён ниткой процесса РИД').toBe('p.cap.rid')
    expect(naming.byOperation['o.cap.repay'],
      'при нулевом долге погашения ссуды в нитке быть не должно').toBeUndefined()
  }, 600_000)

  it('cap.rid.side.14: конвертация по результату другого пайщика отклоняется', async () => {
    const segment = await getSegment(bc, COOP, project, alice)
    await expect(
      send(CapitalContract.Actions.ConvertSegment.actionName, {
        coopname: COOP,
        username: alice,
        project_hash: project,
        result_hash: resultHashes[bob],
        wallet_amount: rub(0),
        capital_amount: segment.available_for_program,
        convert_statement: signedByAll(alice),
      }),
    ).rejects.toThrow(/не принадлежит указанному пользователю/i)
  }, 600_000)

  it('cap.rid.side.19: в программу обязано конвертироваться всё доступное, что не ушло в кошелёк', async () => {
    const segment = await getSegment(bc, COOP, project, alice)
    const available = num(segment.available_for_program)
    await expect(
      send(CapitalContract.Actions.ConvertSegment.actionName, {
        coopname: COOP,
        username: alice,
        project_hash: project,
        result_hash: resultHashes[alice],
        wallet_amount: rub(0),
        // на копейку меньше доступного — остаток повис бы ничьим
        capital_amount: rub(available - 0.0001),
        convert_statement: signedByAll(alice),
      }),
    ).rejects.toThrow()
  }, 600_000)

  it('cap.rid.side.21: заявление о конвертации без подписи участника отклоняется', async () => {
    const segment = await getSegment(bc, COOP, project, alice)
    await expect(
      send(CapitalContract.Actions.ConvertSegment.actionName, {
        coopname: COOP,
        username: alice,
        project_hash: project,
        result_hash: resultHashes[alice],
        wallet_amount: rub(0),
        capital_amount: segment.available_for_program,
        convert_statement: signedByAll(bob),
      }),
    ).rejects.toThrow()
  }, 600_000)

  it('cap.rid.side.22: конвертация целиком в программу (нулевой кошелёк) проходит', async () => {
    const before = await userWallet(bob, 'w.cap.blago')
    const segment = await getSegment(bc, COOP, project, bob)
    const available = num(segment.available_for_program)
    expect(available, 'предусловие: есть что конвертировать').toBeGreaterThan(0)

    await send(CapitalContract.Actions.ConvertSegment.actionName, {
      coopname: COOP,
      username: bob,
      project_hash: project,
      result_hash: resultHashes[bob],
      wallet_amount: rub(0),
      capital_amount: segment.available_for_program,
      convert_statement: signedByAll(bob),
    })

    expect(await userWallet(bob, 'w.cap.blago'),
      'вся доступная сумма обязана лечь на кошелёк «Благороста»').toBeCloseTo(before + available, 2)

    expect(await getSegment(bc, COOP, project, bob).catch(() => undefined),
      'доля обязана стереться после конвертации').toBeFalsy()
    expect(await getResultRow(resultHashes[bob]),
      'результат обязан стереться после конвертации').toBeUndefined()
  }, 900_000)

  it('cap.rid.side.20: повторная конвертация по тому же результату отклоняется', async () => {
    await expect(
      send(CapitalContract.Actions.ConvertSegment.actionName, {
        coopname: COOP,
        username: bob,
        project_hash: project,
        result_hash: resultHashes[bob],
        wallet_amount: rub(0),
        capital_amount: rub(1),
        convert_statement: signedByAll(bob),
      }),
    ).rejects.toThrow(/не найден/i)
  }, 600_000)

  it('cap.rid.side.17: суммы конвертации обязаны сойтись со стоимостью доли — ни больше, ни меньше', async () => {
    const segment = await getSegment(bc, COOP, project, alice)
    const available = num(segment.available_for_program)

    // Сумма конвертации плюс долг обязаны точно равняться стоимости
    // интеллектуального вклада: списывается ровно заблокированное в программе.
    await expect(
      send(CapitalContract.Actions.ConvertSegment.actionName, {
        coopname: COOP,
        username: alice,
        project_hash: project,
        result_hash: resultHashes[alice],
        wallet_amount: rub(0),
        capital_amount: rub(available + 1),
        convert_statement: signedByAll(alice),
      }),
    ).rejects.toThrow()
  }, 600_000)

  it('cap.rid.side.18: в кошелёк нельзя вывести больше обеспеченной суммы за вычетом долга', async () => {
    const segment = await getSegment(bc, COOP, project, alice)
    const forWallet = num(segment.provisional_amount) - num(segment.debt_amount)
    const available = num(segment.available_for_program)

    // Просим в кошелёк на копейку больше обеспеченного, остальное — в
    // программу, чтобы суммарно сходилось и отказ пришёл именно по кошельку.
    const wallet = forWallet + 0.0001
    await expect(
      send(CapitalContract.Actions.ConvertSegment.actionName, {
        coopname: COOP,
        username: alice,
        project_hash: project,
        result_hash: resultHashes[alice],
        wallet_amount: rub(wallet),
        capital_amount: rub(available - wallet),
        convert_statement: signedByAll(alice),
      }),
    ).rejects.toThrow(/превышает доступную и обеспеченную/i)
  }, 600_000)

  it('cap.dealloc.side.01: возврат средств из ЗАВЕРШЁННОГО проекта отклоняется', async () => {
    // Случай реестра capital.fund-allocation: с началом голосования суммы уже
    // участвуют в расчёте результата, двигать их нельзя. Проверяется здесь, а
    // не в тесте фондов, потому что только тут проект доведён до «завершён».
    const row = await getProjectRow(project)
    expect(row.status, 'предусловие ветки: проект завершён').toBe('result')

    // Сумма заведомо больше планового бюджета расходов: иначе она уходит
    // целиком в него, инвестиционный пул не меняется, и следующий случай
    // (устаревшая доля) не воспроизводится.
    await send(CapitalContract.Actions.Allocate.actionName, {
      coopname: COOP, project_hash: project, amount: rub(20_000),
    })

    await expect(
      send(CapitalContract.Actions.Deallocate.actionName, {
        coopname: COOP, project_hash: project, amount: rub(1_000),
      }),
    ).rejects.toThrow(/только в статусе .pending. или .active./i)
  }, 600_000)

  it('cap.rid.side.16: конвертация доли, не обновлённой после изменения пулов, отклоняется', async () => {
    // Предыдущий случай направил в проект средства программы — доли всех
    // участников после этого неактуальны (last_known_invest_pool разошёлся с
    // fact.invest_pool). Конвертация обязана потребовать обновления, иначе
    // считалась бы по устаревшим долям.
    const segment = await getSegment(bc, COOP, project, alice)
    await expect(
      send(CapitalContract.Actions.ConvertSegment.actionName, {
        coopname: COOP,
        username: alice,
        project_hash: project,
        result_hash: resultHashes[alice],
        wallet_amount: rub(0),
        capital_amount: segment.available_for_program,
        convert_statement: signedByAll(alice),
      }),
    ).rejects.toThrow(/rfrshsegment|не обновлен/i)
  }, 600_000)

  it('cap.alloc.happy.03: финализация завершённого проекта возвращает неизрасходованный остаток в программу', async () => {
    // Финализация требует, чтобы все доли были сконвертированы и стёрты.
    // Долю оставшейся участницы обновляем (её сделала неактуальной аллокация
    // из предыдущего случая) и конвертируем целиком в программу.
    await refreshSegment(bc, COOP, project, alice)
    const segment = await getSegment(bc, COOP, project, alice)
    await send(CapitalContract.Actions.ConvertSegment.actionName, {
      coopname: COOP,
      username: alice,
      project_hash: project,
      result_hash: resultHashes[alice],
      wallet_amount: rub(0),
      capital_amount: segment.available_for_program,
      convert_statement: signedByAll(alice),
    })

    const before = await getProjectRow(project)
    const poolBefore = await programFreePool(bc)
    const unused = num(before.fact.total_received_investments)
      - num(before.fact.total_used_for_compensation)
      - num(before.fact.used_expense_pool)
    expect(unused, 'предусловие: часть полученных средств не израсходована').toBeGreaterThan(0)

    await send(CapitalContract.Actions.FinalizeProject.actionName, {
      coopname: COOP, project_hash: project,
    })

    expect(await programFreePool(bc),
      'неизрасходованный остаток обязан вернуться в свободные средства программы',
    ).toBeCloseTo(poolBefore + unused, 2)

    const after = await getProjectRow(project)
    expect(after.status, 'проект обязан перейти в финализированный').toBe('finalized')
  }, 900_000)
})
