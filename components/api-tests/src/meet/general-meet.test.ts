/**
 * Общее собрание пайщиков снаружи: созыв собрания (meet_pre — данные до цепи,
 * chain_texts — формулировки вопросов по хешу) и чтение собрания пайщиком.
 *
 * Председатель генерирует предложение повестки, подписывает его своим ключом
 * и созывает собрание. В цепь уходят хеши формулировок (C28-78), в ответ
 * контроллера — сами тексты: это и проверяется, вместе с таблицей вопросов
 * цепи, где должны лежать sha256 текстов.
 *
 * Собрание остаётся на повестке совета (решение creategm) — его никто не
 * утверждает, другим файлам оно не мешает: они ищут свои объекты по хешу.
 */
import crypto from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, ROLES, caseName, expectAuthDenied, expectCode, gql, gqlError, signDocument, tableRows, tokenOf } from '../core'


const digest = (text: string): string => text ? crypto.createHash('sha256').update(text, 'utf8').digest('hex') : ''

const MEET_FIELDS = `hash
  pre{ hash coopname initiator presider secretary open_at close_at details agenda{ title context decision } }
  processing{ hash isVoted extendedStatus meet{ id hash status initiator presider secretary } questions{ number title context decision meet_id } }
  processed{ hash }`

const GEN_AGENDA = `mutation($d:AnnualGeneralMeetingAgendaGenerateDocumentInput!){
  generateAnnualGeneralMeetAgendaDocument(data:$d){ full_title html hash meta binary } }`
const CREATE = `mutation($d:CreateAnnualGeneralMeetInput!){ createAnnualGeneralMeet(data:$d){ ${MEET_FIELDS} } }`
const GET = `query($d:GetMeetInput!){ getMeet(data:$d){ ${MEET_FIELDS} } }`
const LIST = `query($d:GetMeetsInput!){ getMeets(data:$d){ hash pre{ hash } processing{ hash meet{ status } } } }`

const tag = crypto.randomBytes(4).toString('hex')
const agenda = [
  { title: `Утвердить годовой отчёт ${tag}`, context: `Отчёт за год приложен ${tag}`, decision: `Утвердить отчёт ${tag}` },
  { title: `Избрать ревизора ${tag}`, context: '', decision: `Избрать ревизором пайщика ${tag}` },
]
const details = `Собрание проходит на платформе, вопросы — в повестке (${tag})`

let chairToken: string
let memberToken: string
let meetHash: string
let created: any
let proposal: any
let openAt: Date
let closeAt: Date

beforeAll(async () => {
  chairToken = await tokenOf(CHAIRMAN)
  memberToken = await tokenOf(ROLES.member())
})

