/**
 * Разметка во вводе пайщика (platform.user-input-markup, C28-74).
 *
 * Данные анкеты подставляются в документ с выключенным автоэкранированием,
 * поэтому угловых скобок в анкете быть не должно вовсе: сервер отказывает сам,
 * какой бы клиент ни прислал запрос. Описания проектов и задач — другое
 * правило: разметка там законна, при записи вырезается только исполняемое.
 */
import crypto from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, caseName, freshMember, gql, gqlRaw, login, randomAccount, tokenOf } from '../core'
import type { AccountKind } from './platform-b.helpers'
import { ADD_METHOD, GET_METHODS, UPDATE_BANK } from '../payments/payments.helpers'
import {
  REGISTER_ACCOUNT,
  bankAccount,
  codeOf,
  entrepreneurData,
  freshKeyPair,
  individualData,
  organizationData,
  registerInput,
} from './platform-b.helpers'

/** Отказ проверки ввода (ValidationPipe отвечает 422). */
const INPUT_REFUSAL = '422'

const PRIVATE = `query($d:GetAccountInput!){ getAccount(data:$d){ username private_account{
  individual_data{ first_name last_name full_address passport{ issued_by } }
  entrepreneur_data{ last_name full_address }
  organization_data{ full_name full_address represented_by{ based_on } }
} } }`

async function register(kind: AccountKind, data: Record<string, unknown>) {
  const username = randomAccount('mk')
  const { publicKey } = await freshKeyPair()
  const r = await gqlRaw<any>(null, REGISTER_ACCOUNT, { d: registerInput(username, publicKey, kind, data) })
  return { username, r }
}

/** Аккаунт не заведён: отказ пришёл раньше записи. */
async function notCreated(username: string): Promise<boolean> {
  const r = await gqlRaw<any>(await tokenOf(CHAIRMAN), PRIVATE, { d: { username } })
  return !r.data?.getAccount?.private_account
}

