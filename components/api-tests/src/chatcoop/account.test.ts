/**
 * Статус учётной записи «Чата кооператива» (chatcoop_matrix_users): есть ли у
 * пайщика привязанная учётная запись Matrix и куда открывать клиент.
 *
 * Сервера Matrix на стенде нет: завести учётную запись и проверить имя нельзя.
 * Проверяется ответ для пайщика без учётной записи — локальный реестр пуст,
 * поиск по почте на сервере Matrix не удался, и статус честно «нет записи».
 */
import { describe, expect, it } from 'vitest'
import { caseName, freshMember, gql, gqlError, tokenOf } from '../core'

const STATUS = `query{ chatcoopGetAccountStatus{ hasAccount matrixUsername iframeUrl } }`

describe('chatcoop: учётная запись чата', () => {
  it(caseName('chat.acc.happy.01', 'у нового пайщика учётной записи чата нет — статус без имени и адреса клиента'), async () => {
    const token = await tokenOf(freshMember({ prefix: 'chat' }))
    const d = await gql<any>(token, STATUS)
    expect(d.chatcoopGetAccountStatus).toEqual({ hasAccount: false, matrixUsername: null, iframeUrl: null })
  })

  it(caseName('chat.acc.side.01', 'гость не узнаёт статус учётной записи чата'), async () => {
    expect(String((await gqlError(null, STATUS))?.code)).toBe('401')
  })
})
