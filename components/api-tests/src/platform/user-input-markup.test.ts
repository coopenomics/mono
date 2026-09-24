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

    // Банковский счёт, добавленный председателем отдельно, — тот же отказ.
    const target = await register('individual', individualData())
    expect(target.r.errors).toEqual([])
    const add = await gqlRaw<any>(await tokenOf(CHAIRMAN), `mutation($d:AddPaymentMethodInput!){ addPaymentMethod(data:$d){ method_id } }`, {
      d: { username: target.username, is_default: false, bank_transfer_data: bankAccount({ bank_name: 'Банк <script>x</script>' }) },
    })
    expect(codeOf(add)).toBe(INPUT_REFUSAL)
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
})
