/**
 * Помощники наборов «Образование» (расширение edubridge): подключение ЦПП
 * кооперативом, оферты пайщика, курс, подписка, договор преподавателя.
 *
 * На стенде полигона расширение не установлено. Набор ставит его сам, проводит
 * четыре решения совета подключения и утверждает формы документов — тем же
 * путём, каким это делает председатель со стола. Это подготовка стенда; сами
 * сценарии проверяются через API от лица свежих пайщиков.
 *
 * Расширение включено только на время наборов образования: после них оно
 * выключается, чтобы программы «Обучение» и «Преподавание» не попадали в
 * витрину вступления и в реестр шаблонов соседних наборов.
 */
import crypto from 'node:crypto'
import { Cooperative } from 'cooptypes'
import type { Who } from '../core'
import { CHAIRMAN, COOP, amount, deposit, gql, signDocument, tokenOf, waitFor } from '../core'
import type { TemplateRow } from '../documents/docs-reports.helpers'
import { agendaByHash, authorizeFreeDecision, blank, propose, templates, vote, waitTemplate } from '../documents/docs-reports.helpers'

export const EXTENSION = 'edubridge'

const R = Cooperative.Registry

/** Отказ гварда прав расширения. */
export const NO_RIGHTS = 'EDUBRIDGE_INSUFFICIENT_RIGHTS'

/** Кошелёк членских взносов программы — на него ложится возврат по подписке. */
export const PROGRAM_WALLET = 'w.edu.member'
export const SHARE_WALLET = 'w.wal.share'

// ── Подключение ЦПП кооперативом ───────────────────────────────────────────

const CATALOG = 'query($d:GetExtensionsInput){ getExtensions(data:$d){ name is_installed enabled config } }'
const INSTALL = 'mutation($d:ExtensionInput!){ installExtension(data:$d){ name is_installed } }'
const UPDATE = 'mutation($d:ExtensionInput!){ updateExtension(data:$d){ name enabled } }'
const L1_STATE = 'query($e:String!){ getExtensionOnboardingState(extension_name:$e){ all_done steps{ step_key done hash } } }'
const L1_COMPLETE = `mutation($d:CompleteExtensionOnboardingStepInput!){
  completeExtensionOnboardingStep(data:$d){ steps{ step_key done hash } }
}`

/** Документы шагов подключения: совет утверждает их редакции в бланке. */
const STEP_DOCS: Record<string, { registry_id: number, title: string, question: string }> = {
  education_provision: {
    registry_id: R.EducationProgramTemplate.registry_id,
    title: 'Положение о ЦПП «Образование»',
    question: 'Об утверждении Положения о целевой потребительской программе «Образование»',
  },
  education_parent_offer_template: {
    registry_id: R.EducationParentOffer.registry_id,
    title: 'Оферта ученика ЦПП «Образование»',
    question: 'Об утверждении оферты ученика целевой потребительской программы «Образование»',
  },
  education_teacher_offer_template: {
    registry_id: R.EducationTeacherOffer.registry_id,
    title: 'Оферта преподавателя ЦПП «Образование»',
    question: 'Об утверждении оферты преподавателя целевой потребительской программы «Образование»',
  },
  education_contract_template: {
    registry_id: R.EducationParticipationContract.registry_id,
    title: 'Договор участия в хозяйственной деятельности',
    question: 'Об утверждении договора участия в хозяйственной деятельности по программе «Образование»',
  },
}

async function extensionRow(chairman: string): Promise<any | undefined> {
  const d = await gql<any>(chairman, CATALOG, { d: {} })
  return (d.getExtensions as any[]).find(e => e.name === EXTENSION)
}

async function l1State(chairman: string): Promise<{ all_done: boolean, steps: { step_key: string, done: boolean, hash: string | null }[] }> {
  return (await gql<any>(chairman, L1_STATE, { e: EXTENSION })).getExtensionOnboardingState
}