describe('общее собрание: созыв и чтение', () => {
  it(caseName('meet.gm.happy.01', 'председатель созывает собрание по подписанной повестке — ответ несёт тексты, данные до цепи сохранены'), async () => {
    // В тестовом режиме контракта срок созыва не проверяется, но даты берутся
    // заведомо допустимые и для боевого: открытие через 16 суток.
    openAt = new Date(Date.now() + 16 * 24 * 3600_000)
    closeAt = new Date(openAt.getTime() + 24 * 3600_000)
    const generated = (await gql<any>(chairToken, GEN_AGENDA, {
      d: {
        coopname: COOP,
        username: CHAIRMAN.account,
        is_repeated: false,
        meet: { type: 'regular', open_at_datetime: openAt.toISOString(), close_at_datetime: closeAt.toISOString() },
        questions: agenda.map((q, i) => ({ number: String(i + 1), title: q.title, context: q.context, decision: q.decision })),
      },
    })).generateAnnualGeneralMeetAgendaDocument
    proposal = await signDocument(CHAIRMAN.wif, generated, CHAIRMAN.account, 1)

    created = (await gql<any>(chairToken, CREATE, {
      d: {
        coopname: COOP,
        initiator: CHAIRMAN.account,
        presider: CHAIRMAN.account,
        secretary: CHAIRMAN.account,
        agenda,
        open_at: openAt.toISOString(),
        close_at: closeAt.toISOString(),
        proposal,
        details,
      },
    })).createAnnualGeneralMeet
    meetHash = created.hash
    expect(meetHash).toBeTruthy()

    expect(created.pre).toMatchObject({ coopname: COOP, initiator: CHAIRMAN.account, presider: CHAIRMAN.account, secretary: CHAIRMAN.account, details })
    expect(created.pre.agenda).toEqual(agenda)
    expect(new Date(created.pre.open_at).getTime()).toBe(openAt.getTime())
    expect(new Date(created.pre.close_at).getTime()).toBe(closeAt.getTime())

    expect(created.processing.meet.status).toBe('created')
    expect(created.processing.extendedStatus).toBe('CREATED')
    expect(created.processing.questions.map((q: any) => [q.number, q.title, q.context, q.decision]))
      .toEqual(agenda.map((q, i) => [i + 1, q.title, q.context, q.decision]))
    expect(created.processed).toBeNull()
  })

  it(caseName('meet.texts.happy.02', 'в цепи лежат хеши формулировок, контроллер отдаёт тексты'), async () => {
    const meetId = Number(created.processing.meet.id)
    const rows = (await tableRows<any>('meet', COOP, 'questions')).filter(q => Number(q.meet_id) === meetId)
    rows.sort((a, b) => Number(a.number) - Number(b.number))
    expect(rows.map(q => [q.title, q.context, q.decision]))
      .toEqual(agenda.map(q => [digest(q.title), digest(q.context), digest(q.decision)]))
  })

  it(caseName('meet.gm.happy.02', 'пайщик читает собрание по хешу и находит его в списке — тексты, а не хеши'), async () => {
    const meet = (await gql<any>(memberToken, GET, { d: { coopname: COOP, hash: meetHash } })).getMeet
    expect(meet.hash.toLowerCase()).toBe(meetHash.toLowerCase())
    expect(meet.pre.agenda).toEqual(agenda)
    expect(meet.pre.details).toBe(details)
    expect(meet.processing.isVoted).toBe(false)
    expect(meet.processing.questions.map((q: any) => q.title)).toEqual(agenda.map(q => q.title))

    const list = (await gql<any>(memberToken, LIST, { d: { coopname: COOP } })).getMeets
    const found = list.find((m: any) => m.hash.toLowerCase() === meetHash.toLowerCase())
    expect(found, 'созванное собрание в списке').toBeTruthy()
    expect(found.pre?.hash?.toLowerCase()).toBe(meetHash.toLowerCase())
    expect(found.processing.meet.status).toBe('created')
  })

  it(caseName('meet.gm.side.01', 'созвать собрание пайщик не может, гостю закрыто и чтение'), async () => {
    // Тот же подписанный набор, что прошёл у председателя: отказ — только по роли.
    const data = {
      d: {
        coopname: COOP,
        initiator: CHAIRMAN.account,
        presider: CHAIRMAN.account,
        secretary: CHAIRMAN.account,
        agenda,
        open_at: openAt.toISOString(),
        close_at: closeAt.toISOString(),
        proposal,
      },
    }
    expectCode(await gqlError(memberToken, CREATE, data), 'KIT_INSUFFICIENT_RIGHTS')
    expectAuthDenied(await gqlError(null, CREATE, data))
    const errValid = await gqlError(memberToken, GEN_AGENDA, {
      d: { coopname: COOP, username: CHAIRMAN.account, is_repeated: false, meet: { type: 'regular', open_at_datetime: 'x', close_at_datetime: 'y' }, questions: [] },
    })
    expectCode(errValid, 'KIT_INSUFFICIENT_RIGHTS')

    expectAuthDenied(await gqlError(null, LIST, { d: { coopname: COOP } }))
    expectAuthDenied(await gqlError(null, GET, { d: { coopname: COOP, hash: meetHash } }))
  })
})
