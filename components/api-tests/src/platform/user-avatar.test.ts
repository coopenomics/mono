/**
 * Фотография пайщика снаружи (test-registry/platform.user-avatar.yaml).
 *
 * Пайщик загружает снимок сам; узел хранит ключ файла по его содержимому и
 * отдаёт наружу ссылку. Тот же снимок повторно — тот же файл; другой снимок
 * заменяет прежний; снятие очищает ссылку.
 */
import crypto from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, caseName, expectAuthDenied, expectCode, freshMember, gql, gqlError, login, tokenOf } from '../core'

const UPLOAD = 'mutation($d:UploadAvatarInput!){ uploadAvatar(data:$d) }'
const REMOVE = 'mutation{ removeAvatar }'
const ACCOUNT = 'query($d:GetAccountInput!){ getAccount(data:$d){ avatar_url } }'

/** Заголовок PNG и случайный хвост: содержимое у каждого снимка своё. */
function png(): string {
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), crypto.randomBytes(256)]).toString('base64')
}

/** Ссылка без подписи и срока — сам файл в хранилище. */
function fileOf(url: string): string {
  return url.split('?')[0]
}

describe('фотография пайщика', () => {
  let member: Who
  let token = ''
  let plain: Who
  let first = ''
  let firstUrl = ''

  const avatarOf = async (who: Who, t = token): Promise<string | null> =>
    (await gql<any>(t, ACCOUNT, { d: { username: who.account } })).getAccount.avatar_url

  beforeAll(async () => {
    member = freshMember({ prefix: 'avat' })
    token = await login(member)
    plain = freshMember({ prefix: 'avan' })
  }, 300_000)

  it(caseName('avatar.happy.01', 'пайщик загружает фотографию — в аккаунте появляется ссылка на файл, названный по содержимому'), async () => {
    expect(await avatarOf(member)).toBeNull()
    first = png()
    firstUrl = (await gql<any>(token, UPLOAD, { d: { content_base64: first, mime_type: 'image/png' } })).uploadAvatar
    expect(firstUrl).toBeTruthy()
    const sha = crypto.createHash('sha256').update(Buffer.from(first, 'base64')).digest('hex')
    expect(fileOf(firstUrl)).toContain(`avatars/${member.account}/${sha}.png`)
    expect(fileOf((await avatarOf(member))!)).toBe(fileOf(firstUrl))
    expectAuthDenied(await gqlError(null, UPLOAD, { d: { content_base64: first, mime_type: 'image/png' } }))
  })

  it(caseName('avatar.side.01', 'тот же снимок повторно — тот же файл; другой снимок заменяет прежний'), async () => {
    const again = (await gql<any>(token, UPLOAD, { d: { content_base64: first, mime_type: 'image/png' } })).uploadAvatar
    expect(fileOf(again)).toBe(fileOf(firstUrl))

    const second = png()
    const replaced = (await gql<any>(token, UPLOAD, { d: { content_base64: second, mime_type: 'image/png' } })).uploadAvatar
    expect(fileOf(replaced)).not.toBe(fileOf(firstUrl))
    expect(fileOf((await avatarOf(member))!)).toBe(fileOf(replaced))
  })

  it(caseName('avatar.break.01', 'файл чужого типа, пустой файл и файл больше пяти мегабайт отклоняются'), async () => {
    const before = await avatarOf(member)
    // Чужой тип и пустой файл отклоняет проверка входных данных.
    const wrongType = await gqlError(token, UPLOAD, { d: { content_base64: png(), mime_type: 'application/pdf' } })
    expectCode(wrongType, '422')
    expect(wrongType!.message).toMatch(/JPEG, PNG или WEBP/)
    expectCode(await gqlError(token, UPLOAD, { d: { content_base64: '', mime_type: 'image/png' } }), '422')
    const huge = crypto.randomBytes(5 * 1024 * 1024 + 1024).toString('base64')
    const tooLarge = await gqlError(token, UPLOAD, { d: { content_base64: huge, mime_type: 'image/png' } })
    expect(tooLarge, 'снимок больше пяти мегабайт отклонён').not.toBeNull()
    expect(['ACCOUNT_AVATAR_TOO_LARGE', '413', 'NON_JSON']).toContain(String(tooLarge!.code))
    expect(fileOf((await avatarOf(member))!), 'прежняя фотография на месте').toBe(fileOf(before!))
  })

  it(caseName('avatar.side.03', 'ссылку на фотографию видят другие; у пайщика без фотографии её нет'), async () => {
    const chairman = await tokenOf(CHAIRMAN)
    expect(fileOf((await avatarOf(member, chairman))!)).toBe(fileOf((await avatarOf(member))!))
    expect(await avatarOf(plain, chairman)).toBeNull()
    expect(await avatarOf(plain, await login(plain))).toBeNull()
  })

  it(caseName('avatar.break.03', 'снятие фотографии очищает ссылку в аккаунте; новая загрузка возвращает её'), async () => {
    expect((await gql<any>(token, REMOVE)).removeAvatar).toBe(true)
    expect(await avatarOf(member)).toBeNull()
    expect(await avatarOf(member, await tokenOf(CHAIRMAN))).toBeNull()
    const back = (await gql<any>(token, UPLOAD, { d: { content_base64: first, mime_type: 'image/png' } })).uploadAvatar
    expect(fileOf(back)).toBe(fileOf(firstUrl))
    expect(fileOf((await avatarOf(member))!)).toBe(fileOf(firstUrl))
  })
})