/** Решение совета по хэшу проекта: голоса членов совета и утверждение председателем. */
async function passDecision(chairman: string, hash: string, label: string): Promise<void> {
  const agenda = await waitFor(() => agendaByHash(chairman, hash), { timeoutMs: 60_000, label })
  await vote(agenda, 'for')
  await authorizeFreeDecision(agenda)
}

/** Шаги подключения: совет утверждает положение, обе оферты и договор. */
async function passOnboarding(chairman: string): Promise<void> {
  const state = await waitFor(async () => {
    const s = await l1State(chairman)
    return s.steps.length >= Object.keys(STEP_DOCS).length ? s : null
  }, { timeoutMs: 120_000, intervalMs: 1_000, label: 'расширение «Образование» объявило шаги подключения' })

  for (const step of state.steps) {
    if (step.done)
      continue
    const doc = STEP_DOCS[step.step_key]
    if (!doc)
      throw new Error(`шаг подключения ${step.step_key} не описан в наборе — состав шагов изменился`)
    let hash = step.hash
    if (!hash) {
      const text = await blank(chairman, doc.registry_id, 'Current')
      const d = await gql<any>(chairman, L1_COMPLETE, {
        d: { extension_name: EXTENSION, step_key: step.step_key, title: doc.title, question: doc.question, decision: text.html },
      })
      hash = (d.completeExtensionOnboardingStep.steps as any[]).find(s => s.step_key === step.step_key)?.hash ?? null
    }
    if (!hash)
      throw new Error(`шаг подключения ${step.step_key} опубликован без решения совета`)
    await passDecision(chairman, hash, `проект решения совета по шагу ${step.step_key}`)
  }

  await waitFor(async () => ((await l1State(chairman)).all_done ? true : null),
    { timeoutMs: 120_000, intervalMs: 1_500, label: 'все шаги подключения «Образования» приняты советом' })
}

/** Формы документов программы: без утверждённой редакции документ пайщику не выпустить. */
async function approveForms(chairman: string): Promise<void> {
  const pending = (await templates(chairman)).filter(t => t.extension_name === EXTENSION && t.approval === 'Required' && t.state !== 'Approved')
  if (!pending.length)
    return
  // Пакет утверждается одним решением совета — выносим по пакетам.
  const bundles = new Map<string, number[]>()
  for (const t of pending.filter(x => x.state !== 'Pending'))
    bundles.set(t.bundle ?? String(t.registry_id), [...(bundles.get(t.bundle ?? String(t.registry_id)) ?? []), t.registry_id])
  const proposed: TemplateRow[] = []
  for (const ids of bundles.values())
    proposed.push(...await propose(ids))
  const hashes = new Set([...pending, ...proposed].map(t => t.pending_hash).filter((h): h is string => Boolean(h)))
  for (const hash of hashes)
    await passDecision(chairman, hash, 'проект решения совета о формах документов «Образования»')
  for (const t of pending)
    await waitTemplate(chairman, t.registry_id, x => x.state === 'Approved', `форма ${t.registry_id} «Образования» утверждена`)
}

const OFFERS_STATE = 'query{ edubridgeOnboardingState{ parent{ kind requires_gate source registry_id signed_at } teacher{ kind requires_gate source registry_id signed_at } } }'

/**
 * Расширение установлено, включено, ЦПП принята советом, формы утверждены.
 * Связка с Благоростом выключена: с ней столы Благороста остались бы только
 * преподавателям, а это чужие сценарии.
 */
export async function educationOn(): Promise<void> {
  const chairman = await tokenOf(CHAIRMAN)
  const ext = await extensionRow(chairman)
  if (!ext)
    throw new Error('расширения edubridge нет в каталоге приложений стенда')
  if (!ext.is_installed)
    await gql(chairman, INSTALL, { d: { name: EXTENSION, enabled: true, config: { capital_integration: false } } })
  else if (!ext.enabled)
    await gql(chairman, UPDATE, { d: { name: EXTENSION, enabled: true, config: ext.config ?? {} } })

  await passOnboarding(chairman)
  // После последнего решения расширение перезапускается и открывает программы.
  await waitFor(async () => {
    const s = (await gql<any>(chairman, OFFERS_STATE)).edubridgeOnboardingState
    return s.parent.source !== 'NOT_CONFIGURED' && s.teacher.source !== 'NOT_CONFIGURED' ? true : null
  }, { timeoutMs: 180_000, intervalMs: 2_000, label: 'программы «Обучение» и «Преподавание» открыты в кооперативе' })
  await approveForms(chairman)
}

