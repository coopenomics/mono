/** ВРЕМЕННЫЙ ЗОНД (coopid-a): печатает ответы, в сдаваемую ветку не идёт. */
import crypto from 'node:crypto'
import { expect, it } from 'vitest'
import { ROLES, freshMember, tokenOf } from '../core'
import { BRANCH, certificateLevels, photo, reviewsOf, verifyOnsite } from './coopid-a.helpers'

it('зонд: снимок не-изображение и больше 10 МБ на сверке участка', async () => {
  const token = await tokenOf(ROLES.branchChairman())
  for (const [label, shot] of [
    ['text/plain', photo({ mime_type: 'text/plain' })],
    ['11MB', (() => { const b = Buffer.alloc(11 * 1024 * 1024, 7); const c = crypto.createHash('sha256').update(b).digest('hex'); return { content_base64: b.toString('base64'), mime_type: 'image/png', size_bytes: b.byteLength, checksum_sha256: c } })()],
  ] as const) {
    const who = freshMember({ prefix: 'czp' })
    const r = await verifyOnsite(token, who.account, { braname: BRANCH, photos: [shot as any] })
    console.log(`PROBE ${label}: response=${JSON.stringify({ data: r.data, errors: r.errors }).slice(0, 600)}`)
    console.log(`PROBE ${label}: reviews=${JSON.stringify(await reviewsOf(who.account))}`)
    console.log(`PROBE ${label}: levels=${JSON.stringify(await certificateLevels(who))}`)
  }
  expect(true).toBe(true)
})
