/**
 * Заявление об аннулировании соглашений об участии в программах и судьба
 * кошельков при выходе снаружи (test-registry/membership.exit.yaml,
 * documents.approvals.yaml).
 *
 * Заявление формируется по предрасчёту выхода: программы пайщика таблицей с
 * датой соглашения и остатками кошельков; у каждого кошелька сказано,
 * возвращается он на главный паевой или остаётся Обществу. Документы
 * формируются без сохранения — состояние пайщика из засева не меняется.
 */
import crypto from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, COUNCIL, ROLES, amount, caseName, docMeta, expectAuthDenied, gql, gqlError, tokenOf } from '../core'
import { templates } from '../documents/docs-reports.helpers'
import { exitReturnPreview } from './exit-documents.helpers'

const GENERATE_ANNULMENT = `mutation($d:ProgramAgreementsAnnulmentGenerateDocumentInput!,$o:GenerateDocumentOptionsInput){
  generateProgramAgreementsAnnulment(data:$d, options:$o){ full_title html hash meta }
}`

const RETURNS = 'возвращается на главный паевой кошелёк'
const STAYS = 'остаётся Обществу по условиям Положения программы'
const TOTAL = 'Итого к переводу на главный паевой кошелёк'
const WITH_EXIT = 'в связи с моим выходом из состава пайщиков'
const NO_CLAIMS = 'иных требований по этим программам к Обществу я не имею'
const ON_COUNCIL_DAY = 'на день принятия решения Советом'
const ON_APPROVAL_DAY = 'на день согласования настоящего заявления'