/** Расширение выключено: его программы и шаблоны соседним наборам не видны. */
export async function educationOff(): Promise<void> {
  const chairman = await tokenOf(CHAIRMAN)
  const ext = await extensionRow(chairman)
  if (!ext?.is_installed || !ext.enabled)
    return
  await gql(chairman, UPDATE, { d: { name: EXTENSION, enabled: false, config: ext.config ?? {} } })
  await waitFor(async () => ((await templates(chairman)).some(t => t.extension_name === EXTENSION) ? null : true),
    { timeoutMs: 60_000, intervalMs: 1_000, label: 'шаблоны выключенного «Образования» сняты с реестра' })
}

// ── Права стола ────────────────────────────────────────────────────────────

/** Права пайщика на столах расширения — то, по чему рабочий стол показывает страницы. */
export async function deskGrants(token: string | null): Promise<string[]> {
  const d = await gql<any>(token, 'query{ getDesktop{ workspaces{ name extension_name grants } } }')
  const own = (d.getDesktop.workspaces as any[]).filter(w => w.extension_name === EXTENSION)
  return [...new Set(own.flatMap(w => (w.grants ?? []) as string[]))].sort()
}

// ── Оферты пайщика ─────────────────────────────────────────────────────────

export type OfferKind = 'PARENT' | 'TEACHER'

const OFFER_REGISTRY: Record<OfferKind, number> = {
  PARENT: R.EducationParentOffer.registry_id,
  TEACHER: R.EducationTeacherOffer.registry_id,
}

const GENERATE = 'mutation($i:GenerateAnyDocumentInput!){ generateDocument(input:$i){ full_title html hash meta binary } }'
export const SIGN_OFFER = `mutation($i:EduSignOfferInput!){ edubridgeSignOffer(input:$i){
  parent{ kind requires_gate source signed_at } teacher{ kind requires_gate source signed_at }
} }`

function number16(): string {
  return crypto.randomBytes(8).toString('hex').toUpperCase()
}

function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

export async function offersState(token: string): Promise<{ parent: any, teacher: any }> {
  return (await gql<any>(token, OFFERS_STATE)).edubridgeOnboardingState
}

/** Экземпляр оферты так, как его собирает стол пайщика, с подписью пайщика. */
export async function signedOffer(who: Who, token: string, kind: OfferKind): Promise<any> {
  const d = await gql<any>(token, GENERATE, {
    i: { data: { registry_id: OFFER_REGISTRY[kind], coopname: COOP, username: who.account, agreement_number: number16(), agreement_created_at: today() } },
  })
  return signDocument(who.wif, d.generateDocument, who.account, 1)
}

/** Пайщик подписывает оферту программы со стола. */
export async function signOffer(who: Who, token: string, kind: OfferKind): Promise<{ parent: any, teacher: any }> {
  const document = await signedOffer(who, token, kind)
  return (await gql<any>(token, SIGN_OFFER, { i: { kind, document } })).edubridgeSignOffer
}

// ── Деньги пайщика ─────────────────────────────────────────────────────────

const USER_WALLETS = 'query($u:String!){ getUserWallets(username:$u){ wallet_name available } }'

/** Доступный остаток кошелька пайщика глазами узла. */
export async function walletOf(token: string, username: string, wallet: string): Promise<number> {
  const d = await gql<any>(token, USER_WALLETS, { u: username })
  return amount((d.getUserWallets as any[]).find(w => w.wallet_name === wallet)?.available)
}

