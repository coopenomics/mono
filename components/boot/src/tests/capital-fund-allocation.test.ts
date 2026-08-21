/**
 * Контрактный уровень: денежные места ЦПП «Благорост» — направление средств
 * программы в проект и возврат их обратно (реестр capital.fund-allocation,
 * level contract).
 *
 * Свободные средства программы живут в одном глобальном пуле
 * (`state.global_available_invest_pool`). Из него кооператив направляет деньги
 * в проекты (`allocate`) и забирает обратно — либо передумав (`diallocate`),
 * либо при удалении проекта (`delproject` → инлайн `returntopool`).
 *
 * Проверяется, что сумма не теряется и не задваивается ни на одном переходе:
 *
 *   • направление уменьшает глобальный пул ровно на сумму, а в проекте
 *     раскладывается по правилу «сперва закрыть разрыв до планового бюджета
 *     расходов, остаток — в инвестиционный пул»;
 *   • возврат — точное зеркало: уменьшает те же три пула проекта и
 *     пересчитывает те же коэффициенты (прежняя версия трогала только
 *     program_invest_pool, из-за чего сумма оставалась учтённой и в проекте,
 *     и в программе);
 *   • удаление проекта возвращает неизрасходованное ДО того, как строка
 *     проекта исчезнет, а при нулевом остатке не отправляет возврат вовсе —
 *     нулевая сумма была бы отклонена самим действием возврата и уронила бы
 *     удаление.
 *
 * Тест самодостаточен: заводит своего пайщика, свою программную инвестицию и
 * свои проекты. Состояние стенда не переиспользуется — только глобальный пул
 * программы, дельта по которому и ассертится.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CapitalContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { addUser } from '../init/participant'
import { generateRandomSHA256 } from '../utils/randomHash'
import { generateRandomUsername } from '../utils/randomUsername'
import { fakeDocument } from './shared/fakeDocument'
import { signCapitalAgreement } from './capital/signCapitalAgreement'
import { depositToWallet } from './wallet/depositToWallet'
import { registerContributor } from './capital/registerContributor'
import { signAppendix } from './capital/signAppendix'
import { refreshSegment } from './capital/refreshSegment'
import { getSegment } from './capital/getSegment'
import { ratePerHour } from './capital/consts'

const COOP = 'voskhod'
const ZERO_HASH = '0000000000000000000000000000000000000000000000000000000000000000'

/** Суммы подобраны так, чтобы каждая раскладка читалась глазами. */
const DEPOSIT = 1_000_000 // на паевой кошелёк пайщика
const PROGRAM_INVEST = 500_000 // программная инвестиция → свободные средства программы
const PLAN_EXPENSES = 10_000 // плановый бюджет расходов проекта
const ALLOC_MAIN = 30_000 // направление: 10 000 закроют разрыв, 20 000 уйдут в инвестиции
const ALLOC_EXTRA = 5_000 // повторное направление, когда разрыв уже нулевой
const DEALLOC = 4_000 // частичный возврат
const PRIVATE_INVEST = 20_000 // личная инвестиция пайщика в проект

const bc = new Blockchain(config.network, config.private_keys)

let member = ''
let mainProject = ''
let deletableFunded = ''
let deletableEmpty = ''
let privateInvestor = ''

function rub(n: number) {
  return `${n.toFixed(4)} RUB`
}

function amount(a: unknown) {
  return Number.parseFloat(String(a ?? '0').split(' ')[0])
}

