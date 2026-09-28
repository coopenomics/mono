/**
 * Допуск к проекту Благороста, поданный в цепь мимо API (реестр
 * capital.clearance): заявка capital::getclearance и одобрение председателя
 * идут подряд, часто в одном блоке.
 *
 * Строка приложения в цепи тогда создаётся и закрывается внутри блока, дельты
 * по ней нет, и до 25.09.2026 узел не узнавал о допуске вовсе: одобрение
 * писало в журнал «Приложение … не найдено для одобрения», а у пайщика не
 * было допуска к проекту (C28-80).
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { caseName, waitFor } from '../core'
import { approveAsChairman, projectAs, requestClearance } from './cap-access.helpers'
import { capitalMember, clearance, createProject, ensureCapitalProgram } from './cap-results.helpers'

let member: Who
let project = ''

describe('Благорост: допуск, поданный в цепь мимо API', () => {
  beforeAll(async () => {
    await ensureCapitalProgram()
    member = await capitalMember('clr')
    project = await createProject(`Проект допуска ${Date.now().toString(36)}`)
  })

  it(caseName('cap.clr.side.01', 'заявка и одобрение подряд — у пайщика подтверждённый допуск к проекту'), async () => {
    await clearance(member, project)
    const p = await waitFor(async () => {
      const seen = await projectAs(member, project)
      return seen?.permissions.has_clearance ? seen : null
    }, { timeoutMs: 60_000, intervalMs: 1_000, label: 'подтверждённый допуск в зеркале' })
    expect(p.permissions.pending_clearance).toBe(false)
  })

  it(caseName('cap.clr.side.02', 'заявка пришла дельтой и ждёт решения — одобрение позже подтверждает ту же строку'), async () => {
    const later = await createProject(`Проект допуска с ожиданием ${Date.now().toString(36)}`)
    const appendixHash = await requestClearance(member, later)
    await waitFor(async () => ((await projectAs(member, later))?.permissions.pending_clearance ? true : null),
      { timeoutMs: 60_000, intervalMs: 1_000, label: 'заявка на допуск ждёт решения' })

    await approveAsChairman(appendixHash)
    const p = await waitFor(async () => {
      const seen = await projectAs(member, later)
      return seen?.permissions.has_clearance ? seen : null
    }, { timeoutMs: 60_000, intervalMs: 1_000, label: 'подтверждённый допуск в зеркале' })
    expect(p.permissions.pending_clearance).toBe(false)
  })
})
