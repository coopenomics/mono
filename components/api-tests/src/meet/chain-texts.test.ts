/**
 * Формулировки вопросов общего собрания (meet.chain-texts).
 *
 * В цепь уходит sha256 формулировки, сам текст живёт в базе контроллера.
 * Клиент этого не замечает: повестка отправляется текстом, и вопросы собрания
 * читаются текстом — контроллер подставляет его по хешу.
 */
import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, COUNCIL, caseName, gql, signDocument, tokenOf } from '../core'

const GENERATE_AGENDA = `mutation($d:AnnualGeneralMeetingAgendaGenerateDocumentInput!){
  generateAnnualGeneralMeetAgendaDocument(data:$d){ full_title html hash meta binary }
}`

const CREATE = `mutation($d:CreateAnnualGeneralMeetInput!){ createAnnualGeneralMeet(data:$d){ hash } }`

const GET = `query($d:GetMeetInput!){ getMeet(data:$d){ hash
  processing{ meet{ id status } questions{ number title decision context } }
} }`

const sha256 = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest('hex')

describe('meet.chain-texts: тексты повестки в базе, в цепи — хеш', () => {
  it(caseName('meet.texts.happy.02', 'контроллер отправляет повестку и читает вопросы текстом, а не хешами'), async () => {
    const token = await tokenOf(CHAIRMAN)
    const tag = crypto.randomBytes(4).toString('hex')
    const agenda = [
      { title: `Об утверждении отчёта совета за год (${tag})`, decision: `Утвердить отчёт совета (${tag})`, context: `Отчёт приложен к повестке (${tag})` },
      { title: `О выборах ревизора (${tag})`, decision: `Избрать ревизором Петрова П. П. (${tag})`, context: '' },
    ]
    const open = new Date(Date.now() + 16 * 24 * 3600_000)
    const close = new Date(open.getTime() + 7 * 24 * 3600_000)

    const doc = (await gql<any>(token, GENERATE_AGENDA, {
      d: {
        coopname: COOP,
        username: CHAIRMAN.account,
        is_repeated: false,
        meet: { type: 'regular', open_at_datetime: open.toISOString(), close_at_datetime: close.toISOString() },
        questions: agenda.map((q, i) => ({ number: String(i + 1), ...q })),
      },
    })).generateAnnualGeneralMeetAgendaDocument
    const proposal = await signDocument(CHAIRMAN.wif, doc, CHAIRMAN.account)

    const created = (await gql<any>(token, CREATE, {
      d: {
        coopname: COOP,
        initiator: CHAIRMAN.account,
        presider: CHAIRMAN.account,
        secretary: COUNCIL.account,
        open_at: open.toISOString(),
        close_at: close.toISOString(),
        agenda,
        proposal,
      },
    })).createAnnualGeneralMeet

    const meet = (await gql<any>(token, GET, { d: { coopname: COOP, hash: created.hash } })).getMeet
    const questions = [...meet.processing.questions].sort((a: any, b: any) => a.number - b.number)
    expect(questions).toHaveLength(2)
    questions.forEach((q: any, i: number) => {
      expect(q.title).toBe(agenda[i].title)
      expect(q.decision).toBe(agenda[i].decision)
      expect(q.context).toBe(agenda[i].context)
      expect(q.title).not.toBe(sha256(agenda[i].title))
    })

  })
})
