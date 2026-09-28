/**
 * Стенд собран так, как тесты его ожидают: каждая роль из каталога входит и
 * получает ту роль платформы, на которую рассчитывают проверки прав. Если
 * засев или boot поменяют состав, упадёт здесь, а не россыпью по доменам.
 */
import { describe, expect, it } from 'vitest'
import { CHAIRMAN, COUNCIL, ROLES, freshMember, gql, gqlError, login, tokenOf } from '../core'

const ACCOUNT_ROLE = `query($d:GetAccountInput!){ getAccount(data:$d){ username provider_account{ role } } }`

async function platformRole(token: string, username: string): Promise<string | null> {
  const d = await gql<any>(token, ACCOUNT_ROLE, { d: { username } })
  return d.getAccount?.provider_account?.role ?? null
}

describe('стенд: роли каталога', () => {
  it('председатель кооператива входит с ролью chairman', async () => {
    const token = await tokenOf(CHAIRMAN)
    expect(await platformRole(token, CHAIRMAN.account)).toBe('chairman')
  })

  it('член совета входит с ролью member', async () => {
    const token = await tokenOf(COUNCIL)
    expect(await platformRole(token, COUNCIL.account)).toBe('member')
  })

  for (const name of ['member', 'otherMember', 'supplier', 'branchChairman', 'foreignBranchChairman'] as const) {
    it(`${name} — обычный пайщик платформы (role=user)`, async () => {
      const who = ROLES[name]()
      const token = await tokenOf(who)
      expect(await platformRole(token, who.account)).toBe('user')
    })
  }

  it('гость без токена не получает чужой аккаунт', async () => {
    const err = await gqlError(null, ACCOUNT_ROLE, { d: { username: CHAIRMAN.account } })
    expect(err).not.toBeNull()
  })

  it('свежий пайщик из фабрики входит своим ключом', async () => {
    const who = freshMember({ prefix: 'stand' })
    const token = await login(who)
    expect(await platformRole(token, who.account)).toBe('user')
  })
})