/** Паевой взнос деньгами и ожидание зеркала узла: пополнение идёт мимо контроллера. */
export async function fundShare(who: Who, token: string, sum: number): Promise<void> {
  const before = await walletOf(token, who.account, SHARE_WALLET)
  await deposit(who.account, sum)
  await waitFor(async () => ((await walletOf(token, who.account, SHARE_WALLET)) >= before + sum ? true : null),
    { timeoutMs: 120_000, intervalMs: 1_000, label: `зеркало паевого кошелька ${who.account} после пополнения` })
}

// ── Курс ───────────────────────────────────────────────────────────────────

export const COURSE_FIELDS = 'id title status fee_month starts_at guarantee_days lessons_per_month lessons_total teacher_usernames section_id'
export const SAVE_SECTION = 'mutation($d:EduSaveSectionInput!){ edubridgeSaveSection(data:$d){ id title } }'
export const CREATE_COURSE = `mutation($d:EduCourseInput!){ edubridgeCreateCourse(data:$d){ ${COURSE_FIELDS} } }`
export const UPDATE_COURSE = `mutation($d:EduUpdateCourseInput!){ edubridgeUpdateCourse(data:$d){ ${COURSE_FIELDS} } }`
export const SET_COURSE_STATUS = `mutation($d:EduSetCourseStatusInput!){ edubridgeSetCourseStatus(data:$d){ ${COURSE_FIELDS} } }`
export const COURSE = `query($id:ID!){ edubridgeCourse(id:$id){ ${COURSE_FIELDS} } }`
export const CATALOG_PAGE = 'query($f:EduCatalogFilterInput){ edubridgeCatalog(filter:$f){ totalCount items{ id title fee_month section_id } } }'
export const CATALOG_COURSE = 'query($id:ID!){ edubridgeCatalogCourse(id:$id){ id title fee_month } }'

/** Плановая ставка часа курсов набора. */
export const PLANNED_RATE = '1000.0000 RUB'

/** День от сегодняшнего со сдвигом, YYYY-MM-DD. */
export function dayFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** Параметры очного курса: доступ выдаётся пропуском, чужих площадок не нужно. */
export function courseInput(sectionId: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: `Курс внешнего слоя ${number16()}`,
    section_id: sectionId,
    description: 'Курс набора api-tests',
    lessons_per_month: 8,
    lessons_total: 32,
    lesson_minutes: 60,
    planned_hourly_rate: PLANNED_RATE,
    guarantee_days: 14,
    direction: 'ONSITE',
    carrier: 'ONSITE',
    ...over,
  }
}

export async function createSection(token: string): Promise<string> {
  const d = await gql<any>(token, SAVE_SECTION, { d: { title: `Раздел внешнего слоя ${number16()}` } })
  return d.edubridgeSaveSection.id
}

/** Опубликованный курс; `startsInDays` — день начала занятий от сегодняшнего. */
export async function publishCourse(token: string, sectionId: string, startsInDays: number | null, over: Record<string, unknown> = {}): Promise<any> {
  const input = courseInput(sectionId, { ...(startsInDays === null ? {} : { starts_at: dayFromNow(startsInDays) }), ...over })
  const created = (await gql<any>(token, CREATE_COURSE, { d: input })).edubridgeCreateCourse
  return (await gql<any>(token, SET_COURSE_STATUS, { d: { id: created.id, status: 'PUBLISHED' } })).edubridgeSetCourseStatus
}

// ── Обучающиеся и подписки ─────────────────────────────────────────────────

export const LEARNER_FIELDS = 'id display_name recipient_type recipient_value is_self'
export const ADD_LEARNER = `mutation($d:EduLearnerInput!){ edubridgeAddLearner(data:$d){ ${LEARNER_FIELDS} } }`
export const UPDATE_LEARNER = `mutation($d:EduUpdateLearnerInput!){ edubridgeUpdateLearner(data:$d){ ${LEARNER_FIELDS} } }`
export const REMOVE_LEARNER = 'mutation($id:ID!){ edubridgeRemoveLearner(id:$id) }'
export const MY_LEARNERS = `query{ edubridgeMyLearners{ ${LEARNER_FIELDS} } }`