describe('platform.user-input-markup: разметка в анкете и в описаниях', () => {
  it(caseName('platform.input.happy.01', 'анкеты физлица, ИП и организации с дефисом, апострофом и дробью принимаются как введены'), async () => {
    const token = await tokenOf(CHAIRMAN)

    const ind = individualData()
    const a = await register('individual', ind)
    expect(a.r.errors).toEqual([])
    const ai = (await gql<any>(token, PRIVATE, { d: { username: a.username } })).getAccount.private_account.individual_data
    expect(ai.last_name).toBe(ind.last_name)
    expect(ai.first_name).toBe(ind.first_name)
    expect(ai.full_address).toBe(ind.full_address)
    expect(ai.passport.issued_by).toBe(ind.passport.issued_by)

    const ent = entrepreneurData()
    const b = await register('entrepreneur', ent)
    expect(b.r.errors).toEqual([])
    const be = (await gql<any>(token, PRIVATE, { d: { username: b.username } })).getAccount.private_account.entrepreneur_data
    expect(be.last_name).toBe(ent.last_name)
    expect(be.full_address).toBe(ent.full_address)

    const org = organizationData()
    const c = await register('organization', org)
    expect(c.r.errors).toEqual([])
    const co = (await gql<any>(token, PRIVATE, { d: { username: c.username } })).getAccount.private_account.organization_data
    expect(co.full_name).toBe(org.full_name)
    expect(co.represented_by.based_on).toBe(org.represented_by.based_on)
  })

  it(caseName('platform.input.break.01', 'угловые скобки в фамилии или адресе — отказ, аккаунт не заводится'), async () => {
    const cases: [AccountKind, Record<string, unknown>][] = [
      ['individual', individualData({ last_name: 'Иванов<b>' })],
      ['individual', individualData({ full_address: 'г. Москва <img src=x onerror=alert(1)>' })],
      ['entrepreneur', entrepreneurData({ last_name: '<script>alert(1)</script>' })],
      ['organization', organizationData({ full_name: 'ПК <a href="http://evil">Ромашка</a>' })],
      ['organization', organizationData({ fact_address: '<img src="file:///etc/passwd">' })],
    ]
    for (const [kind, data] of cases) {
      const { username, r } = await register(kind, data)
      expect(codeOf(r), `${kind}: ${JSON.stringify(data).slice(0, 120)}`).toBe(INPUT_REFUSAL)
      expect(await notCreated(username)).toBe(true)
    }

    // Правка анкеты председателем проходит ту же проверку.
    const target = await register('individual', individualData())
    expect(target.r.errors).toEqual([])
    const upd = await gqlRaw<any>(await tokenOf(CHAIRMAN), `mutation($d:UpdateAccountInput!){ updateAccount(data:$d){ username } }`, {
      d: {
        username: target.username,
        individual_data: {
          ...individualData({ last_name: 'Петров<i>' }),
          username: target.username,
          email: `${target.username}@api-tests.coop`,
        },
      },
    })
    expect(codeOf(upd)).toBe(INPUT_REFUSAL)
    const after = (await gql<any>(await tokenOf(CHAIRMAN), PRIVATE, { d: { username: target.username } })).getAccount.private_account.individual_data
    expect(after.last_name).toBe(individualData().last_name)
  })

  it(caseName('platform.input.break.02', 'разметка во вложенных данных — паспорт, банк, представитель организации — отказ'), async () => {
    const cases: [AccountKind, Record<string, unknown>][] = [
      ['individual', individualData({ passport: { ...individualData().passport, issued_by: 'ОВД <b>Тверской</b>' } })],
      ['entrepreneur', entrepreneurData({ bank_account: bankAccount({ bank_name: 'Банк <iframe src=x>' }) })],
      ['entrepreneur', entrepreneurData({ bank_account: bankAccount({ details: { bik: '<044525225>', corr: '30101810400000000225' } }) })],
      ['organization', organizationData({ represented_by: { ...organizationData().represented_by, position: 'Председатель <b>совета</b>' } })],
      ['organization', organizationData({ details: { inn: '7700000001', ogrn: '1027700000001', kpp: '<kpp>' } })],
    ]
    for (const [kind, data] of cases) {
      const { username, r } = await register(kind, data)
      expect(codeOf(r), `${kind}: ${JSON.stringify(data).slice(0, 160)}`).toBe(INPUT_REFUSAL)
      expect(await notCreated(username)).toBe(true)
    }
  })

  it(caseName('platform.input.break.02', 'разметка в банковских реквизитах пайщика — отказ при добавлении и при правке, реквизиты не меняются'), async () => {
    // До 25.09.2026 вложенные реквизиты шли мимо проверки (@ValidateNested
    // без @Type) и сохранялись со скриптом.
    const who = freshMember({ prefix: 'mkbank' })
    const token = await login(who)

    const script = await gqlRaw<any>(token, ADD_METHOD, {
      d: { username: who.account, is_default: false, bank_transfer_data: bankAccount({ bank_name: 'Банк <script>x</script>' }) },
    })
    expect(codeOf(script)).toBe(INPUT_REFUSAL)

    const clean = (await gql<any>(token, ADD_METHOD, {
      d: { username: who.account, is_default: false, bank_transfer_data: bankAccount({ bank_name: 'Банк Проверочный' }) },
    })).addPaymentMethod
    const img = await gqlRaw<any>(token, UPDATE_BANK, {
      d: { username: who.account, method_id: clean.method_id, is_default: false, data: bankAccount({ bank_name: 'Банк <img src=x onerror=alert(1)>' }) },
    })
    expect(codeOf(img)).toBe(INPUT_REFUSAL)

    const methods = (await gql<any>(token, GET_METHODS, { d: { username: who.account } })).getPaymentMethods.items as any[]
    const names = methods.map(m => m.data?.bank_name).filter(Boolean)
    expect(names).toEqual(['Банк Проверочный'])
  })

  describe('описания проектов и задач', () => {
    let token: string

    beforeAll(async () => {
      const who = freshMember({ prefix: 'mkup' })
      token = await login(who)
    })

    async function localProject(description: string, invite = '') {
      const hash = crypto.randomBytes(32).toString('hex')
      const d = await gql<any>(token, `mutation($d:CreateProjectInput!){ capitalCreateLocalProject(data:$d){ project_hash description invite } }`, {
        d: { coopname: COOP, project_hash: hash, parent_hash: '', title: 'Проверка очистки описания', description, invite, meta: '', data: '' },
      })
      const read = await gql<any>(token, `query($d:GetProjectInput!){ capitalProject(data:$d){ description invite } }`, { d: { hash } })
      return { created: d.capitalCreateLocalProject, read: read.capitalProject }
    }

    async function freeIssue(description: string) {
      const d = await gql<any>(token, `mutation($d:CreateIssueInput!){ capitalCreateIssue(data:$d){ issue_hash description } }`, {
        d: { coopname: COOP, title: 'Проверка очистки описания задачи', description },
      })
      const read = await gql<any>(token, `query($d:GetCapitalIssueByHashInput!){ capitalIssue(data:$d){ description } }`, {
        d: { issue_hash: d.capitalCreateIssue.issue_hash },
      })
      return read.capitalIssue.description as string
    }

    it(caseName('platform.input.break.03', 'скрипт, рамка и ссылка javascript: вырезаются при записи прямым запросом в API'), async () => {
      const evil = 'Описание<script>fetch("/steal")</script> проекта\n\n[нажми](javascript:alert(1))\n\nдо<iframe src="https://evil.example"></iframe>после\n\n<img src="/logo.png" onerror="alert(1)">'
      const { read } = await localProject(evil, 'Приглашение<script>alert(2)</script>')
      for (const text of [read.description, read.invite]) {
        expect(text).not.toMatch(/<script/i)
        expect(text).not.toMatch(/<iframe/i)
        expect(text).not.toMatch(/javascript:/i)
        expect(text).not.toMatch(/onerror/i)
      }
      expect(read.description).toContain('Описание проекта')
      expect(read.description).toContain('[нажми](unsafe:alert(1))')
      expect(read.description).toContain('допосле')
      expect(read.description).toContain('<img src="/logo.png">')

      const issue = await freeIssue('Задача<script>alert(1)</script> готова <iframe src="x"></iframe>')
      expect(issue).toBe('Задача готова ')
    })

    it(caseName('platform.input.happy.02', 'таблица, разметка, BPMN и код в блоке сохраняются как введены'), async () => {
      const text = [
        '# Проект',
        '',
        '| а | б |',
        '|---|---|',
        '| 1 | 2 |',
        '',
        '<div class="note">Заметка</div>',
        '',
        '<?xml version="1.0"?>',
        '<bpmn:definitions id="d1"><bpmn:process id="p1" isExecutable="false"/></bpmn:definitions>',
        '',
        '```html',
        '<script>alert(1)</script>',
        '```',
        '',
      ].join('\n')
      const { read } = await localProject(text)
      expect(read.description).toBe(text)
      expect(await freeIssue(text)).toBe(text)
    })
  })
  // Третье правило (решение владельца 25.09.2026, C28-80): повестка собрания и
  // проект решения совета уходят в подписываемый документ как есть — вёрстка
  // допускается (проекты решений на утверждение несут HTML документа), а
  // исполняемое отклоняется на входе. Переписывать нельзя: документ
  // подписывается по хэшу.
  describe('тексты документов: вёрстка проходит, исполняемое отклоняется', () => {
    const EVIL = [
      '<script>fetch("/steal")</script>Утвердить',
      'Утвердить <img src=x onerror=alert(1)>',
      '<a href="javascript:alert(1)">Утвердить</a>',
      '<iframe src="https://evil.example"></iframe>',
      '<form action="https://evil.example"><input name=x></form>',
    ]
    const LAYOUT = '<style>td{padding:4px}</style><p><b>Утвердить</b> положение:</p><table><tr><td>п. 1</td><td>редакция 2</td></tr></table>'

    let chairman: string
    let member: string
    let memberAccount: string

    beforeAll(async () => {
      chairman = await tokenOf(CHAIRMAN)
      const who = freshMember({ prefix: 'mkd' })
      member = await tokenOf(who)
      memberAccount = who.account
    })

    function refused(r: { errors: { code: string | null, message: string }[] }, label: string): void {
      expect(r.errors.length, label).toBeGreaterThan(0)
      expect(String(r.errors[0].code), label).toBe(INPUT_REFUSAL)
      expect(r.errors[0].message, label).toMatch(/исполняемую разметку/)
    }

    const GEN_AGENDA = `mutation($d:AnnualGeneralMeetingAgendaGenerateDocumentInput!){ generateAnnualGeneralMeetAgendaDocument(data:$d){ html } }`
    const agendaInput = (text: string) => {
      const openAt = new Date(Date.now() + 16 * 24 * 3600_000)
      return {
        coopname: COOP,
        username: CHAIRMAN.account,
        is_repeated: false,
        meet: { type: 'regular', open_at_datetime: openAt.toISOString(), close_at_datetime: new Date(openAt.getTime() + 24 * 3600_000).toISOString() },
        questions: [{ number: '1', title: 'Вопрос', context: text, decision: text }],
      }
    }

    it(caseName('platform.input.break.04', 'повестка общего собрания и собрания участка: скрипт, обработчик, javascript:, рамка, форма — отказ'), async () => {
      const GEN_KU = `mutation($d:BranchMeetingProposalGenerateDocumentInput!){ kuGenerateMeetingProposal(data:$d){ html } }`
      for (const text of EVIL) {
        refused(await gqlRaw(chairman, GEN_AGENDA, { d: agendaInput(text) }), `общее собрание: ${text}`)
        refused(await gqlRaw(member, GEN_KU, {
          d: { coopname: COOP, username: memberAccount, hash: crypto.randomBytes(32).toString('hex'), type: 'free', questions: [{ number: '1', title: 'Вопрос', context: '', decision: text }] },
        }), `участок: ${text}`)
      }
    })

    it(caseName('platform.input.break.05', 'проект решения совета и шаги онбординга с исполняемой разметкой — отказ до записи'), async () => {
      const text = EVIL[1]
      refused(await gqlRaw(chairman, 'mutation($d:CreateProjectFreeDecisionInput!){ createProjectOfFreeDecision(data:$d){ id } }', {
        d: { question: 'Вопрос', decision: text },
      }), 'свободное решение')
      refused(await gqlRaw(chairman, 'mutation($d:CapitalOnboardingStepInput!){ completeCapitalOnboardingStep(data:$d){ __typename } }', {
        d: { step: 'blagorost_program', question: 'Утвердить программу', decision: text },
      }), 'онбординг Благороста')
      refused(await gqlRaw(chairman, 'mutation($d:ChairmanOnboardingAgendaInput!){ completeChairmanAgendaStep(data:$d){ __typename } }', {
        d: { step: 'privacy_agreement', question: 'Утвердить положение', decision: text },
      }), 'онбординг председателя')
      refused(await gqlRaw(chairman, 'mutation($d:CompleteExtensionOnboardingStepInput!){ completeExtensionOnboardingStep(data:$d){ __typename } }', {
        d: { extension_name: 'marketplace', step_key: 'api-tests-markup', question: 'Утвердить', decision: text },
      }), 'онбординг расширения')
    })

    it(caseName('platform.input.happy.03', 'вёрстка документа — абзацы, таблица, стили — принимается как введена'), async () => {
      const agenda = await gql<any>(chairman, GEN_AGENDA, { d: agendaInput(LAYOUT) })
      expect(agenda.generateAnnualGeneralMeetAgendaDocument.html).toContain('<table><tr><td>п. 1</td>')

      const project = await gql<any>(chairman, 'mutation($d:CreateProjectFreeDecisionInput!){ createProjectOfFreeDecision(data:$d){ id decision } }', {
        d: { question: 'Утвердить положение', decision: LAYOUT },
      })
      expect(project.createProjectOfFreeDecision.decision).toBe(LAYOUT)
    })
  })
})