async function send(name: string, data: Record<string, unknown>, actor = COOP) {
  return bc.api.transact({
    actions: [{
      account: CapitalContract.contractName.production,
      name,
      authorization: [{ actor, permission: 'active' }],
      data,
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

/** Свободные средства программы — единственное состояние стенда, которое тест делит с другими. */
async function freePool(): Promise<number> {
  const rows = await bc.getTableRows(CapitalContract.contractName.production, 'capital', 'state', 10) as any[]
  const st = rows.find(r => r.coopname === COOP)
  if (!st) throw new Error('контракт capital не инициализирован на стенде (нет строки state)')
  return amount(st.global_available_invest_pool)
}

async function getProjectRow(hash: string): Promise<any | undefined> {
  const rows = await bc.getTableRows(
    CapitalContract.contractName.production, COOP, 'projects', 1, hash, hash, 3, 'sha256',
  ) as any[]
  return rows[0]
}

async function createProject(title: string): Promise<string> {
  const hash = generateRandomSHA256()
  await send(CapitalContract.Actions.CreateProject.actionName, {
    coopname: COOP,
    project_hash: hash,
    parent_hash: ZERO_HASH,
    title: `${title} ${hash.slice(0, 8)}`,
    description: 'Проект контрактного теста денежных мест программы.',
    invite: '',
    data: '',
    meta: '',
  })
  return hash
}

describe('Благорост — денежные места программы: направление средств в проект и возврат (contract, живая цепь)', () => {
  beforeAll(async () => {
    await bc.update_pass_instance()

    // Пайщик, который и вносит программную инвестицию, и мастерит проект.
    member = generateRandomUsername()
    // addUser сам подписывает соглашение ЦПП «Цифровой Кошелёк» и заводит
    // кошелёк — повторная подпись дала бы ту же транзакцию и упала бы
    // «duplicate transaction». Отдельно подписываем только «Благорост».
    await addUser(member)
    await signCapitalAgreement(bc, COOP, member, fakeDocument)
    await registerContributor(bc, COOP, member, generateRandomSHA256(), ratePerHour)

    // Паевой кошелёк → программная инвестиция → свободные средства программы.
    await depositToWallet(bc, COOP, member, DEPOSIT)
    await send(CapitalContract.Actions.CreateProgramInvest.actionName, {
      coopname: COOP,
      username: member,
      invest_hash: generateRandomSHA256(),
      amount: rub(PROGRAM_INVEST),
      statement: { ...fakeDocument, signatures: [{ ...fakeDocument.signatures[0], signer: member }] },
    })

    mainProject = await createProject('Проект под направление средств')
    deletableFunded = await createProject('Проект под удаление с остатком')
    deletableEmpty = await createProject('Проект под удаление без средств')

    // План нужен, чтобы у проекта появился ненулевой разрыв до планового
    // бюджета расходов — иначе всё направленное сразу уходит в инвестиции и
    // ветку «сперва закрыть разрыв» проверить нечем. План ставит мастер, а
    // мастером можно стать только участником проекта — то есть подписав
    // приложение к договору УХД именно по этому проекту.
    await signAppendix(bc, COOP, member, mainProject, generateRandomSHA256())
    await send(CapitalContract.Actions.SetMaster.actionName, {
      coopname: COOP, project_hash: mainProject, master: member,
    })
    await send(CapitalContract.Actions.SetPlan.actionName, {
      coopname: COOP,
      master: member,
      project_hash: mainProject,
      plan_creators_hours: 100,
      plan_expenses: rub(PLAN_EXPENSES),
      plan_hour_cost: ratePerHour,
    })

    // Запускаем и открываем проект для инвестиций. Возврат средств доступен и
    // в «создан», и в «активен» — гоняем ветки на активном, заодно закрывая
    // cap.alloc.decision.01: прежняя версия действия требовала статус
    // «создан» и без него молча ничего не делала.
    await send(CapitalContract.Actions.StartProject.actionName, {
      coopname: COOP, project_hash: mainProject,
    })
    await send(CapitalContract.Actions.OpenProject.actionName, {
      coopname: COOP, project_hash: mainProject,
    })

    // Отдельный пайщик, который вложится в проект ЛИЧНЫМИ средствами: они
    // попадают в инвестиционный пул, но не в программный — на этой разнице и
    // проверяется граница возврата.
    privateInvestor = generateRandomUsername()
    await addUser(privateInvestor)
    await signCapitalAgreement(bc, COOP, privateInvestor, fakeDocument)
    await registerContributor(bc, COOP, privateInvestor, generateRandomSHA256(), ratePerHour)
    await signAppendix(bc, COOP, privateInvestor, mainProject, generateRandomSHA256())
    await depositToWallet(bc, COOP, privateInvestor, PRIVATE_INVEST * 2)
  }, 900_000)

  it('cap.alloc.happy.01: направление средств закрывает разрыв до планового бюджета расходов, остаток уходит в инвестиционный пул', async () => {
    const poolBefore = await freePool()
    const before = await getProjectRow(mainProject)
    expect(amount(before.plan.target_expense_pool), 'план обязан задать целевой бюджет расходов').toBeCloseTo(PLAN_EXPENSES, 2)

    await send(CapitalContract.Actions.Allocate.actionName, {
      coopname: COOP, project_hash: mainProject, amount: rub(ALLOC_MAIN),
    })

    const after = await getProjectRow(mainProject)
    const gap = PLAN_EXPENSES - amount(before.fact.accumulated_expense_pool)

    // Ставка направления в расходы — 100%, поэтому разрыв закрывается целиком,
    // а в инвестиции уходит только то, что осталось сверх него.
    expect(amount(after.fact.accumulated_expense_pool),
      'бюджет расходов обязан вырасти ровно на разрыв до планового, не превысив план').toBeCloseTo(gap, 2)
    expect(amount(after.fact.invest_pool),
      'в инвестиционный пул обязан уйти остаток сверх разрыва').toBeCloseTo(amount(before.fact.invest_pool) + (ALLOC_MAIN - gap), 2)
    expect(amount(after.fact.program_invest_pool),
      'программные средства проекта учитываются отдельной суммой').toBeCloseTo(amount(before.fact.program_invest_pool) + (ALLOC_MAIN - gap), 2)
    expect(amount(after.fact.total_received_investments),
      'полученные инвестиции растут на ВСЮ направленную сумму, включая ушедшее в расходы').toBeCloseTo(ALLOC_MAIN, 2)

    expect(await freePool(),
      'свободные средства программы обязаны уменьшиться ровно на направленную сумму').toBeCloseTo(poolBefore - ALLOC_MAIN, 2)

    // Коэффициенты пересчитываются от новых пулов, а не остаются нулевыми.
    expect(Number.parseFloat(after.fact.use_invest_percent),
      'коэффициент использования инвестиций обязан пересчитаться').toBeGreaterThan(0)
  }, 300_000)

  it('cap.alloc.side.08: когда бюджет расходов уже достиг планового, вся сумма уходит в инвестиционный пул', async () => {
    const before = await getProjectRow(mainProject)
    expect(amount(before.fact.accumulated_expense_pool),
      'предусловие: разрыв до планового бюджета уже закрыт').toBeCloseTo(PLAN_EXPENSES, 2)

    await send(CapitalContract.Actions.Allocate.actionName, {
      coopname: COOP, project_hash: mainProject, amount: rub(ALLOC_EXTRA),
    })

    const after = await getProjectRow(mainProject)
    expect(amount(after.fact.accumulated_expense_pool),
      'бюджет расходов не должен превышать плановый').toBeCloseTo(PLAN_EXPENSES, 2)
    expect(amount(after.fact.invest_pool),
      'вся повторно направленная сумма обязана уйти в инвестиционный пул').toBeCloseTo(amount(before.fact.invest_pool) + ALLOC_EXTRA, 2)
  }, 300_000)

  it('cap.alloc.side.05: направление больше свободного остатка программы отклоняется', async () => {
    const pool = await freePool()
    await expect(
      send(CapitalContract.Actions.Allocate.actionName, {
        coopname: COOP, project_hash: mainProject, amount: rub(pool + 1),
      }),
    ).rejects.toThrow(/Недостаточно средств в глобальном пуле инвестиций/i)

    expect(await freePool(), 'отклонённое направление не должно менять свободные средства').toBeCloseTo(pool, 2)
  }, 300_000)

  it('cap.alloc.side.06: направление в несуществующий проект отклоняется', async () => {
    await expect(
      send(CapitalContract.Actions.Allocate.actionName, {
        coopname: COOP, project_hash: generateRandomSHA256(), amount: rub(1_000),
      }),
    ).rejects.toThrow(/не найден/i)
  }, 300_000)

  it('cap.alloc.side.07: направление средств не кооперативом отклоняется по авторизации', async () => {
    await expect(
      send(CapitalContract.Actions.Allocate.actionName, {
        coopname: COOP, project_hash: mainProject, amount: rub(1_000),
      }, member),
    ).rejects.toThrow(/missing authority of voskhod/i)
  }, 300_000)

  it('cap.dealloc.happy.01: возврат части средств уменьшает все три пула проекта и пополняет свободные средства программы', async () => {
    const poolBefore = await freePool()
    const before = await getProjectRow(mainProject)
    const returnPercentBefore = Number.parseFloat(before.fact.return_base_percent)

    await send(CapitalContract.Actions.Deallocate.actionName, {
      coopname: COOP, project_hash: mainProject, amount: rub(DEALLOC),
    })

    const after = await getProjectRow(mainProject)
    expect(amount(after.fact.program_invest_pool)).toBeCloseTo(amount(before.fact.program_invest_pool) - DEALLOC, 2)
    expect(amount(after.fact.invest_pool),
      'инвестиционный пул обязан уменьшиться вместе с программным — иначе сумма осталась бы учтена дважды',
    ).toBeCloseTo(amount(before.fact.invest_pool) - DEALLOC, 2)
    expect(amount(after.fact.total_received_investments)).toBeCloseTo(amount(before.fact.total_received_investments) - DEALLOC, 2)

    expect(await freePool(),
      'свободные средства программы обязаны вырасти ровно на возвращённое').toBeCloseTo(poolBefore + DEALLOC, 2)

    // Бюджет расходов возврат не трогает: зарезервированное под целевые
    // расходы возвращается отдельным путём при закрытии проекта.
    expect(amount(after.fact.accumulated_expense_pool),
      'возврат не должен трогать накопленный бюджет расходов').toBeCloseTo(amount(before.fact.accumulated_expense_pool), 2)

    // Коэффициенты пересчитываются от уменьшенных пулов — именно этого не
    // делала прежняя версия, из-за чего участники сохраняли право забрать
    // деньги, которых в проекте уже нет.
    //
    // Коэффициент ВОЗВРАТА считается от базовых пулов создателей, авторов и
    // координаторов: в проекте без коммитов все три нулевые, поэтому он равен
    // нулю и до, и после — проверяем, что он именно пересчитан к нулю, а не
    // оставлен протухшим ненулевым значением. Ветка «коэффициент падает» на
    // ненулевых базовых пулах требует проекта с коммитами и голосованием и
    // здесь не воспроизводится.
    expect(Number.parseFloat(after.fact.return_base_percent),
      'коэффициент возврата обязан быть пересчитан от уменьшенного инвестиционного пула',
    ).toBe(returnPercentBefore)
    expect(amount(before.fact.creators_base_pool) + amount(before.fact.authors_base_pool),
      'предусловие ветки: базовые пулы проекта нулевые, коммитов не было').toBeCloseTo(0, 2)

    // Коэффициент ИСПОЛЬЗОВАНИЯ инвестиций считается в том числе от суммы
    // полученных инвестиций — она уменьшилась, значит он обязан сдвинуться.
    expect(Number.parseFloat(after.fact.use_invest_percent),
      'коэффициент использования инвестиций обязан пересчитаться от уменьшенной суммы полученного',
    ).not.toBe(Number.parseFloat(before.fact.use_invest_percent))
  }, 300_000)

  it('cap.dealloc.side.02: возврат больше непотраченного отклоняется с указанием доступной суммы', async () => {
    const before = await getProjectRow(mainProject)
    const tooMuch = amount(before.fact.program_invest_pool) + 1

    await expect(
      send(CapitalContract.Actions.Deallocate.actionName, {
        coopname: COOP, project_hash: mainProject, amount: rub(tooMuch),
      }),
    ).rejects.toThrow(/Сумма возврата превышает доступную. Доступно к возврату/i)
  }, 300_000)

  it('cap.dealloc.side.05: возврат из проекта, в который средства не направлялись, отклоняется', async () => {
    await expect(
      send(CapitalContract.Actions.Deallocate.actionName, {
        coopname: COOP, project_hash: deletableEmpty, amount: rub(1_000),
      }),
    ).rejects.toThrow(/нет средств, доступных к возврату/i)
  }, 300_000)

  it('cap.dealloc.side.06: возврат средств не кооперативом отклоняется по авторизации', async () => {
    await expect(
      send(CapitalContract.Actions.Deallocate.actionName, {
        coopname: COOP, project_hash: mainProject, amount: rub(1_000),
      }, member),
    ).rejects.toThrow(/missing authority of voskhod/i)
  }, 300_000)

  it('cap.alloc.happy.04 + side.10: удаление проекта возвращает весь неизрасходованный остаток в программу', async () => {
    const allocation = 12_000
    await send(CapitalContract.Actions.Allocate.actionName, {
      coopname: COOP, project_hash: deletableFunded, amount: rub(allocation),
    })

    const funded = await getProjectRow(deletableFunded)
    expect(amount(funded.fact.total_received_investments)).toBeCloseTo(allocation, 2)

    const poolBefore = await freePool()
    await send(CapitalContract.Actions.DeleteProject.actionName, {
      coopname: COOP, project_hash: deletableFunded,
    })

    // Возврат уходит инлайн-действием и исполняется ПОСЛЕ удаления строки —
    // проект в нём необязателен, хэш служит только меткой (cap.alloc.side.10).
    expect(await getProjectRow(deletableFunded), 'запись проекта обязана исчезнуть').toBeUndefined()
    expect(await freePool(),
      'весь неизрасходованный остаток обязан вернуться в свободные средства программы').toBeCloseTo(poolBefore + allocation, 2)
  }, 300_000)

  it('cap.alloc.side.09: удаление проекта без средств не отправляет возврат вовсе', async () => {
    const poolBefore = await freePool()

    await send(CapitalContract.Actions.DeleteProject.actionName, {
      coopname: COOP, project_hash: deletableEmpty,
    })

    expect(await getProjectRow(deletableEmpty), 'запись проекта обязана исчезнуть').toBeUndefined()
    // Нулевая сумма была бы отклонена самим действием возврата и уронила бы
    // удаление — значит, возврат не должен отправляться вовсе.
    expect(await freePool(),
      'свободные средства программы не должны измениться').toBeCloseTo(poolBefore, 2)
  }, 300_000)

  it('cap.alloc.decision.01: возврат средств доступен и на АКТИВНОМ проекте, а не только на созданном', async () => {
    const row = await getProjectRow(mainProject)
    expect(row.status, 'предусловие ветки: проект запущен').toBe('active')

    const poolBefore = await freePool()
    const before = await getProjectRow(mainProject)

    // Прежняя версия действия требовала статус «создан» и срабатывала только
    // при коэффициенте использования выше сотни — а обе функции расчёта
    // ограничивают его сотней, поэтому условие не выполнялось никогда и
    // действие завершалось успешно, ничего не изменив.
    await send(CapitalContract.Actions.Deallocate.actionName, {
      coopname: COOP, project_hash: mainProject, amount: rub(1_000),
    })

    const after = await getProjectRow(mainProject)
    expect(amount(after.fact.program_invest_pool),
      'возврат обязан уменьшить программный пул и на активном проекте').toBeCloseTo(amount(before.fact.program_invest_pool) - 1_000, 2)
    expect(await freePool(),
      'и вернуть сумму в свободные средства программы').toBeCloseTo(poolBefore + 1_000, 2)
  }, 300_000)

  it('cap.dealloc.side.04: возврат больше программного пула отклоняется — личные инвестиции пайщиков не возвращаются', async () => {
    // Пайщик вкладывает в проект лично: сумма растит инвестиционный пул, но
    // НЕ программный. Вернуть кооператив может только программные средства.
    await send(CapitalContract.Actions.CreateProjectInvest.actionName, {
      coopname: COOP,
      project_hash: mainProject,
      username: privateInvestor,
      invest_hash: generateRandomSHA256(),
      amount: rub(PRIVATE_INVEST),
      statement: {
        ...fakeDocument,
        signatures: [{ ...fakeDocument.signatures[0], signer: privateInvestor }],
      },
    })

    const row = await getProjectRow(mainProject)
    const programPool = amount(row.fact.program_invest_pool)
    const investPool = amount(row.fact.invest_pool)
    expect(investPool,
      'предусловие: инвестиционный пул больше программного — часть пришла лично от пайщика',
    ).toBeGreaterThan(programPool)

    await expect(
      send(CapitalContract.Actions.Deallocate.actionName, {
        coopname: COOP, project_hash: mainProject, amount: rub(programPool + 1),
      }),
    ).rejects.toThrow(/превышает доступную/i)

    const after = await getProjectRow(mainProject)
    expect(amount(after.fact.program_invest_pool),
      'отклонённый возврат ничего не двигает').toBeCloseTo(programPool, 2)
  }, 600_000)

  it('cap.dealloc.side.07: после возврата участник обновляет свою долю — пересчёт проходит от уменьшенного пула', async () => {
    const before = await getProjectRow(mainProject)
    const programPool = amount(before.fact.program_invest_pool)
    expect(programPool, 'предусловие: есть что возвращать').toBeGreaterThan(0)

    // Сумма отличается от возврата в предыдущем случае намеренно: одинаковая
    // транзакция в том же окне TAPOS отвергается цепью как дубликат.
    await send(CapitalContract.Actions.Deallocate.actionName, {
      coopname: COOP, project_hash: mainProject, amount: rub(1_500),
    })

    // Возврат делает доли всех участников неактуальными: last_known_invest_pool
    // разошёлся с fact.invest_pool. Обновление обязано пройти, а не упасть на
    // инварианте «доступная сумма не меньше выданных ссуд» — предельная сумма
    // возврата подобрана контрактом именно так.
    await refreshSegment(bc, COOP, mainProject, privateInvestor)

    const segment = await getSegment(bc, COOP, mainProject, privateInvestor)
    expect(segment, 'доля участника обязана остаться на месте').toBeTruthy()
    expect(amount(segment.provisional_amount),
      'доступная участнику сумма обязана быть не меньше его долга').toBeGreaterThanOrEqual(amount(segment.debt_amount))
  }, 600_000)
})
