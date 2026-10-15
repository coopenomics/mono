/**
 * Транскрипции звонков «Чата кооператива» (chatcoop_call_transcriptions,
 * chatcoop_transcription_segments).
 *
 * Записи создаёт вебхук сервера звонков (LiveKit), доступ к ним даёт реестр
 * комнат Matrix; на стенде комнату совета и запись звонка заводит сид.
 * Проверяется чтение записи советом, заметка, отказ пайщику вне совета и
 * ответы без комнат.
 */
import crypto from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { COUNCIL, ROLES, caseName, freshMember, gql, gqlError, tokenOf } from '../core'
import { seedRoom, seedTranscription, tag, transcriptionAs, transcriptionsAs, updateMemoAs } from '../capital/cap-access.helpers'

const LIST = `query($d:GetTranscriptionsInput){ chatcoopGetTranscriptions(data:$d){ id roomId memo } }`
const ONE = `query($d:GetTranscriptionInput!){ chatcoopGetTranscription(data:$d){ transcription{ id } segments{ text } } }`
const MEMO = `mutation($d:UpdateCallTranscriptionMemoInput!){ chatcoopUpdateTranscriptionMemo(data:$d){ id memo } }`

describe('chatcoop: транскрипции звонков', () => {
  let me: Who
  let mine: string
  let member: string

  beforeAll(async () => {
    me = freshMember({ prefix: 'chat' })
    mine = await tokenOf(me)
    member = await tokenOf(ROLES.member())
  })

  it(caseName('chat.tr.happy.01', 'пайщику без доступных комнат список транскрипций пуст'), async () => {
    const d = await gql<any>(mine, LIST, { d: { limit: 20, offset: 0 } })
    expect(d.chatcoopGetTranscriptions).toEqual([])
  })

  it(caseName('chat.tr.side.01', 'транскрипция комнаты вне реестра — отказ в доступе к комнате'), async () => {
    const err = await gqlError(member, LIST, { d: { matrixRoomId: `!nosuchroom${crypto.randomBytes(4).toString('hex')}:matrix.local` } })
    expect(err?.code).toBe('CHATCOOP_ROOM_ACCESS_DENIED')
  })

  it(caseName('chat.tr.side.02', 'несуществующая транскрипция: чтение — пусто, заметка — «не найдена»'), async () => {
    const id = crypto.randomUUID()
    const one = await gql<any>(member, ONE, { d: { id } })
    expect(one.chatcoopGetTranscription).toBeNull()
    const err = await gqlError(member, MEMO, { d: { id, memo: 'Итоги звонка' } })
    expect(err?.code).toBe('CHATCOOP_TRANSCRIPTION_NOT_FOUND')
  })

  it(caseName('chat.tr.side.03', 'гость не читает транскрипции и не правит заметки'), async () => {
    expect(String((await gqlError(null, LIST, { d: null }))?.code)).toBe('401')
    expect(String((await gqlError(null, MEMO, { d: { id: crypto.randomUUID(), memo: 'x' } }))?.code)).toBe('401')
  })

  it(caseName('chat.tr.happy.02', 'запись звонка в комнате совета: член совета читает её с репликами и сохраняет заметку, пайщику вне совета отказ'), async () => {
    const T = tag('tr')
    const room = seedRoom('council', null, `Совет ${T}`)
    const call = seedTranscription(room, `Решили по смете ${T}`)

    const list = await transcriptionsAs(COUNCIL, room)
    expect(list.errors).toEqual([])
    expect(list.data.chatcoopGetTranscriptions.map((t: any) => t.id)).toEqual([call])

    const one = await transcriptionAs(COUNCIL, call)
    expect(one.errors).toEqual([])
    expect(one.data.chatcoopGetTranscription.transcription.id).toBe(call)
    expect(one.data.chatcoopGetTranscription.segments.map((s: any) => s.text)).toEqual([`Решили по смете ${T}`])

    const noted = await updateMemoAs(COUNCIL, call, `Итог: смету утвердить ${T}`)
    expect(noted.errors).toEqual([])
    expect(noted.data.chatcoopUpdateTranscriptionMemo.memo).toBe(`Итог: смету утвердить ${T}`)
    expect((await transcriptionAs(COUNCIL, call)).data.chatcoopGetTranscription.transcription.memo).toBe(`Итог: смету утвердить ${T}`)

    // Пайщик вне совета: ни списка комнаты, ни записи, ни заметки.
    const outsider = ROLES.member()
    expect((await transcriptionsAs(outsider, room)).errors[0]?.code).toBe('CHATCOOP_ROOM_ACCESS_DENIED')
    expect((await transcriptionAs(outsider, call)).errors[0]?.code).toBe('CHATCOOP_ROOM_ACCESS_DENIED')
    expect((await updateMemoAs(outsider, call, 'чужая заметка')).errors[0]?.code).toBe('CHATCOOP_ROOM_ACCESS_DENIED')
    expect((await transcriptionAs(COUNCIL, call)).data.chatcoopGetTranscription.transcription.memo, 'чужой запрос заметку не изменил').toBe(`Итог: смету утвердить ${T}`)
  })
})
