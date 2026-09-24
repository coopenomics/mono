/**
 * Планировщик энергии участников Благороста (реестр capital.gamification).
 *
 * Контроллер по расписанию зовёт действие цепи, которое пересчитывает
 * затухание энергии и отмечает время обновления. На стенде (NODE_ENV
 * development) расписание — раз в минуту, в работе — раз в сутки. Действие
 * цепи требует активного договора УХД.
 *
 * Участник регистрируется через API, как с рабочего стола (карточку в базе
 * заводит контроллер), договор одобряется ключом кооператива в цепи, как сид.
 * Проверяемое — время обновления энергии в карточке участника.
 */
import { describe, expect, it } from 'vitest'
import { CHAIRMAN, caseName, freshMember, gql, tokenOf, waitFor } from '../core'
import { COOP } from '../core/env'
import { approveContributor, ensureCapitalInitialized, registerContributorViaApi } from './cap-metrics.helpers'

const CONTRIBUTOR = 'query($d:GetContributorInput!){ capitalContributor(data:$d){ username coopname blockchain_status energy last_energy_update } }'

describe('Благорост — ежесуточное обновление энергии участников', () => {
  it(caseName('cap.gam.happy.02', 'планировщик обновляет энергию участника с активным договором УХД'), async () => {
    await ensureCapitalInitialized()
    const chairman = await tokenOf(CHAIRMAN)
    const who = freshMember({ prefix: 'capgam' })
    const contributorHash = await registerContributorViaApi(who)
    await approveContributor(contributorHash)

    // Одобрение шло в цепь мимо контроллера — ждём, пока участник появится в
    // зеркале активным: планировщик берёт участников из базы контроллера.
    const active = await waitFor(async () => {
      const d = await gql<any>(chairman, CONTRIBUTOR, { d: { username: who.account } })
      return d.capitalContributor?.blockchain_status === 'active' ? d.capitalContributor : null
    }, { timeoutMs: 60_000, label: `участник ${who.account} активен в зеркале` })
    expect(active.coopname).toBe(COOP)
    const registeredAt = Date.parse(active.last_energy_update)
    expect(Number.isFinite(registeredAt), 'у участника есть время обновления энергии').toBe(true)

    // Следующий тик расписания (раз в минуту на стенде) обязан обновить его.
    const refreshed = await waitFor(async () => {
      const d = await gql<any>(chairman, CONTRIBUTOR, { d: { username: who.account } })
      const at = Date.parse(d.capitalContributor?.last_energy_update ?? '')
      return at > registeredAt ? d.capitalContributor : null
    }, { timeoutMs: 180_000, intervalMs: 5_000, label: `планировщик обновил энергию ${who.account}` })
    expect(Date.parse(refreshed.last_energy_update)).toBeGreaterThan(registeredAt)
  })
})