describe('заявление об аннулировании соглашений и кошельки при выходе', () => {
  /** Пайщик из засева: состоит в программе кошелька и в «Столе заказов». */
  let member: Who
  let token = ''
  let preview: any
  let programs: any[]

  const input = (over: Record<string, unknown> = {}) => ({
    d: { coopname: COOP, username: member.account, skip_save: true, programs, total_refund: preview.total, ...over },
    o: { lang: 'ru' },
  })
  const generate = async (t: string, over: Record<string, unknown> = {}) =>
    (await gql<any>(t, GENERATE_ANNULMENT, input(over))).generateProgramAgreementsAnnulment
  const wallets = (): any[] => (preview.programs as any[]).flatMap(p => p.wallets as any[])

  beforeAll(async () => {
    member = ROLES.member()
    token = await tokenOf(member)
    preview = await exitReturnPreview(token, member.account)
    programs = (preview.programs as any[])
      .filter(p => Boolean(p.agreement_hash) && p.program_id > 0)
      .map(p => ({
        program_id: p.program_id,
        title: p.title,
        agreement_signed_at: p.agreement_signed_at ?? '',
        agreement_hash: p.agreement_hash,
        refund: p.refund,
        wallets: (p.wallets as any[]).map(w => ({ wallet_name: w.wallet_name, human_name: w.human_name, balance: w.balance, returns: w.returns })),
      }))
  })

  it(caseName('exit.doc.happy.01', 'заявление пайщика с несколькими программами: программы таблицей с остатками кошельков и итогом к переводу'), async () => {
    expect(programs.length, 'пайщик из засева состоит в нескольких программах').toBeGreaterThanOrEqual(2)
    const doc = await generate(token, { exit_hash: crypto.randomBytes(32).toString('hex') })
    for (const p of programs) {
      expect(doc.html, p.title).toContain(p.title)
      for (const w of p.wallets) expect(doc.html, w.human_name).toContain(w.human_name)
    }
    expect(doc.html).toContain(TOTAL)
    expect(doc.html).not.toMatch(/undefined|\[object Object\]|\{\{|\}\}/)
    const meta = docMeta(doc.meta)
    expect(meta.programs.map((p: any) => p.program_id).sort()).toEqual(programs.map(p => p.program_id).sort())
    expect(meta.total_refund).toBe(preview.total)
  })

  it(caseName('exit.doc.happy.02', 'у возвратного кошелька — отметка о переводе на главный паевой, у остающегося — ссылка на Положение программы'), async () => {
    const all = programs.flatMap(p => p.wallets as any[])
    expect(all.some(w => w.returns), 'у пайщика есть возвратный кошелёк').toBe(true)
    expect(all.some(w => !w.returns), 'у пайщика есть кошелёк, который остаётся Обществу').toBe(true)
    const doc = await generate(token)
    expect(doc.html).toContain(RETURNS)
    expect(doc.html).toContain(STAYS)
  })

  it(caseName('exit.doc.side.01', 'заявление без выхода из кооператива: связи с выходом в тексте нет, просьба об аннулировании остаётся'), async () => {
    const alone = await generate(token)
    expect(alone.html).not.toContain(WITH_EXIT)
    expect(alone.html).toContain(ON_APPROVAL_DAY)
    expect(alone.html).toContain('Прошу аннулировать мои соглашения')

    const withExit = await generate(token, { exit_hash: crypto.randomBytes(32).toString('hex') })
    expect(withExit.html).toContain(WITH_EXIT)
    expect(withExit.html).not.toContain(ON_APPROVAL_DAY)
  })

  it(caseName('exit.doc.happy.03', 'в заявлении стоят оговорки об отсутствии иных требований и о сумме на день решения совета'), async () => {
    const doc = await generate(token, { exit_hash: crypto.randomBytes(32).toString('hex') })
    expect(doc.html).toContain(NO_CLAIMS)
    expect(doc.html).toContain(ON_COUNCIL_DAY)
  })

  it(caseName('exit.wallets.happy.01', 'при выходе возвращаются минимальный и главный паевой; главный паевой кошелёк ровно один'), async () => {
    const all = wallets()
    const main = all.filter(w => w.policy === 'MAIN')
    expect(main.map(w => w.wallet_name)).toEqual(['w.wal.share'])
    expect(all.find(w => w.wallet_name === 'w.reg.minshr')).toMatchObject({ returns: true })
    for (const w of all.filter(x => ['MAIN', 'RETURN_TO_MAIN'].includes(x.policy))) expect(w.returns, w.wallet_name).toBe(true)
    // Итог предрасчёта — сумма возвратных кошельков.
    const returned = all.filter(w => w.returns).reduce((s, w) => s + amount(w.balance), 0)
    expect(amount(preview.total)).toBeCloseTo(returned, 4)
  })

  it(caseName('exit.wallets.side.01', 'членский взнос «Стола заказов» при выходе остаётся кооперативу и в сумму возврата не входит'), async () => {
    const stays = wallets().filter(w => !w.returns)
    expect(stays.length).toBeGreaterThan(0)
    for (const w of stays) expect(['FORFEIT', 'BLOCKER'], w.wallet_name).toContain(w.policy)
    expect(stays.some(w => w.policy === 'FORFEIT' && /^w\.mkt\./.test(w.wallet_name)), 'членский взнос Стола заказов').toBe(true)
  })

  it(caseName('mem.exit.break.09', 'заявление об аннулировании пайщик формирует только за себя; совет и председатель — за любого'), async () => {
    const other = await tokenOf(ROLES.otherMember())
    const refused = await gqlError(other, GENERATE_ANNULMENT, input())
    expect(refused, 'чужое заявление не формируется').not.toBeNull()
    expect(['KIT_RIGHT_SCOPE_OWN', 'KIT_INSUFFICIENT_RIGHTS', '403']).toContain(String(refused!.code))
    expectAuthDenied(await gqlError(null, GENERATE_ANNULMENT, input()))
    expect((await generate(await tokenOf(COUNCIL))).html).toContain(programs[0].title)
    expect((await generate(await tokenOf(CHAIRMAN))).html).toContain(programs[0].title)
  })

  it(caseName('doc.appr.happy.21', 'заявление об аннулировании соглашений объявлено формой ядра рядом с заявлением на выход'), async () => {
    const all = await templates(await tokenOf(CHAIRMAN))
    const annulment = all.find(t => t.registry_id === 190)
    const exit = all.find(t => t.registry_id === 200)
    expect(annulment, 'заявление 190 в реестре шаблонов').toMatchObject({ extension_name: 'core', kind: 'Form' })
    expect(exit, 'заявление 200 в реестре шаблонов').toMatchObject({ extension_name: 'core', kind: 'Form' })
    expect(annulment!.bundle).toBe(exit!.bundle)
    const coreForms = all.filter(t => t.extension_name === 'core' && t.bundle === exit!.bundle)
    expect(new Set(coreForms.map(t => t.order)).size, 'порядковые номера форм ядра не пересекаются').toBe(coreForms.length)
  })
})
