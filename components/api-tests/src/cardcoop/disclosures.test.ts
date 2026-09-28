/**
 * Выдача анкеты по гранту card.coop (cardcoop.disclosures) — снаружи.
 *
 * Ручка раскрытия — REST, без ключа доступа: предъявителя опознаёт грант,
 * подписанный card.coop. Ключи card.coop (JWKS) на стенде взять неоткуда,
 * поэтому выдача анкеты и различение причин отказа здесь непроверяемы. Проверяемо
 * главное свойство двери снаружи: что бы ни предъявили, отказ один и тот же и
 * причины не выдаёт.
 */
import crypto from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, caseName, tokenOf } from '../core'
import { DISCLOSURE_URL, isolateFromNetwork, postJson } from './cardcoop-card.helpers'

const REJECTED = 'CARDCOOP_DISCLOSURE_GRANT_REJECTED'

/** Грант в формате card.coop (compact JWS, ES256K), подписанный посторонним ключом. */
function grant(claims: Record<string, unknown>): string {
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'secp256k1' })
  const head = Buffer.from(JSON.stringify({ alg: 'ES256K', typ: 'cardcoop-grant+jws', kid: crypto.randomUUID() })).toString('base64url')
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url')
  const signature = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')
  return `${head}.${body}.${signature}`
}

function claims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000)
  return {
    iss: 'card.coop',
    sub: crypto.randomUUID(),
    aud: 'othercoop',
    from: COOP,
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + 300,
    ...overrides,
  }
}

describe('карта кооператора: выдача анкеты по гранту', () => {
  beforeAll(async () => {
    // Ключи грантов расширение читает с адреса сети — он не должен вести на боевой card.coop.
    await isolateFromNetwork(await tokenOf(CHAIRMAN))
  })

  it(caseName('cc.disclose.break.08', 'запрос без гранта — отказ с кодом двери'), async () => {
    const r = await postJson(DISCLOSURE_URL, {})
    expect(r.status).toBe(403)
    expect(r.body.code).toBe(REJECTED)
  })

  it(caseName('cc.disclose.break.07', 'разные причины отказа снаружи выглядят одним и тем же ответом'), async () => {
    const now = Math.floor(Date.now() / 1000)
    const attempts = {
      'без гранта': {},
      'не разбирается': { grant: 'not-a-grant' },
      'просрочен': { grant: grant(claims({ iat: now - 3600, exp: now - 600 })) },
      'на анкету другого кооператива': { grant: grant(claims({ from: 'othercoop', aud: COOP })) },
      'нет членства по карте, ключей сети нет': { grant: grant(claims()) },
      'внутренняя неполадка (грант не строкой)': { grant: 12345 },
    }

    const answers: Record<string, unknown> = {}
    for (const [why, body] of Object.entries(attempts)) {
      const r = await postJson(DISCLOSURE_URL, body)
      expect(r.status, why).toBe(403)
      expect(r.body.code, why).toBe(REJECTED)
      answers[why] = r.body
    }

    const [first, ...rest] = Object.values(answers)
    for (const other of rest)
      expect(other).toEqual(first)
  })
})
