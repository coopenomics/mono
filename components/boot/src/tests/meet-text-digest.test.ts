import { beforeAll, describe, expect, it } from 'vitest'
import { MeetContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { generateRandomSHA256 } from '../utils/randomHash'
import { chainTextDigest } from '../utils/chainTextDigest'
import { fakeDocument } from './shared/fakeDocument'

/**
 * Формулировки вопросов общего собрания в цепи хранятся хешем (C28-78).
 *
 * Текст вопроса, контекст и проект решения живут в базе контроллера, в
 * повестке и в таблице вопросов лежит sha256 текста или пустая строка.
 */
const blockchain = new Blockchain(config.network, config.private_keys)
const coopname = 'voskhod'
const chairman = config.provider_chairman

async function createMeet(hash: string, agenda: { title: string, context: string, decision: string }[]) {
  const now = Math.floor(Date.now() / 1000)
  const iso = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 19)
  return blockchain.api.transact(
    {
      actions: [{
        account: MeetContract.contractName.production,
        name: MeetContract.Actions.CreateMeet.actionName,
        authorization: [{ actor: coopname, permission: 'active' }],
        data: {
          coopname,
          hash,
          initiator: chairman,
          presider: chairman,
          secretary: chairman,
          agenda,
          proposal: fakeDocument,
          open_at: iso(now + 60),
          close_at: iso(now + 3600),
        },
      }],
    },
    { blocksBehind: 3, expireSeconds: 30 },
  )
}

async function questionsOf(hash: string) {
  const meets = await blockchain.getTableRows('meet', coopname, 'meets', 1, hash, hash, 2, 'sha256')
  const meetId = String(meets[0].id)
  return blockchain.getTableRows('meet', coopname, 'questions', 100, meetId, meetId, 2, 'i64')
}

beforeAll(async () => {
  await blockchain.update_pass_instance()
}, 240_000)

describe('формулировки вопросов собрания в цепи — хешем', () => {
  it('createmeet отклоняет вопрос текстом', async () => {
    await expect(createMeet(generateRandomSHA256(), [{
      title: 'Утвердить годовой отчёт',
      context: '',
      decision: chainTextDigest('Утвердить'),
    }])).rejects.toThrow(/sha256/)
  })

  it('createmeet кладёт в вопросы хеши формулировок как есть, пустой контекст остаётся пустым', async () => {
    const hash = generateRandomSHA256()
    const agenda = [
      { title: chainTextDigest('Утвердить годовой отчёт'), context: chainTextDigest('Отчёт приложен'), decision: chainTextDigest('Утвердить') },
      { title: chainTextDigest('Избрать совет'), context: '', decision: chainTextDigest('Избрать') },
    ]
    await createMeet(hash, agenda)

    const questions = await questionsOf(hash)
    expect(questions.map((q: any) => [q.number, q.title, q.context, q.decision])).toEqual([
      [1, agenda[0].title, agenda[0].context, agenda[0].decision],
      [2, agenda[1].title, '', agenda[1].decision],
    ])
  })
})
