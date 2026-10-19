/**
 * Председатель завершает онбординг кооператива (chairman.onboarding-completion).
 *
 * Отметка ложится в настройки кооператива и приходит всем в сведениях о
 * системе: по ней стол убирает пункт «Онбординг» из меню на любом устройстве.
 * Обычное изменение настроек отметку не сбрасывает. Завершить онбординг может
 * только председатель.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, ROLES, caseName, expectAuthDenied, gql, gqlError, tokenOf } from '../core'

const COMPLETE = 'mutation{ completeCooperativeOnboarding{ onboarding_completed_at } }'
const INFO = 'query{ getSystemInfo{ settings{ provider_name onboarding_completed_at } } }'
const UPDATE = 'mutation($d:UpdateSettingsInput!){ updateSettings(data:$d){ onboarding_completed_at } }'

describe('завершение онбординга кооператива', () => {
  let chairman: string
  let member: string

  beforeAll(async () => {
    chairman = await tokenOf(CHAIRMAN)
    member = await tokenOf(ROLES.member())
  }, 120_000)

  it(caseName('chair.onbfinish.break.01', 'пайщик и гость онбординг не завершают'), async () => {
    expect(await gqlError(member, COMPLETE), 'пайщику отказ').not.toBeNull()
    expectAuthDenied(await gqlError(null, COMPLETE))
  })

  it(caseName('chair.onbfinish.happy.01', 'председатель завершает онбординг — отметка видна в сведениях о системе'), async () => {
    const done = (await gql<any>(chairman, COMPLETE)).completeCooperativeOnboarding
    expect(done.onboarding_completed_at, 'отметка в ответе').toBeTruthy()
    const info = (await gql<any>(null, INFO)).getSystemInfo.settings
    expect(info.onboarding_completed_at, 'отметка в сведениях о системе').toBeTruthy()
  })

  it(caseName('chair.onbfinish.side.01', 'обычное изменение настроек отметку не сбрасывает'), async () => {
    const before = (await gql<any>(null, INFO)).getSystemInfo.settings
    const after = (await gql<any>(chairman, UPDATE, { d: { provider_name: before.provider_name } })).updateSettings
    expect(after.onboarding_completed_at).toBe(before.onboarding_completed_at)
  })
})
