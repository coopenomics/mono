/**
 * Фабрика утверждений документов снаружи: реестр шаблонов кооператива,
 * вынесение редакций на совет, решение совета и его следствия — утверждение в
 * цепи, возврат документа при отклонении, уведомления председателю, бланки
 * утверждённой и текущей редакции, шаг подключения приложения.
 *
 * Совет голосует ключами членов совета (как рабочий стол), решение утверждает
 * председатель протоколом через API. Шаблоны в сети правит оператор платформы
 * (draft::upversion / editdraft) — это подготовка состояния; всё проверяемое
 * читается через API контроллера.
 *
 * Документы теста — формы базового набора (51, 200, 900, пакет core_forms) и
 * форма Стола заказов 1116: их утверждение не меняет, какую редакцию
 * соглашений подписывают пайщики, поэтому соседние наборы не задеты. Текст
 * шаблона 900 после правки возвращается в afterAll.
 */
import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, COUNCIL, ROLES, caseName, gql, gqlError, tokenOf, waitFor } from '../core'
import {
  PROPOSE,
  agendaAll,
  agendaByHash,
  authorizeFreeDecision,
  blank,
  declineDecision,
  draftRow,
  editDraftContext,
  ensureProposable,
  plain,
  propose,
  templateOf,
  templates,
  upversion,
  vote,
  waitTemplate,
} from './docs-reports.helpers'

const CORE_FORMS = [51, 200, 900]
const RETURN_BY_MONEY = 900
const MARKET_FORM = 1116
const SERVICE_DOC = 599
const TWINS = [995, 997, 999, 1101]
const WORKING_OFFERS = [996, 1000, 1001, 1102]
const HEX64 = /^[0-9a-f]{64}$/i


const ATTENTION = 'query($c:String!){ documentTemplatesAttention(coopname:$c) }'
const LIST = 'query($c:String!){ documentTemplates(coopname:$c){ registry_id state } }'
const BLANK = `query($c:String!,$r:Int!,$e:DocumentTemplateEdition!){
  documentTemplateBlank(coopname:$c, registry_id:$r, edition:$e){ registry_id html text_hash }
}`

