/**
 * Права ядра снаружи: учётные записи, кошелёк, вступление, настройки
 * кооператива (случаи core.acc.* в test-registry/core.account-rights.yaml).
 *
 * Свои данные пайщик читает по праву с охватом «своё»: имя в запросе
 * сверяется с вошедшим. Совет читает данные любого пайщика, но действовать за
 * него на узле не может. Страницы столов председателя и пайщика получают
 * права из той же таблицы.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COUNCIL, ROLES, caseName, gql, tokenOf } from '../core'
import type { RightsProbe } from '../rights/probe'
import { NOT_OWN, NO_RIGHT, loadRightsProbe } from '../rights/probe'

const DESKTOP = 'query{ getDesktop{ workspaces{ name extension_name grants } } }'

/** Чтение своих данных: операция → путь имени в запросе. */
const OWN_READS: [string, string][] = [
  ['getAccount', 'data.username'],
  ['getUserWallets', 'username'],
  ['getProgramWallet', 'filter.username'],
  ['getCandidateIntake', 'username'],
]
/** Действия только на своё имя: совету чужое имя закрыто. */
const OWN_ACTS = ['createWithdraw', 'createDepositPayment', 'selectBranch', 'registerParticipant', 'createInitialPayment', 'deletePaymentMethod']

const member: Who = ROLES.member()
const tokens: Record<string, string> = {}
let probe: RightsProbe

/** Права стола `extension` у вошедшего (или гостя — `token` null). */
async function deskGrants(token: string | null, extension: string): Promise<string[]> {
  const desk = (await gql<any>(token, DESKTOP)).getDesktop
  const workspace = (desk.workspaces as any[]).find(w => w.extension_name === extension)
  return (workspace?.grants as string[] | undefined) ?? []
}

beforeAll(async () => {
  for (const who of [CHAIRMAN, COUNCIL, member])
    tokens[who.account] = await tokenOf(who)
  probe = await loadRightsProbe(tokens[CHAIRMAN.account])
}, 180_000)

describe('ядро: права учётных записей и настроек по таблице', () => {
  it(caseName('core.acc.happy.01', 'пайщик читает свои данные, совет — данные любого пайщика'), async () => {
    for (const [name, path] of OWN_READS) {
      expect(await probe.denial(tokens[member.account], name, { [path]: member.account }), `${name}: пайщик своё`).toBeNull()
      expect(await probe.denial(tokens[COUNCIL.account], name, { [path]: member.account }), `${name}: совет`).toBeNull()
    }
  }, 240_000)

  it(caseName('core.acc.side.01', 'чужие данные пайщику закрыты'), async () => {
    for (const [name, path] of OWN_READS)
      expect(await probe.denial(tokens[member.account], name, { [path]: COUNCIL.account }), name).toBe(NOT_OWN)
  }, 240_000)

  it(caseName('core.acc.side.02', 'за другого пайщика на узле не действуют ни член совета, ни председатель'), async () => {
    for (const name of OWN_ACTS) {
      expect(await probe.denial(tokens[COUNCIL.account], name, { 'data.username': member.account }), `${name}: член совета`).toBe(NOT_OWN)
      expect(await probe.denial(tokens[member.account], name, { 'data.username': COUNCIL.account }), `${name}: пайщик`).toBe(NOT_OWN)
    }
    expect(await probe.denial(tokens[CHAIRMAN.account], 'createWithdraw', { 'data.username': member.account })).toBe(NOT_OWN)
  }, 240_000)

  it(caseName('core.acc.side.04', 'документ решения совета пайщик не получает и на своё имя'), async () => {
    expect(await probe.denial(tokens[member.account], 'generateMembershipExitDecision', { 'data.username': member.account })).toBe(NO_RIGHT)
    expect(await probe.denial(tokens[COUNCIL.account], 'generateMembershipExitDecision', { 'data.username': member.account })).toBeNull()
  }, 240_000)

  it(caseName('core.acc.side.06', 'чужие реквизиты ведёт председатель; члену совета отказ'), async () => {
    expect(await probe.denial(tokens[COUNCIL.account], 'updateBankAccount', { 'data.username': member.account })).toBe(NOT_OWN)
    expect(await probe.denial(tokens[member.account], 'updateBankAccount', { 'data.username': COUNCIL.account })).toBe(NOT_OWN)
  }, 240_000)

  it(caseName('core.acc.happy.06', 'гость получает права страниц без входа, пайщик — страницы своих данных'), async () => {
    const guest = await deskGrants(null, 'participant')
    expect(guest).toContain('Cooperative:read')
    expect(guest).not.toContain('Account:read:own')
    const own = await deskGrants(tokens[member.account], 'participant')
    for (const grant of ['Cooperative:read', 'Account:read:own', 'Wallet:read:own', 'Document:read:own', 'Payment:read:own', 'Meet:read'])
      expect(own, grant).toContain(grant)
  })

  it(caseName('core.acc.happy.07', 'стол председателя получает права ядра и права своего расширения'), async () => {
    const grants = await deskGrants(tokens[CHAIRMAN.account], 'chairman')
    for (const grant of ['System:manage', 'Extension:manage', 'Branch:manage', 'Account:update', 'Approval:confirm', 'ChairmanOnboarding:manage'])
      expect(grants, grant).toContain(grant)
  })

  it(caseName('core.acc.side.10', 'страницы стола председателя члену совета и пайщику закрыты'), async () => {
    for (const who of [COUNCIL, member]) {
      const grants = await deskGrants(tokens[who.account], 'chairman')
      for (const grant of ['System:manage', 'Extension:manage', 'Branch:manage', 'Account:update', 'Approval:confirm'])
        expect(grants, `${who.account}: ${grant}`).not.toContain(grant)
    }
  })
})
