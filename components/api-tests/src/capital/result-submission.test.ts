/**
 * Приём результата интеллектуальной деятельности снаружи (реестр
 * capital.result-submission): заявление → решение совета → акт участника →
 * акт председателя → конвертация доли, с отказами на каждом звене.
 *
 * Подготовка — через цепь, как в контрактных наборах boot: два свежих
 * участника, проект с компонентом, часы работ, голосование до статуса
 * «завершён». Документы результата собирает контроллер при обновлении доли
 * через API; заявление, решение и акты генерирует API и подписывает SDK.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, DEFAULT_WIF, caseName, docMeta, freshMember, gql, gqlError, signDocument, tokenOf, waitFor } from '../core'
import {
  CONVERT_SEGMENT,
  GEN_ACT,
  GEN_DECISION,
  GEN_STATEMENT,
  PUSH_RESULT,
  SIGN_ACT_CHAIRMAN,
  SIGN_ACT_CONTRIBUTOR,
  addAuthorOnChain,
  apiDoc,
  capitalMember,
  clearance,
  commitHours,
  createProject,
  approveStatement,
  authorizeDecision,
  generateResultDecision,
  voteForDecision,
  decisionFor,
  ensureCapitalProgram,
  foreignProtocol,
  gqlErrorPaced,
  gqlPaced,
  randomHash,
  refreshSegment,
  resultOf,
  rub,
  runVoting,
  segmentOf,
  setMasterInChain,
  setPlan,
  sha256,
  startProject,
} from './cap-results.helpers'

async function inputFields(typeName: string): Promise<string[]> {
  const d = await gql<any>(await tokenOf(CHAIRMAN), 'query($n:String!){ __type(name:$n){ inputFields{ name } } }', { n: typeName })
  return (d.__type?.inputFields ?? []).map((f: any) => f.name as string)
}

describe('Благорост: приём РИД — отказы без подготовки', () => {
  let member: Who
  let other: Who

  beforeAll(() => {
    member = freshMember({ prefix: 'rid' })
    other = freshMember({ prefix: 'rido' })
  })

  it(caseName('cap.rid.side.23', 'внести результат можно только за себя'), async () => {
    const err = await gqlError(await tokenOf(member), PUSH_RESULT, {
      d: { username: other.account, project_hash: randomHash(), statement: apiDoc([member]) },
    })
    expect(err?.code).toBe('CAPITAL_RESULT_SUBMIT_FOR_SELF_ONLY')
  })

  it(caseName('cap.rid.side.24', 'без сгенерированного документа результата внесение отклоняется'), async () => {
    const err = await gqlError(await tokenOf(member), PUSH_RESULT, {
      d: { username: member.account, project_hash: randomHash(), statement: apiDoc([member]) },
    })
    expect(err?.code).toBe('CAPITAL_RESULT_NOT_FOUND_FOR_PROJECT_USER')
  })

  it(caseName('cap.rid.side.32', 'акт участника по неизвестному результату отклоняется'), async () => {
    const err = await gqlError(await tokenOf(member), SIGN_ACT_CONTRIBUTOR, {
      d: { coopname: COOP, result_hash: randomHash(), act: apiDoc([member]) },
    })
    expect(err?.code).toBe('CAPITAL_RESULT_PROJECT_HASH_ABSENT')
  })

  it(caseName('cap.rid.side.36', 'акт председателя по неизвестному результату отклоняется'), async () => {
    const err = await gqlError(await tokenOf(CHAIRMAN), SIGN_ACT_CHAIRMAN, {
      d: { coopname: COOP, result_hash: randomHash(), act: apiDoc([CHAIRMAN]) },
    })
    expect(err?.code).toBe('CAPITAL_RESULT_USERNAME_PROJECT_HASH_ABSENT')
  })

  it(caseName('cap.rid.side.50', 'решение совета по неизвестному результату не генерируется'), async () => {
    const err = await gqlErrorPaced(await tokenOf(CHAIRMAN), GEN_DECISION, {
      d: { decision_id: 1, result_hash: randomHash(), username: CHAIRMAN.account },
    })
    expect(err?.code).toBe('CAPITAL_RESULT_NOT_FOUND')
  })

  it(caseName('cap.rid.side.34', 'председатель акта берётся из сессии: во входе поля нет, подставить его нельзя'), async () => {
    const fields = await inputFields('SignActAsChairmanInput')
    expect(fields).not.toContain('chairman')
    expect(fields).not.toContain('username')
    const err = await gqlError(await tokenOf(CHAIRMAN), SIGN_ACT_CHAIRMAN, {
      d: { coopname: COOP, result_hash: randomHash(), act: apiDoc([CHAIRMAN]), chairman: member.account },
    })
    expect(err, 'лишнее поле во входе отклоняется схемой').not.toBeNull()
    expect(err?.message).toContain('chairman')
  })
})

describe('Благорост: приём РИД — путь результата', () => {
  let alice: Who
  let bob: Who
  let project = ''
  let component = ''
  let emptyComponent = ''
  let aliceResult = ''
  let bobResult = ''
  let aliceStatementDoc: any
  let aliceSignedStatement: any
  let aliceSegmentBeforePush: any
  let decisionId = 0
  let aliceActDoc: any
  let limitWhileVoting: any
  const tag = Date.now().toString(36)

  beforeAll(async () => {
    await ensureCapitalProgram()
    alice = await capitalMember('rida')
    bob = await capitalMember('ridb')

    project = await createProject(`Проект РИД ${tag}`)
    component = await createProject(`Компонент РИД ${tag}`, project)
    emptyComponent = await createProject(`Компонент без работ ${tag}`, project)

    await clearance(alice, project)
    await clearance(alice, component)
    await clearance(alice, emptyComponent)
    await clearance(bob, component)

    // Компонент запускается только внутри действующего проекта.
    await setMasterInChain(project, alice)
    await startProject(project)
    await setMasterInChain(component, alice)
    await setPlan(component, alice)
    await startProject(component)
    await addAuthorOnChain(component, bob)
    await commitHours(component, alice, alice, 10)
    await commitHours(component, bob, alice, 20)
    await setMasterInChain(emptyComponent, alice)

    // Голосование распределяет голоса между остальными участниками — их двое.
    // Пока оно идёт, снимается предел возврата средств компонента.
    const council = await tokenOf(CHAIRMAN)
    await runVoting(component, [alice, bob], async () => {
      limitWhileVoting = await waitFor(async () => {
        const d = await gql<any>(council, `query($d:CapitalDeallocationLimitInput!){
          capitalDeallocationLimit(data:$d){ max_amount program_invest_pool unspent outstanding_debt is_allowed_by_status }
        }`, { d: { coopname: COOP, project_hash: component } })
        return d.capitalDeallocationLimit.is_allowed_by_status === false ? d.capitalDeallocationLimit : null
      }, { timeoutMs: 90_000, intervalMs: 1_000, label: 'статус голосования компонента в зеркале узла' })
    })

    // Обновление доли через API: цепь переводит долю в готовность, контроллер
    // собирает документ результата (без него внести результат нельзя).
    for (const [who, hash] of [[alice, component], [bob, component], [alice, project], [alice, emptyComponent]] as const)
      await refreshSegment(who, hash)

    const aliceToken = await tokenOf(alice)
    const segA = await segmentOf(aliceToken, component, alice.account)
    const segB = await segmentOf(await tokenOf(bob), component, bob.account)
    expect(segA?.status, 'предусловие: доля участницы готова к внесению результата').toBe('READY')
    expect(segB?.status, 'предусловие: доля участника готова к внесению результата').toBe('READY')
    aliceResult = (await resultOf(aliceToken, component, alice.account))?.result_hash
    bobResult = (await resultOf(await tokenOf(bob), component, bob.account))?.result_hash
    expect(aliceResult, 'предусловие: документ результата участницы собран').toMatch(/^[0-9a-f]{64}$/)
    expect(bobResult, 'предусловие: документ результата участника собран').toMatch(/^[0-9a-f]{64}$/)
  })

  it(caseName('l2.pnam.side.09', 'коммиты проекта показаны отдельным процессом с якорем на проекте, хотя цепь называет нитку приёмом РИД'), async () => {
    const council = await tokenOf(CHAIRMAN)
    const view = await waitFor(async () => {
      const d = await gql<any>(council, `query($h:String!,$c:String!){
        process(hash:$h, coopname:$c){ process_type process_hash actions{ account name data } delta_history{ code table } }
      }`, { h: component, c: COOP })
      const applies = (d.process?.actions as any[] ?? []).filter(a => a.account === 'ledger2' && a.name === 'apply')
      return applies.length >= 2 ? d.process : null
    }, { timeoutMs: 120_000, intervalMs: 1_000, label: 'коммиты компонента в реестре процессов' })

    const applies = (view.actions as any[]).filter(a => a.account === 'ledger2' && a.name === 'apply')
    // Цепь эмитит имя нитки приёма РИД — бэкенд показывает жизнь коммитов.
    expect(new Set(applies.map(a => a.data?.process_type))).toEqual(new Set(['p.cap.rid']))
    expect(view.process_type).toBe('p.cap.commit')
    // Сущность находится по якорю — строке проекта в Благоросте.
    expect((view.delta_history as any[]).some(d => d.code === 'capital' && d.table === 'projects')).toBe(true)
  })

  it(caseName('l2.pnam.side.10', 'фильтр «жизнь коммитов проекта» находит коммиты, фильтр «Приём РИД» их не втягивает'), async () => {
    const council = await tokenOf(CHAIRMAN)
    const listed = async (processType: string): Promise<any[]> => {
      const d = await gql<any>(council, `query($f:ProcessesFilter!,$p:PaginationInput!){
        processes(filter:$f, pagination:$p){ items{ processType processHash } }
      }`, { f: { coopname: COOP, processType, processHash: component }, p: { page: 1, limit: 10 } })
      return d.processes.items
    }
    const commits = await listed('p.cap.commit')
    expect(commits.map(i => i.processHash)).toEqual([component])
    expect(commits[0].processType).toBe('p.cap.commit')
    expect(await listed('p.cap.rid')).toEqual([])
  })

  it(caseName('cap.dealloc.side.09', 'предел возврата по компоненту в голосовании — ноль, признак разрешённости отрицательный'), () => {
    expect(limitWhileVoting.is_allowed_by_status).toBe(false)
    expect(limitWhileVoting.max_amount).toMatch(/^0\.0000 [A-Z]+$/)
    // Интерфейсу есть что показать: составляющие отданы суммами, а не пустотой.
    for (const field of ['program_invest_pool', 'unspent', 'outstanding_debt'])
      expect(limitWhileVoting[field], field).toMatch(/^\d+\.\d{4} [A-Z]+$/)
  })

  it(caseName('cap.rid.side.48', 'заявление по проекту без родителя не генерируется: название проекта берётся у родителя'), async () => {
    const err = await gqlErrorPaced(await tokenOf(alice), GEN_STATEMENT, { d: { project_hash: project, username: alice.account } })
    expect(err?.code).toBe('CAPITAL_PROJECT_TITLE_MISSING')
  })

  it(caseName('cap.rid.side.42', 'заявление по компоненту с нулевой суммой не генерируется: доля неисчислима'), async () => {
    const err = await gqlErrorPaced(await tokenOf(alice), GEN_STATEMENT, { d: { project_hash: emptyComponent, username: alice.account } })
    expect(err?.code).toBe('CAPITAL_PROJECT_AMOUNT_NOT_POSITIVE')
  })

  it(caseName('cap.rid.side.49', 'заявление собирается по пайщику из сессии: чужое имя во входе чужой сегмент не открывает'), async () => {
    const err = await gqlErrorPaced(await tokenOf(alice), GEN_STATEMENT, { d: { project_hash: component, username: bob.account } })
    expect(err?.code).toBe('CAPITAL_DOCUMENT_GENERATION_FOR_SELF_ONLY')
  })

  it(caseName('cap.rid.side.38', 'акт по чужому результату со своим именем во входе не генерируется'), async () => {
    const err = await gqlErrorPaced(await tokenOf(alice), GEN_ACT, { d: { result_hash: bobResult, username: alice.account } })
    expect(err?.code).toBe('CAPITAL_DOCUMENT_GENERATION_FOR_SELF_ONLY')
  })

  it(caseName('cap.rid.side.33', 'акт участника без его подписи отклоняется до цепи'), async () => {
    const err = await gqlError(await tokenOf(alice), SIGN_ACT_CONTRIBUTOR, {
      d: { coopname: COOP, result_hash: aliceResult, act: apiDoc([bob]) },
    })
    expect(err, 'акт, подписанный другим, отклонён').not.toBeNull()
    expect(err?.message).toContain(alice.account)
    expect((await segmentOf(await tokenOf(alice), component, alice.account))?.status).toBe('READY')
  })

  it(caseName('cap.rid.side.35', 'акт председателя без подписи участника отклоняется до цепи'), async () => {
    const err = await gqlError(await tokenOf(CHAIRMAN), SIGN_ACT_CHAIRMAN, {
      d: { coopname: COOP, result_hash: aliceResult, act: apiDoc([CHAIRMAN]) },
    })
    expect(err, 'акт без подписи участника отклонён').not.toBeNull()
    expect(err?.message).toContain(alice.account)
    expect((await segmentOf(await tokenOf(alice), component, alice.account))?.status).toBe('READY')
  })

  it(caseName('cap.rid.side.25', 'заявление, которого сервер не генерировал, отклоняется'), async () => {
    const err = await gqlError(await tokenOf(alice), PUSH_RESULT, {
      d: { username: alice.account, project_hash: component, statement: apiDoc([alice]) },
    })
    expect(err?.code).toBe('CAPITAL_GENERATED_DOCUMENT_NOT_FOUND')
  })

  it(caseName('cap.rid.side.26', 'заявление, разошедшееся со сгенерированным, отклоняется'), async () => {
    const aliceToken = await tokenOf(alice)
    const gen = await gqlPaced<any>(aliceToken, GEN_STATEMENT, { d: { project_hash: component, username: alice.account } })
    aliceStatementDoc = gen.capitalGenerateResultContributionStatement
    const signed = await signDocument(alice.wif, aliceStatementDoc, alice.account)
    const forged = { ...signed, meta_hash: randomHash() }
    const err = await gqlError(aliceToken, PUSH_RESULT, { d: { username: alice.account, project_hash: component, statement: forged } })
    expect(err?.code).toBe('CAPITAL_DOCUMENT_VERIFICATION_MISMATCH')
  })

  it(caseName('cap.rid.happy.02', 'результат вносится с суммами доли и хэшем документа результата из базы'), async () => {
    const aliceToken = await tokenOf(alice)
    aliceSegmentBeforePush = await segmentOf(aliceToken, component, alice.account)
    aliceSignedStatement = await signDocument(alice.wif, aliceStatementDoc, alice.account)
    const d = await gql<any>(aliceToken, PUSH_RESULT, { d: { username: alice.account, project_hash: component, statement: aliceSignedStatement } })
    expect(d.capitalPushResult.status).toBe('STATEMENT')

    const result = await resultOf(aliceToken, component, alice.account)
    expect(result.result_hash).toBe(aliceResult)
    expect(result.status).toBe('CREATED')
    expect(result.total_amount).toBe(aliceSegmentBeforePush.intellectual_cost)
    expect(result.debt_amount).toBe(aliceSegmentBeforePush.debt_amount)
  })

  it(caseName('cap.rid.side.51', 'акт не генерируется без результата, без заявления и без решения совета'), async () => {
    const missing = await gqlErrorPaced(await tokenOf(CHAIRMAN), GEN_ACT, { d: { result_hash: randomHash(), username: CHAIRMAN.account } })
    expect(missing?.code).toBe('CAPITAL_RESULT_NOT_FOUND')

    const noStatement = await gqlErrorPaced(await tokenOf(bob), GEN_ACT, { d: { result_hash: bobResult, username: bob.account } })
    expect(noStatement?.code).toBe('CAPITAL_RESULT_STATEMENT_MISSING')

    // До решения совета строка результата в цепи хранит пустой документ
    // решения, и отказ приходит на проверке его мета-данных, а не на проверке
    // «решения нет» (вопрос владельцу в отчёте). Важно одно: акт без решения
    // не собирается и до генератора дело не доходит.
    const noDecision = await gqlErrorPaced(await tokenOf(alice), GEN_ACT, { d: { result_hash: aliceResult, username: alice.account } })
    expect(['CAPITAL_COUNCIL_DECISION_MISSING', 'CAPITAL_STATEMENT_OR_DECISION_META_MISSING', 'CAPITAL_DECISION_ID_MISSING']).toContain(noDecision?.code)
  })

  it(caseName('cap.rid.side.40', 'хэш акта — sha256 от хэша результата и номера решения совета'), async () => {
    await approveStatement(aliceResult, aliceStatementDoc, aliceSignedStatement)
    const decision = await waitFor(async () => (await decisionFor(aliceResult)) ?? null,
      { timeoutMs: 60_000, intervalMs: 1_000, label: 'повестка совета по результату' })
    decisionId = Number(decision.id)

    await voteForDecision(decisionId)
    const chairToken = await tokenOf(CHAIRMAN)
    const generated = await generateResultDecision(chairToken, decisionId, aliceResult)
    const protocol = await signDocument(DEFAULT_WIF, generated, CHAIRMAN.account)
    await authorizeDecision(decisionId, protocol)
    // Решение исполнено в цепи мимо контроллера — ждём зеркала.
    await waitFor(async () => ((await resultOf(chairToken, component, alice.account))?.status === 'AUTHORIZED' ? true : null),
      { timeoutMs: 120_000, intervalMs: 1_000, label: 'результат авторизован советом' })

    const act = await gqlPaced<any>(await tokenOf(alice), GEN_ACT, { d: { result_hash: aliceResult, username: alice.account } })
    aliceActDoc = act.capitalGenerateResultContributionAct
    expect(docMeta(aliceActDoc.meta).result_act_hash).toBe(sha256(aliceResult + String(decisionId)))
  })

  it(caseName('cap.rid.side.31', 'акт подписывает тот, кто в сессии: подставить чужое имя нельзя, чужой результат цепь не примет'), async () => {
    const fields = await inputFields('SignActAsContributorInput')
    expect(fields).not.toContain('username')

    const bobToken = await tokenOf(bob)
    const withName = await gqlError(bobToken, SIGN_ACT_CONTRIBUTOR, {
      d: { coopname: COOP, result_hash: aliceResult, act: apiDoc([alice]), username: alice.account },
    })
    expect(withName, 'лишнее поле во входе отклоняется схемой').not.toBeNull()

    const bobSigned = await signDocument(bob.wif, aliceActDoc, bob.account)
    const foreign = await gqlError(bobToken, SIGN_ACT_CONTRIBUTOR, { d: { coopname: COOP, result_hash: aliceResult, act: bobSigned } })
    expect(foreign, 'акт по чужому результату отклонён').not.toBeNull()
    expect((await resultOf(await tokenOf(alice), component, alice.account))?.status).toBe('AUTHORIZED')
  })

  it('акт участника и акт председателя подписаны — доля внесена', async () => {
    const aliceToken = await tokenOf(alice)
    const act1 = await signDocument(alice.wif, aliceActDoc, alice.account)
    const s1 = await gql<any>(aliceToken, SIGN_ACT_CONTRIBUTOR, { d: { coopname: COOP, result_hash: aliceResult, act: act1 } })
    expect(s1.capitalSignActAsContributor.status).toBe('ACT1')

    const chairToken = await tokenOf(CHAIRMAN)
    const result = await resultOf(chairToken, component, alice.account)
    expect(result.act?.rawDocument, 'акт участника доступен председателю').toBeTruthy()
    const act2 = await signDocument(DEFAULT_WIF, result.act.rawDocument, CHAIRMAN.account, 2, [result.act.document])
    const s2 = await gql<any>(chairToken, SIGN_ACT_CHAIRMAN, { d: { coopname: COOP, result_hash: aliceResult, act: act2 } })
    expect(s2.capitalSignActAsChairman.status).toBe('CONTRIBUTED')
  })

  it(caseName('cap.rid.side.53', 'конвертация с хэшем проекта в верхнем регистре завершает долю без ошибки'), async () => {
    const aliceToken = await tokenOf(alice)
    const seg = await segmentOf(aliceToken, component, alice.account)
    const d = await gql<any>(aliceToken, CONVERT_SEGMENT, {
      d: {
        coopname: COOP,
        username: alice.account,
        project_hash: component.toUpperCase(),
        result_hash: aliceResult,
        wallet_amount: rub(0),
        capital_amount: seg.available_for_program,
        convert_statement: apiDoc([alice]),
      },
    })
    // Отметка нашла строку доли: ответ без ошибки и доля завершена.
    expect(d.capitalConvertSegment.status).toBe('FINALIZED')
    const after = await segmentOf(aliceToken, component, alice.account)
    expect(after?.status).toBe('FINALIZED')
  })

  it(caseName('cap.rid.side.92', 'конвертированная доля читается завершённой'), async () => {
    // До 25.09.2026 признак is_completed терялся при чтении из базы
    // (конструктор доли его не переносил), и доля всегда была «не завершена».
    const after = await segmentOf(await tokenOf(alice), component, alice.account)
    expect(after?.is_completed).toBe(true)
  })

  it(caseName('cap.rid.side.39', 'акт не генерируется, если решение совета разошлось с заявлением'), async () => {
    const bobToken = await tokenOf(bob)
    const gen = await gqlPaced<any>(bobToken, GEN_STATEMENT, { d: { project_hash: component, username: bob.account } })
    const bobStatementDoc = gen.capitalGenerateResultContributionStatement
    const statement = await signDocument(bob.wif, bobStatementDoc, bob.account)
    await gql(bobToken, PUSH_RESULT, { d: { username: bob.account, project_hash: component, statement } })

    await approveStatement(bobResult, bobStatementDoc, statement)
    const decision = await waitFor(async () => (await decisionFor(bobResult)) ?? null,
      { timeoutMs: 60_000, intervalMs: 1_000, label: 'повестка совета по результату участника' })
    // Совет утверждает протокол, собранный не генератором: полей решения о
    // приёме РИД в нём нет — ни названия компонента, ни суммы, ни доли.
    await voteForDecision(Number(decision.id))
    await authorizeDecision(Number(decision.id), await foreignProtocol(Number(decision.id)))
    await waitFor(async () => ((await resultOf(bobToken, component, bob.account))?.status === 'AUTHORIZED' ? true : null),
      { timeoutMs: 120_000, intervalMs: 1_000, label: 'результат участника авторизован' })

    const err = await gqlErrorPaced(bobToken, GEN_ACT, { d: { result_hash: bobResult, username: bob.account } })
    expect(err?.code).toBe('CAPITAL_COMPONENT_NAME_MISMATCH_STATEMENT_DECISION')
  })
})
