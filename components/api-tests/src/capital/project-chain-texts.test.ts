/**
 * Тексты проекта Благороста живут в базе, в цепи — их хеш (реестр
 * capital.project-chain-texts; решение владельца: описание в цепи не храним).
 *
 * Индексер отдаёт хеш из строки цепи заглавными буквами, а узел узнавал хеш
 * только в нижнем регистре: любое действие цепи над проектом (назначение
 * мастера, запуск) приносило дельту, и хеш записывался в базу вместо описания
 * и приглашения (25.09.2026, C28-80).
 */
import { describe, expect, it } from 'vitest'
import { CHAIRMAN, caseName, gql, tokenOf, waitFor } from '../core'

import { capitalMember, clearance, ensureCapitalProgram, setMasterInChain, startProject } from './cap-results.helpers'
import { createChainProject } from './cap-access.helpers'

const PROJECT = 'query($d:GetProjectInput!){ capitalProject(data:$d){ description invite status } }'

describe('Благорост: тексты проекта переживают действия цепи', () => {
  it(caseName('cap.texts.side.01', 'мастер назначен и проект запущен в цепи — описание и приглашение в базе прежние'), async () => {
    await ensureCapitalProgram()
    const master = await capitalMember('ctx')
    const description = `Описание проекта внешнего слоя ${Date.now().toString(36)}`
    const invite = 'Приглашаем разработчиков и аналитиков'
    const hash = await createChainProject(`Проект с текстами ${Date.now().toString(36)}`, { description, invite })

    // Мастером назначается участник проекта — сначала допуск.
    await clearance(master, hash)
    await setMasterInChain(hash, master)
    await startProject(hash)
    const chair = await tokenOf(CHAIRMAN)
    const p = await waitFor(async () => {
      const d = await gql<any>(chair, PROJECT, { d: { hash } })
      return d.capitalProject?.status === 'ACTIVE' ? d.capitalProject : null
    }, { timeoutMs: 60_000, intervalMs: 1_000, label: 'запуск проекта в зеркале' })

    expect(p.description).toBe(description)
    expect(p.invite).toBe(invite)
  })
})