export const ENROLLMENT_FIELDS = 'id learner_id course_id course_title period paid_until status access_state sub_hash paid_amount refunded_amount refund_reason cancelled_at close_pending'
export const MY_ENROLLMENTS = `query{ edubridgeMyEnrollments{ ${ENROLLMENT_FIELDS} } }`
export const QUOTE = `query($d:EduQuoteInput!){ edubridgeQuote(data:$d){
  amount months base_amount discount_amount from_program to_convert available enough shortfall is_extension paid_until sub_hash
} }`
export const CONVERT_STATEMENT = 'mutation($d:EduQuoteInput!){ edubridgeConvertStatement(data:$d){ full_title html hash meta binary } }'
export const SUBSCRIBE = `mutation($d:EduSubscribeInput!){ edubridgeSubscribe(data:$d){ ${ENROLLMENT_FIELDS} } }`
export const REFUND_PREVIEW = 'query($id:ID!){ edubridgeRefundPreview(enrollment_id:$id){ reason refund withheld lessons_paid lessons_used to_share } }'
export const CANCEL_ENROLLMENT = `mutation($id:ID!){ edubridgeCancelEnrollment(enrollment_id:$id){ ${ENROLLMENT_FIELDS} } }`
export const RETURN_BALANCE = 'query{ edubridgeReturnBalance{ available refunds total subscriptions } }'

export async function addLearner(token: string, name: string, isSelf = false): Promise<any> {
  const d = await gql<any>(token, ADD_LEARNER, {
    d: { display_name: name, recipient_type: 'ONSITE', recipient_value: `пропуск-${number16()}`, is_self: isSelf },
  })
  return d.edubridgeAddLearner
}

export async function quoteOf(token: string, learnerId: string, courseId: string): Promise<any> {
  return (await gql<any>(token, QUOTE, { d: { learner_id: learnerId, course_id: courseId, period: 'MONTH' } })).edubridgeQuote
}

/** Заявление о конвертации паевого взноса с подписью пайщика — по текущей раскладке оплаты. */
export async function signedConvertStatement(who: Who, token: string, learnerId: string, courseId: string): Promise<any> {
  const d = await gql<any>(token, CONVERT_STATEMENT, { d: { learner_id: learnerId, course_id: courseId, period: 'MONTH' } })
  return signDocument(who.wif, d.edubridgeConvertStatement, who.account, 1)
}

/** Подписка на месяц: заявление о конвертации, подпись пайщика, оплата. */
export async function subscribe(who: Who, token: string, learnerId: string, courseId: string): Promise<any> {
  const document = await signedConvertStatement(who, token, learnerId, courseId)
  const d = await gql<any>(token, SUBSCRIBE, { d: { learner_id: learnerId, course_id: courseId, period: 'MONTH', document } })
  return d.edubridgeSubscribe
}

export async function enrollmentOf(token: string, id: string): Promise<any | undefined> {
  const d = await gql<any>(token, MY_ENROLLMENTS)
  return (d.edubridgeMyEnrollments as any[]).find(e => e.id === id)
}

// ── Преподаватель ──────────────────────────────────────────────────────────

export const CONTRACT_FIELDS = 'contract_hash contract_number status decline_reason signed_at approved_at hourly_rate'
export const SAVE_PROFILE = 'mutation($d:EduTeacherProfileInput!){ edubridgeSaveTeacherProfile(data:$d){ about hourly_rate rate_locked } }'
export const MY_PROFILE = 'query{ edubridgeMyTeacherProfile{ about hourly_rate rate_locked } }'
export const MY_CONTRACT = `query{ edubridgeMyContract{ ${CONTRACT_FIELDS} } }`
export const SIGN_CONTRACT = `mutation($d:EduSignContractInput!){ edubridgeSignContract(data:$d){ ${CONTRACT_FIELDS} } }`
export const ASSIGNMENT_FIELDS = 'id teacher_username course_id course_title period_from period_to minutes_per_month status'
export const MY_ASSIGNMENTS = `query{ edubridgeMyAssignments{ ${ASSIGNMENT_FIELDS} } }`
export const CREATE_ASSIGNMENT = `mutation($d:EduAssignmentInput!){ edubridgeCreateAssignment(data:$d){ ${ASSIGNMENT_FIELDS} } }`
export const CLOSE_ASSIGNMENT = `mutation($id:ID!){ edubridgeCloseAssignment(id:$id){ ${ASSIGNMENT_FIELDS} } }`
export const SET_TEACHER_RATE = 'mutation($d:EduSetTeacherRateInput!){ edubridgeSetTeacherRate(data:$d) }'
export const TEACHERS = 'query{ edubridgeTeachers{ username about hourly_rate contract_number contract_status assignments_active } }'

