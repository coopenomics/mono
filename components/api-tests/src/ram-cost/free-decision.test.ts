/**
 * Оперативная память цепи: свободное решение совета от проекта до исполнения.
 *
 * Путь рабочего стола: председатель заводит проект решения, подписывает и
 * публикует его — вопрос встаёт на повестку совета; члены совета голосуют;
 * председатель подписывает протокол, контроллер утверждает и исполняет
 * решение одной транзакцией (`soviet::authorize` + `soviet::exec`), строка
 * решения стирается из памяти цепи.
 */
import { afterAll, describe, expect, it } from 'vitest'
import { tokenOf } from '../core/auth'
import { gql } from '../core/client'
import { signDocument } from '../core/documents'
import { COOP } from '../core/env'
import { CHAIRMAN } from '../core/roles'
import { waitFor } from '../core/wait'
import { agendaAll, agendaByHash, authorizeFreeDecision, vote } from '../documents/docs-reports.helpers'
import { ProcessMeter, RAM_COST_ON } from './ram-cost.helpers'

const pm = new ProcessMeter('free-decision', 'свободное решение совета (от проекта до исполнения)', {
  project: { title: 'Проект решения заведён', awaits: 'подписи и публикации председателем' },
  published: { title: 'Вопрос на повестке совета', awaits: 'голосов членов совета' },
  voted: { title: 'Совет проголосовал', awaits: 'подписи протокола председателем' },
  executed: { title: 'Решение утверждено и исполнено', awaits: '—' },
}, {
  // Допущения: повестка стоит до заседания совета неделю, протокол — сутки.
  published: 7,
  voted: 1,
})

describe.runIf(RAM_COST_ON)('оперативная память: свободное решение совета', () => {
  afterAll(() => pm.finish(), 120_000)

  it('решение проходит путь до исполнения, память снимается на каждом этапе', async () => {
    const token = await tokenOf(CHAIRMAN)
    await pm.start()

    const created = await gql<any>(token, 'mutation($d:CreateProjectFreeDecisionInput!){ createProjectOfFreeDecision(data:$d){ id } }', {
      d: { question: `Замер памяти: свободное решение ${Date.now()}`, decision: 'Принять к сведению результаты замера' },
    })
    const projectId = created.createProjectOfFreeDecision.id as string
    await pm.mark('project')

    const before = new Set((await agendaAll(token)).map(a => a.id))
    const generated = await gql<any>(token, 'mutation($d:ProjectFreeDecisionGenerateDocumentInput!){ generateProjectOfFreeDecision(data:$d){ full_title html hash meta binary } }', {
      d: { coopname: COOP, project_id: projectId, username: CHAIRMAN.account },
    })
    const signed = await signDocument(CHAIRMAN.wif, generated.generateProjectOfFreeDecision, CHAIRMAN.account, 1)
    await gql(token, 'mutation($d:PublishProjectFreeDecisionInput!){ publishProjectOfFreeDecision(data:$d){ __typename } }', {
      d: { coopname: COOP, username: CHAIRMAN.account, meta: '', document: signed },
    })
    const row = await waitFor(async () => (await agendaAll(token)).find(a => !before.has(a.id)) ?? null, { timeoutMs: 60_000, label: 'вопрос свободного решения на повестке' })
    await pm.mark('published')

    const decision = await waitFor(() => agendaByHash(token, row.hash), { label: `решение ${row.id} в повестке` })
    await vote(decision, 'for')
    await pm.mark('voted')

    await authorizeFreeDecision(decision)
    await waitFor(async () => ((await agendaAll(token)).some(a => a.id === row.id) ? null : true), { timeoutMs: 120_000, label: `решение ${row.id} исполнено и снято с повестки` })
    await pm.mark('executed')

    expect(pm.passed()).toEqual(['before', 'project', 'published', 'voted', 'executed'])
  }, 900_000)
})