/** Текст документа без разметки и стилей. */
function textOf(html: string): string {
  return plain(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Самый длинный кусок текста без цифр — он не зависит от даты и номеров. */
function stableSnippet(text: string, max = 60): string {
  const runs = text.split(/[0-9_]+/).map(s => s.trim()).filter(s => s.length >= 12)
  const longest = runs.sort((a, b) => b.length - a.length)[0] ?? ''
  return longest.slice(0, max).trim()
}

function isGuestRefusal(code: unknown): boolean {
  return ['401', 'UNAUTHENTICATED', 'KIT_USER_NOT_AUTHORIZED'].includes(String(code))
}

describe('документы: фабрика утверждений редакций', () => {
  let chair: string
  let council: string
  /** Хэш повестки пакета core_forms и номер решения. */
  let bundleHash = ''
  let bundleDecisionId = 0
  let bundleVersions = new Map<number, number>()
  /** Исходный текст шаблона 900 — вернуть после правок. */
  let originalContext: string | null = null
  const marker = crypto.randomBytes(4).toString('hex')

  beforeAll(async () => {
    chair = await tokenOf(CHAIRMAN)
    council = await tokenOf(COUNCIL)
  })

  afterAll(async () => {
    if (originalContext !== null)
      await editDraftContext(RETURN_BY_MONEY, originalContext).catch(() => {})
  })

  it(caseName('doc.appr.happy.04', 'реестр шаблонов: базовый набор ядра первым, за ним документы установленных приложений'), async () => {
    const list = await templates(council)
    expect(list.length).toBeGreaterThan(0)
    expect(list[0].extension_name).toBe('core')
    const firstApp = list.findIndex(t => t.extension_name !== 'core')
    expect(firstApp, 'в реестре есть документы приложений').toBeGreaterThan(0)
    expect(list.slice(firstApp).some(t => t.extension_name === 'core'), 'документы ядра не идут после документов приложений').toBe(false)
    const byId = new Map(list.map(t => [t.registry_id, t]))
    for (const id of [1, 2, 3, 4, 100, 101, ...CORE_FORMS, SERVICE_DOC])
      expect(byId.get(id)?.extension_name, `документ ядра ${id}`).toBe('core')

    const ext = await gql<any>(chair, 'query{ getExtensions{ name enabled is_installed } }')
    const installed = new Set((ext.getExtensions as any[]).filter(e => e.is_installed && e.enabled).map(e => e.name as string))
    expect(installed.has('market'), 'Стол заказов установлен на стенде').toBe(true)
    for (const id of [1100, 1102, MARKET_FORM])
      expect(byId.get(id)?.extension_name, `документ Стола заказов ${id}`).toBe('market')
    if (installed.has('capital')) {
      for (const id of [994, 996, 998, 1000, 1001])
        expect(byId.get(id)?.extension_name, `документ Капитала ${id}`).toBe('capital')
    }
    expect(new Set(list.map(t => t.registry_id)).size, 'каждый шаблон в реестре один раз').toBe(list.length)
  })

  it(caseName('doc.appr.happy.05', 'совет видит по каждому документу редакции, утверждение с номером и датой решения и состояние'), async () => {
    const list = await templates(council)
    for (const t of list) {
      if (t.approval === 'None') {
        expect(t.state, `служебный ${t.registry_id}`).toBe('NotRequired')
        continue
      }
      expect(t.effective_version, `действующая редакция ${t.registry_id}`).toBe(t.approved_version ?? t.current_version)
      if (t.state === 'Pending') {
        expect(t.pending_hash, `хэш повестки ${t.registry_id}`).toMatch(HEX64)
      }
      else {
        const expected = t.approved_version === null
          ? 'NotApproved'
          : (t.current_version !== null && t.approved_version < t.current_version ? 'Outdated' : 'Approved')
        expect(t.state, `состояние ${t.registry_id}`).toBe(expected)
        expect(t.pending_hash).toBeNull()
      }
      if (t.approved_version !== null) {
        expect(t.approved_decision_id, `номер решения ${t.registry_id}`).not.toBeNull()
        expect(t.approved_at, `дата решения ${t.registry_id}`).toBeTruthy()
      }
      else {
        expect(t.approved_decision_id).toBeNull()
        expect(t.approved_at).toBeNull()
      }
    }
    const wallet = list.find(t => t.registry_id === 1)!
    expect(['Approved', 'Outdated', 'Pending'], 'соглашение о кошельке утверждено при установке кооператива').toContain(wallet.state)

    const attention = await gql<any>(council, ATTENTION, { c: COOP })
    const fresh = await templates(council)
    expect(attention.documentTemplatesAttention, 'счётчик вкладки — документы без утверждённой текущей редакции').toBe(
      fresh.filter(t => t.approval === 'Required' && (t.state === 'Outdated' || t.state === 'NotApproved')).length,
    )

    const member = await tokenOf(ROLES.member())
    expect((await gqlError(member, LIST, { c: COOP }))?.code, 'пайщику реестр шаблонов не отдаётся').toBe('KIT_INSUFFICIENT_RIGHTS')
    expect(isGuestRefusal((await gqlError(null, LIST, { c: COOP }))?.code), 'гостю — отказ по входу').toBe(true)
  })

  it(caseName('doc.appr.side.20', 'шаблоны-двойники «для утверждения» выведены: реестр и генератор их не знают, рабочие оферты собираются'), async () => {
    const list = await templates(chair)
    const ids = new Set(list.map(t => t.registry_id))
    for (const twin of TWINS) {
      expect(ids.has(twin), `двойника ${twin} нет в реестре`).toBe(false)
      expect((await gqlError(chair, BLANK, { c: COOP, r: twin, e: 'Current' }))?.code).toBe('DOCUMENT_APPROVAL_TEMPLATE_NOT_DECLARED')
    }
    const gen = await gqlError(chair, 'mutation($i:GenerateAnyDocumentInput!){ generateDocument(input:$i){ hash } }', {
      i: { data: { coopname: COOP, username: CHAIRMAN.account, registry_id: 995, lang: 'ru' }, options: { skip_save: true } },
    })
    // До 25.09.2026 отказ был общим «не удалось собрать», причина — только в журнале.
    expect(gen?.code, 'генератор не собирает двойник 995').toBe('GENERATOR_DOCUMENT_TYPE_UNKNOWN')
    const working = WORKING_OFFERS.filter(id => ids.has(id))
    expect(working, 'рабочая оферта Стола заказов 1102 в реестре').toContain(1102)
    for (const id of working) {
      const b = await blank(chair, id, 'Current')
      expect(b.registry_id).toBe(id)
      expect(textOf(b.html).length, `бланк рабочего документа ${id} собран`).toBeGreaterThan(100)
      expect(b.text_hash).toMatch(HEX64)
    }
  })

  it(caseName('doc.appr.side.10', 'документы разных приложений одним решением не выносятся'), async () => {
    await ensureProposable(chair, [CORE_FORMS[0], MARKET_FORM])
    const err = await gqlError(chair, PROPOSE, { d: { coopname: COOP, registry_ids: [CORE_FORMS[0], MARKET_FORM] } })
    expect(err?.code).toBe('DOCUMENT_APPROVAL_MIXED_EXTENSIONS')
    expect((await templateOf(chair, MARKET_FORM)).state, 'отказ ничего не вынес на совет').not.toBe('Pending')
  })

  it(caseName('doc.appr.happy.08', 'пакет форм выносится одним решением: одна повестка на все документы'), async () => {
    await ensureProposable(chair, CORE_FORMS)
    const res = await propose(CORE_FORMS)
    expect(res.map(t => t.registry_id).sort((a, b) => a - b)).toEqual([...CORE_FORMS].sort((a, b) => a - b))
    for (const t of res) {
      expect(t.state, `документ ${t.registry_id} в повестке`).toBe('Pending')
      expect(t.pending_hash).toMatch(HEX64)
    }
    expect(new Set(res.map(t => t.pending_hash)).size, 'одно решение на пакет').toBe(1)
    bundleHash = res[0].pending_hash!
    bundleVersions = new Map(res.map(t => [t.registry_id, t.current_version!]))
    const agenda = await waitFor(() => agendaByHash(chair, bundleHash), { timeoutMs: 60_000, label: 'проект решения пакета в повестке' })
    expect(agenda.type).toBe('freedecision')
    bundleDecisionId = agenda.id
    const withOurDocs = (await agendaAll(chair)).filter(a => a.hash.toLowerCase() === bundleHash.toLowerCase())
    expect(withOurDocs.length).toBe(1)
  })

  it(caseName('doc.appr.happy.07', 'в проекте решения — текст утверждаемой редакции каждого документа и хэш этого текста'), async () => {
    expect(bundleHash).toMatch(HEX64)
    const agenda = await waitFor(async () => {
      const a = await agendaByHash(chair, bundleHash)
      return a?.html ? a : null
    }, { timeoutMs: 60_000, label: 'текст проекта решения' })
    const text = textOf(agenda.html!)
    const hashes = [...text.matchAll(/хэш текста ([0-9a-f]{64})/gi)].map(m => m[1])
    expect(hashes.length, 'по хэшу текста на каждый документ пакета').toBe(CORE_FORMS.length)
    for (const id of CORE_FORMS) {
      const version = bundleVersions.get(id)!
      expect(text, `пункт решения о редакции документа ${id}`).toContain(`Утвердить редакцию № ${version} документа`)
    }
  })

  it(caseName('doc.appr.happy.19', 'форма без данных события уходит в решение бланком того же шаблона с прочерками, а не хэшем'), async () => {
    const agenda = await agendaByHash(chair, bundleHash)
    expect(agenda?.html).toBeTruthy()
    const decisionText = textOf(agenda!.html!)
    const b = await blank(chair, RETURN_BY_MONEY, 'Current')
    const blankText = textOf(b.html)
    expect(blankText, 'в бланке формы на месте данных пайщика прочерки').toMatch(/_{4,}/)
    const snippet = stableSnippet(blankText)
    expect(snippet.length, 'в бланке есть устойчивый текст формы').toBeGreaterThanOrEqual(12)
    expect(decisionText, 'текст формы вложен в проект решения').toContain(snippet)
  })

  it(caseName('doc.appr.side.09', 'повторное вынесение документа из повестки не создаёт нового решения'), async () => {
    const before = (await agendaAll(chair)).length
    const again = await propose([RETURN_BY_MONEY])
    expect(again).toHaveLength(1)
    expect(again[0].state).toBe('Pending')
    expect(again[0].pending_hash).toBe(bundleHash)
    const bundleAgain = await propose(CORE_FORMS)
    expect(new Set(bundleAgain.map(t => t.pending_hash))).toEqual(new Set([bundleHash]))
    const after = await agendaAll(chair)
    expect(after.length, 'в повестке не прибавилось вопросов').toBe(before)
    expect(after.filter(a => a.hash.toLowerCase() === bundleHash.toLowerCase())).toHaveLength(1)
  })

  it(caseName('doc.appr.side.11', 'совет отклонил решение: документ вернулся в прежнее состояние, чужое решение не тронуто'), async () => {
    const prev = await templateOf(chair, MARKET_FORM)
    expect(['NotApproved', 'Outdated']).toContain(prev.state)
    const [proposed] = await propose([MARKET_FORM])
    expect(proposed.state).toBe('Pending')
    const hash = proposed.pending_hash!
    expect(hash).not.toBe(bundleHash)
    const agenda = await waitFor(() => agendaByHash(chair, hash), { timeoutMs: 60_000, label: 'проект решения формы Стола заказов' })
    await vote(agenda, 'against')
    await declineDecision(agenda.id)
    // Снятие правила идёт по действию soviet::declinedec из ленты цепи.
    const back = await waitTemplate(chair, MARKET_FORM, t => t.state !== 'Pending', 'форма вернулась из повестки')
    expect(back.state).toBe(prev.state)
    expect(back.pending_hash).toBeNull()
    expect(back.approved_version).toBe(prev.approved_version)
    for (const id of CORE_FORMS) {
      const t = await templateOf(chair, id)
      expect(t.state, `пакет ${id} остался в повестке`).toBe('Pending')
      expect(t.pending_hash).toBe(bundleHash)
    }
  })

  it(caseName('doc.appr.happy.09', 'совет принял решение: каждой форме пакета записано утверждение с редакцией, номером и датой решения'), async () => {
    const agenda = await agendaByHash(chair, bundleHash)
    expect(agenda, 'решение пакета ещё в повестке').not.toBeNull()
    await vote(agenda!, 'for')
    await authorizeFreeDecision(agenda!)
    // Утверждение пишет в цепь реакция на исполненное решение (лента цепи).
    for (const id of CORE_FORMS) {
      const t = await waitTemplate(chair, id, x => x.state === 'Approved', `форма ${id} утверждена`)
      expect(t.approved_version).toBe(bundleVersions.get(id))
      expect(t.current_version).toBe(bundleVersions.get(id))
      expect(t.effective_version).toBe(t.approved_version)
      expect(t.approved_decision_id).toBe(bundleDecisionId)
      expect(t.approved_at).toBeTruthy()
      expect(t.pending_hash).toBeNull()
    }
  })

  it(caseName('doc.appr.side.10', 'отказы вынесения: уже утверждённая редакция, служебный документ, чужой кооператив, не председатель'), async () => {
    expect((await gqlError(chair, PROPOSE, { d: { coopname: COOP, registry_ids: [RETURN_BY_MONEY] } }))?.code).toBe('DOCUMENT_APPROVAL_ALREADY_APPROVED')
    expect((await gqlError(chair, PROPOSE, { d: { coopname: COOP, registry_ids: [SERVICE_DOC] } }))?.code).toBe('DOCUMENT_APPROVAL_NOT_REQUIRED')
    expect((await gqlError(chair, PROPOSE, { d: { coopname: 'alienco', registry_ids: [MARKET_FORM] } }))?.code).toBe('DOCUMENT_APPROVAL_COOPERATIVE_NOT_SERVED')
    expect((await gqlError(council, PROPOSE, { d: { coopname: COOP, registry_ids: [MARKET_FORM] } }))?.code, 'член совета без прав председателя').toBe('KIT_INSUFFICIENT_RIGHTS')
    expect((await templateOf(chair, MARKET_FORM)).state).not.toBe('Pending')
  })

  it(caseName('doc.appr.side.12', 'без утверждения и при утверждённой текущей редакции бланк утверждённой редакции собирается текущим текстом'), async () => {
    const approved = await templateOf(chair, RETURN_BY_MONEY)
    expect(approved.state).toBe('Approved')
    const a = textOf((await blank(chair, RETURN_BY_MONEY, 'Approved')).html)
    const c = textOf((await blank(chair, RETURN_BY_MONEY, 'Current')).html)
    expect(a).toContain(stableSnippet(c))

    const notApproved = (await templates(chair)).find(t => t.approval === 'Required' && t.state === 'NotApproved' && t.current_version !== null)
    expect(notApproved, 'на стенде есть документ без утверждения (форма Стола заказов после отклонения)').toBeTruthy()
    const na = textOf((await blank(chair, notApproved!.registry_id, 'Approved')).html)
    const nc = textOf((await blank(chair, notApproved!.registry_id, 'Current')).html)
    expect(na.length).toBeGreaterThan(50)
    expect(na).toContain(stableSnippet(nc))
  })

  it(caseName('doc.appr.happy.10', 'утверждена прежняя редакция: правки без смены номера доезжают, текст новой редакции — нет'), async () => {
    const row = await draftRow(RETURN_BY_MONEY)
    originalContext = row.context
    const m1 = `<p>API-TESTS-EDIT-${marker}-A</p>`
    const m2 = `<p>API-TESTS-EDIT-${marker}-B</p>`

    // Правка утверждённой редакции без смены номера.
    await editDraftContext(RETURN_BY_MONEY, originalContext + m1)
    await waitFor(async () => (await blank(chair, RETURN_BY_MONEY, 'Current')).html.includes(`${marker}-A`) ? true : null,
      { timeoutMs: 60_000, intervalMs: 1_500, label: 'правка шаблона доехала до генератора' })
    expect((await blank(chair, RETURN_BY_MONEY, 'Approved')).html, 'правка утверждённой редакции видна пайщикам').toContain(`${marker}-A`)

    // Новая редакция в сети со смысловой правкой — совет её не утверждал.
    await upversion(RETURN_BY_MONEY)
    await waitTemplate(chair, RETURN_BY_MONEY, t => t.state === 'Outdated', 'форма 900 устарела')
    await editDraftContext(RETURN_BY_MONEY, originalContext + m1 + m2)
    await waitFor(async () => (await blank(chair, RETURN_BY_MONEY, 'Current')).html.includes(`${marker}-B`) ? true : null,
      { timeoutMs: 60_000, intervalMs: 1_500, label: 'новая редакция доехала до генератора' })
    const approvedHtml = (await blank(chair, RETURN_BY_MONEY, 'Approved')).html
    expect(approvedHtml, 'утверждённая редакция с правкой без смены номера').toContain(`${marker}-A`)
    expect(approvedHtml, 'текст неутверждённой редакции пайщикам не предъявляется').not.toContain(`${marker}-B`)
  })

  it(caseName('doc.appr.side.07', 'переходы состояния: служебный — не требуется, новая редакция — устарело, вынесено — в повестке'), async () => {
    expect((await templateOf(chair, SERVICE_DOC)).state).toBe('NotRequired')
    const outdated = await templateOf(chair, RETURN_BY_MONEY)
    expect(outdated.state).toBe('Outdated')
    expect(outdated.current_version).toBe(bundleVersions.get(RETURN_BY_MONEY)! + 1)
    expect(outdated.approved_version).toBe(bundleVersions.get(RETURN_BY_MONEY))
    expect(outdated.effective_version, 'пайщикам действует утверждённая редакция').toBe(outdated.approved_version)
  })

  it(caseName('doc.appr.happy.06', 'шаблоны соглашений для рабочего стола отдают утверждённую кооперативом редакцию, а не редакцию сети'), async () => {
    const t = await templateOf(chair, RETURN_BY_MONEY)
    expect(t.current_version).toBeGreaterThan(t.approved_version!)
    const d = await gql<any>(await tokenOf(ROLES.member()), 'query($c:String!){ agreementTemplates(coopname:$c){ registry_id version } }', { c: COOP })
    const row = (d.agreementTemplates as any[]).find(r => r.registry_id === RETURN_BY_MONEY)
    expect(row, 'шаблон 900 в выдаче рабочего стола').toBeTruthy()
    expect(row.version).toBe(t.approved_version)
    const untouched = (d.agreementTemplates as any[]).find(r => r.registry_id === SERVICE_DOC)
    const service = await templateOf(chair, SERVICE_DOC)
    if (untouched)
      expect(untouched.version, 'без утверждения — текущая редакция сети').toBe(service.current_version)
  })

  it(caseName('doc.appr.side.13', 'на совет выносится текущая редакция сети, хотя пайщикам действует утверждённая старая'), async () => {
    const t = await templateOf(chair, RETURN_BY_MONEY)
    expect(t.state).toBe('Outdated')
    const [proposed] = await propose([RETURN_BY_MONEY])
    expect(proposed.state).toBe('Pending')
    const agenda = await waitFor(async () => {
      const a = await agendaByHash(chair, proposed.pending_hash!)
      return a?.html ? a : null
    }, { timeoutMs: 60_000, label: 'проект решения о новой редакции формы 900' })
    const text = plain(agenda.html!)
    expect(text, 'совет видит текст текущей редакции').toContain(`${marker}-B`)
    expect(textOf(agenda.html!)).toContain(`Утвердить редакцию № ${t.current_version} документа`)
    await vote(agenda, 'for')
    await authorizeFreeDecision(agenda)
    const approved = await waitTemplate(chair, RETURN_BY_MONEY, x => x.state === 'Approved', 'новая редакция формы 900 утверждена')
    expect(approved.approved_version).toBe(t.current_version)
    expect(approved.approved_decision_id).toBe(agenda.id)
    expect((await blank(chair, RETURN_BY_MONEY, 'Approved')).html, 'после утверждения пайщикам действует новый текст').toContain(`${marker}-B`)
  })

  it(caseName('doc.appr.happy.17', 'документы шага утверждены минуя карточку: карточка подключения показывает шаг пройденным без нового решения'), async () => {
    const STEP = 'marketplace_provision'
    const provision = await templateOf(chair, 1100)
    if (!['Approved', 'Outdated'].includes(provision.state)) {
      await ensureProposable(chair, [1100])
      const [p] = await propose([1100])
      const agenda = await waitFor(() => agendaByHash(chair, p.pending_hash!), { timeoutMs: 60_000, label: 'проект решения о положении Стола заказов' })
      await vote(agenda, 'for')
      await authorizeFreeDecision(agenda)
      await waitTemplate(chair, 1100, x => x.state === 'Approved', 'положение Стола заказов утверждено с вкладки шаблонов')
    }
    const before = (await agendaAll(chair)).length
    const state = await gql<any>(chair, 'query($e:String!){ getExtensionOnboardingState(extension_name:$e){ steps{ step_key done hash } } }', { e: 'market' })
    const step = (state.getExtensionOnboardingState.steps as any[]).find(s => s.step_key === STEP)
    expect(step, 'шаг положения в карточке подключения Стола заказов').toBeTruthy()
    expect(step.done).toBe(true)
    const completed = await gql<any>(chair, 'mutation($d:CompleteExtensionOnboardingStepInput!){ completeExtensionOnboardingStep(data:$d){ steps{ step_key done } } }', {
      d: { extension_name: 'market', step_key: STEP },
    })
    expect((completed.completeExtensionOnboardingStep.steps as any[]).find(s => s.step_key === STEP)?.done).toBe(true)
    expect((await agendaAll(chair)).length, 'повторное прохождение шага не вынесло нового решения').toBe(before)
    expect((await templateOf(chair, 1100)).state).not.toBe('Pending')
  })
})