/** Договор участия в хозяйственной деятельности с подписью преподавателя. */
export async function signedContract(who: Who, token: string): Promise<{ document: any, contract_number: string }> {
  const contract_number = number16()
  const d = await gql<any>(token, GENERATE, {
    i: {
      data: {
        registry_id: R.EducationParticipationContract.registry_id,
        coopname: COOP,
        username: who.account,
        contract_number,
        contract_created_at: today(),
      },
    },
  })
  return { document: await signDocument(who.wif, d.generateDocument, who.account, 1), contract_number }
}

const APPROVALS = `query($f:ApprovalFilter,$o:PaginationInput){ chairmanApprovals(filter:$f, options:$o){ items{
  _id approval_hash status username callback_contract
  document{ rawDocument{ full_title html hash meta binary } document{ version hash doc_hash meta_hash meta signatures{ id signer public_key signature signed_at signed_hash meta } } }
} } }`
const CONFIRM_APPROVAL = 'mutation($d:ConfirmApproveInput!){ chairmanConfirmApprove(data:$d){ _id status } }'

/** Одобрение председателя по договору преподавателя, которое ждёт решения. */
export async function pendingContractApproval(username: string): Promise<any | undefined> {
  const d = await gql<any>(await tokenOf(CHAIRMAN), APPROVALS, {
    f: { coopname: COOP, username, statuses: ['PENDING'] },
    o: { page: 1, limit: 50, sortOrder: 'DESC' },
  })
  return (d.chairmanApprovals.items as any[]).find(a => a.callback_contract === EXTENSION)
}

/** Председатель ставит вторую подпись на договоре преподавателя со стола одобрений. */
export async function approveContract(approval: any): Promise<void> {
  const approved_document = await signDocument(CHAIRMAN.wif, approval.document.rawDocument, CHAIRMAN.account, 2, [approval.document.document])
  await gql(await tokenOf(CHAIRMAN), CONFIRM_APPROVAL, {
    d: { coopname: COOP, approval_hash: String(approval.approval_hash).toLowerCase(), approved_document },
  })
}

/**
 * Преподаватель подключён целиком: рассказ о себе и ставка, оферта, договор с
 * подписью председателя. Ставка по умолчанию равна плановой ставке курсов набора.
 */
export async function onboardTeacher(who: Who, token: string, hourlyRate = PLANNED_RATE): Promise<void> {
  await gql(token, SAVE_PROFILE, { d: { about: 'Веду занятия набора внешнего слоя', hourly_rate: hourlyRate } })
  await signOffer(who, token, 'TEACHER')
  const { document, contract_number } = await signedContract(who, token)
  await gql(token, SIGN_CONTRACT, { d: { document, contract_number } })
  const approval = await waitFor(() => pendingContractApproval(who.account),
    { timeoutMs: 60_000, intervalMs: 1_000, label: `договор преподавателя ${who.account} на подписи у председателя` })
  await approveContract(approval)
  await waitFor(async () => ((await gql<any>(token, MY_CONTRACT)).edubridgeMyContract?.status === 'ACTIVE' ? true : null),
    { timeoutMs: 60_000, intervalMs: 1_000, label: `договор преподавателя ${who.account} действует` })
}
