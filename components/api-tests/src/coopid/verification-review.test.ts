/**
 * CoopID: фотофиксация сверки личности и проверка сверок советом
 * (test-registry/coopid.verification-review.yaml).
 *
 * Участок сверяет личность и прикладывает снимки: уровень выдаётся сразу, а
 * запись журнала ждёт решения председателя совета. Утверждение снимает только
 * снимки, отклонение ещё и отзывает уровень с цепи. Журнал ведётся офчейн
 * (coop_domain_db), потому что цепь истории не хранит: отзыв стирает запись.
 *
 * Сверка меняет состояние пайщика необратимо — каждый сценарий берёт свежего
 * пайщика и ищет в журнале только его записи.
 */
import crypto from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, COOP_SIGNER, COUNCIL, ROLES, caseName, expectAuthDenied, freshMember, gqlRaw, tokenOf, transact, type Who } from '../core'
import { APPROVE, BRANCH, REJECT, REVIEWS, REVIEW_PHOTOS, type Review, certificateLevels, identityFor, onlyReviewOf, photo, photos, reviewsOf, unverify, verifyOk, verifyOnsite } from './coopid-a.helpers'

function hasPassport(levels: { type: string }[]): boolean {
  return levels.some(l => l.type === 'passport_onsite' || l.type === 'PassportOnsite')
}

describe('coopid.verification-review: снимки сверки и решение совета', () => {
  let chairmanToken = ''
  let branchToken = ''
  let branchChairman: Who

  beforeAll(async () => {
    branchChairman = ROLES.branchChairman()
    chairmanToken = await tokenOf(CHAIRMAN)
    branchToken = await tokenOf(branchChairman)
  })

  describe('приём снимков', () => {
    let rejected: Who

    beforeAll(() => {
      rejected = freshMember({ prefix: 'crx' })
    })

    it(caseName('cid.vrev.break.01', 'сверка на участке без снимков отклоняется, цепь не тронута'), async () => {
      for (const variant of [undefined, []]) {
        const r = await verifyOnsite(branchToken, rejected.account, { braname: BRANCH, photos: variant })
        expect(r.data).toBeNull()
        expect(r.errors[0]?.code).toBe('AUTH_V2_VERIFICATION_PHOTO_REQUIRED')
      }
      expect(hasPassport(await certificateLevels(rejected))).toBe(false)
      expect(await reviewsOf(rejected.account)).toEqual([])
    })

    it(caseName('cid.vrev.break.02', 'не сходится размер или контрольная сумма — отказ до записи в цепь'), async () => {
      const good = photo()
      const wrongSize = await verifyOnsite(branchToken, rejected.account, { braname: BRANCH, photos: [{ ...good, size_bytes: good.size_bytes + 1 }] })
      expect(wrongSize.errors[0]?.code).toBe('AUTH_V2_VERIFICATION_PHOTO_SIZE_MISMATCH')

      const wrongSum = await verifyOnsite(branchToken, rejected.account, { braname: BRANCH, photos: [{ ...good, checksum_sha256: photo().checksum_sha256 }] })
      expect(wrongSum.errors[0]?.code).toBe('AUTH_V2_VERIFICATION_PHOTO_CHECKSUM_MISMATCH')

      // Один битый снимок среди целых роняет всю сверку.
      const oneBad = await verifyOnsite(branchToken, rejected.account, { braname: BRANCH, photos: [photo(), { ...good, size_bytes: 1 }] })
      expect(oneBad.errors[0]?.code).toBe('AUTH_V2_VERIFICATION_PHOTO_SIZE_MISMATCH')

      expect(hasPassport(await certificateLevels(rejected))).toBe(false)
      expect(await reviewsOf(rejected.account)).toEqual([])
      // Повод для выдачи данных не исчерпан — личность по-прежнему не подтверждена.
      expect((await identityFor(branchToken, rejected.account, BRANCH)).errors).toEqual([])
    })

    it(caseName('cid.vrev.break.03', 'больше пяти снимков к одной сверке — отказ с пределом'), async () => {
      const r = await verifyOnsite(branchToken, rejected.account, { braname: BRANCH, photos: photos(6) })
      expect(r.data).toBeNull()
      expect(r.errors[0]?.code).toBe('AUTH_V2_VERIFICATION_PHOTOS_LIMIT')
      expect(r.errors[0]?.message).toMatch(/5/)
      expect(hasPassport(await certificateLevels(rejected))).toBe(false)
      expect(await reviewsOf(rejected.account)).toEqual([])
    })

    it(caseName('cid.vrev.break.04', 'не изображение или снимок больше 10 МБ — отказ до записи в цепь, уровня без записи на проверку совета нет'), async () => {
      // До 25.09.2026 такой снимок отвергал только бакет уже после выдачи
      // уровня: уровень оставался, а записи для совета не было.
      const text = await verifyOnsite(branchToken, rejected.account, { braname: BRANCH, photos: [photo({ mime_type: 'text/plain' })] })
      expect(text.errors[0]?.code).toBe('AUTH_V2_VERIFICATION_PHOTO_MIME_NOT_ALLOWED')

      const body = crypto.randomBytes(11 * 1024 * 1024)
      const huge = photo({
        content_base64: body.toString('base64'),
        size_bytes: body.byteLength,
        checksum_sha256: crypto.createHash('sha256').update(body).digest('hex'),
      })
      const big = await verifyOnsite(branchToken, rejected.account, { braname: BRANCH, photos: [huge] })
      expect(big.errors[0]?.code).toBe('AUTH_V2_VERIFICATION_PHOTO_TOO_LARGE')

      expect(hasPassport(await certificateLevels(rejected))).toBe(false)
      expect(await reviewsOf(rejected.account)).toEqual([])
    })

    it(caseName('cid.vrev.side.01', 'сверка советом проходит без снимков и сразу утверждена'), async () => {
      const who = freshMember({ prefix: 'crc' })
      const levels = await verifyOk(chairmanToken, who.account)
      expect(hasPassport(levels)).toBe(true)

      const review = await onlyReviewOf(who.account)
      expect(review.status).toBe('Approved')
      expect(review.braname).toBe('')
      expect(review.verificator).toBe(CHAIRMAN.account)
      expect(review.photos_count).toBe(0)
      expect(review.procedure).toBe('passport')
    })
  })

  describe('решение совета', () => {
    let approved: Who
    let approvedReview: Review

    beforeAll(() => {
      approved = freshMember({ prefix: 'cra' })
    })

    it(caseName('cid.vrev.happy.01', 'участок прикладывает снимки: уровень выдан сразу, запись журнала «на проверке»'), async () => {
      const shots = photos(2)
      const levels = await verifyOk(branchToken, approved.account, { braname: BRANCH, photos: shots })
      expect(hasPassport(levels), 'уровень выдан, не дожидаясь совета').toBe(true)

      approvedReview = await onlyReviewOf(approved.account)
      expect(approvedReview.status).toBe('Pending')
      expect(approvedReview.braname).toBe(BRANCH)
      expect(approvedReview.verificator).toBe(branchChairman.account)
      expect(approvedReview.photos_count).toBe(2)
      expect(approvedReview.decided_at).toBeNull()

      // Снимки лежат в хранилище кооператива под ключом сверки.
      const d = await gqlRaw<any>(chairmanToken, REVIEW_PHOTOS, { d: { review_id: approvedReview.id } })
      expect(d.errors).toEqual([])
      const stored = d.data.verificationReviewPhotos as any[]
      expect(stored).toHaveLength(2)
      for (const shot of shots) {
        const s = stored.find(p => p.storage_key.includes(shot.checksum_sha256))
        expect(s, `снимок ${shot.checksum_sha256}`).toBeTruthy()
        expect(s.storage_key).toBe(`${COOP}/verification/${approvedReview.id}/${shot.checksum_sha256}.png`)
        expect(s.mime_type).toBe('image/png')
        expect(s.size_bytes).toBe(shot.size_bytes)
        expect(s.read_url).toBeTruthy()
      }
    })

    it(caseName('cid.vrev.happy.02', 'председатель утверждает сверку: снимки сняты, статус «подтверждена», уровень на месте'), async () => {
      const r = await gqlRaw<any>(chairmanToken, APPROVE, { d: { review_id: approvedReview.id } })
      expect(r.errors).toEqual([])
      const decided = r.data.approveVerification as Review
      expect(decided.id).toBe(approvedReview.id)
      expect(decided.status).toBe('Approved')
      expect(decided.decided_by).toBe(CHAIRMAN.account)
      expect(decided.decided_at).toBeTruthy()
      expect(decided.photos_count).toBe(0)

      expect(await onlyReviewOf(approved.account)).toMatchObject({ status: 'Approved', photos_count: 0, decided_by: CHAIRMAN.account })
      expect(hasPassport(await certificateLevels(approved)), 'цепь не тронута — уровень остался').toBe(true)
    })

    it(caseName('cid.vrev.break.07', 'снимки решённой сверки не выдаются'), async () => {
      const r = await gqlRaw(chairmanToken, REVIEW_PHOTOS, { d: { review_id: approvedReview.id } })
      expect(r.data).toBeNull()
      expect(r.errors[0]?.code).toBe('AUTH_V2_VERIFICATION_ALREADY_DECIDED')
    })

    it(caseName('cid.vrev.break.05', 'повторное решение по закрытой сверке отклоняется, состояние прежнее'), async () => {
      const again = await gqlRaw(chairmanToken, APPROVE, { d: { review_id: approvedReview.id } })
      expect(again.errors[0]?.code).toBe('AUTH_V2_VERIFICATION_ALREADY_DECIDED')
      const reject = await gqlRaw(chairmanToken, REJECT, { d: { review_id: approvedReview.id, reason: 'поздно' } })
      expect(reject.errors[0]?.code).toBe('AUTH_V2_VERIFICATION_ALREADY_DECIDED')

      const review = await onlyReviewOf(approved.account)
      expect(review.status).toBe('Approved')
      expect(review.decision_reason).toBeNull()
      expect(hasPassport(await certificateLevels(approved))).toBe(true)
    })

    it(caseName('cid.vrev.happy.03', 'председатель отклоняет сверку с причиной: уровень отозван с цепи, снимки сняты'), async () => {
      const who = freshMember({ prefix: 'crj' })
      await verifyOk(branchToken, who.account, { braname: BRANCH, photos: [photo()] })
      const pending = await onlyReviewOf(who.account)
      expect(pending.status).toBe('Pending')

      const reason = 'на снимке другой человек'
      const r = await gqlRaw<any>(chairmanToken, REJECT, { d: { review_id: pending.id, reason } })
      expect(r.errors).toEqual([])
      expect(r.data.rejectVerification).toMatchObject({ id: pending.id, status: 'Rejected', decision_reason: reason, decided_by: CHAIRMAN.account, photos_count: 0 })

      expect(await onlyReviewOf(who.account)).toMatchObject({ status: 'Rejected', decision_reason: reason, photos_count: 0 })
      expect(hasPassport(await certificateLevels(who)), 'верификация отозвана').toBe(false)
      // Выдача снова закрыта: участок может сверить личность заново.
      expect((await identityFor(branchToken, who.account, BRANCH)).errors).toEqual([])

      const again = await gqlRaw(chairmanToken, APPROVE, { d: { review_id: pending.id } })
      expect(again.errors[0]?.code, 'cid.vrev.break.05: решение по отклонённой сверке').toBe('AUTH_V2_VERIFICATION_ALREADY_DECIDED')
      expect((await onlyReviewOf(who.account)).status).toBe('Rejected')
    })
  })

  describe('журнал и снимки видит только председатель совета', () => {
    let who: Who
    let review: Review

    beforeAll(async () => {
      who = freshMember({ prefix: 'crp' })
      await verifyOk(branchToken, who.account, { braname: BRANCH, photos: [photo()] })
      review = await onlyReviewOf(who.account)
    })

    it(caseName('cid.vrev.break.06', 'оператор участка, пайщик и член совета получают отказ на всех четырёх входах'), async () => {
      for (const actor of [branchChairman, ROLES.member(), COUNCIL]) {
        const token = await tokenOf(actor)
        const calls = [
          gqlRaw(token, REVIEWS, { d: { username: who.account } }),
          gqlRaw(token, REVIEW_PHOTOS, { d: { review_id: review.id } }),
          gqlRaw(token, APPROVE, { d: { review_id: review.id } }),
          gqlRaw(token, REJECT, { d: { review_id: review.id, reason: 'не моё' } }),
        ]
        for (const [i, r] of (await Promise.all(calls)).entries()) {
          expect(r.data, `${actor.account} вход ${i}`).toBeNull()
          expect(r.errors[0]?.code, `${actor.account} вход ${i}`).toBe('AUTH_V2_VERIFICATION_REVIEW_CHAIRMAN_ONLY')
        }
      }
      expect(await onlyReviewOf(who.account)).toMatchObject({ status: 'Pending', photos_count: 1 })
      expect(hasPassport(await certificateLevels(who))).toBe(true)
    })

    it(caseName('cid.vrev.break.06', 'гость получает отказ по входу'), async () => {
      const r = await gqlRaw(null, REVIEWS, { d: { username: who.account } })
      expect(r.data).toBeNull()
      expectAuthDenied(r.errors[0] ?? null)
    })

    it(caseName('cid.vrev.break.08', 'решение возвращает записанную строку журнала целиком'), async () => {
      const reason = 'снимок нечитаем'
      const r = await gqlRaw<any>(chairmanToken, REJECT, { d: { review_id: review.id, reason } })
      expect(r.errors).toEqual([])
      const row = r.data.rejectVerification as Review
      expect(row).toMatchObject({
        id: review.id,
        username: who.account,
        procedure: 'passport',
        braname: BRANCH,
        verificator: branchChairman.account,
        status: 'Rejected',
        decided_by: CHAIRMAN.account,
        decision_reason: reason,
        photos_count: 0,
      })
      expect(row.created_at).toBe(review.created_at)
      expect(row.decided_at).toBeTruthy()
    })
  })

  describe('отзыв верификации в журнале', () => {
    it(caseName('cid.vrev.happy.04', 'отзыв из реестра отмечает последнюю запись журнала отозванной с автором'), async () => {
      const who = freshMember({ prefix: 'crv' })
      await verifyOk(branchToken, who.account, { braname: BRANCH, photos: [photo()] })
      const pending = await onlyReviewOf(who.account)

      const r = await unverify(chairmanToken, who.account)
      expect(r.errors).toEqual([])
      expect(hasPassport(r.data!.unverifyParticipant)).toBe(false)

      const revoked = await onlyReviewOf(who.account)
      expect(revoked.id).toBe(pending.id)
      expect(revoked.status).toBe('Revoked')
      expect(revoked.decided_by).toBe(CHAIRMAN.account)
      expect(revoked.decided_at).toBeTruthy()
      expect(revoked.photos_count).toBe(0)
    })

    it(caseName('cid.vrev.side.04', 'отзыв по пайщику с уже отклонённой сверкой журнал не переписывает'), async () => {
      const who = freshMember({ prefix: 'crs' })
      await verifyOk(branchToken, who.account, { braname: BRANCH, photos: [photo()] })
      const pending = await onlyReviewOf(who.account)
      const reason = 'паспорт не совпал'
      await gqlRaw(chairmanToken, REJECT, { d: { review_id: pending.id, reason } })
      const before = await onlyReviewOf(who.account)
      expect(before.status).toBe('Rejected')

      // Верификация снова в цепи, но мимо журнала: действие подписывает сам
      // кооператив от имени председателя, как это сделал бы рабочий стол.
      await transact(COOP_SIGNER, [{
        account: 'registrator',
        name: 'verifyacc',
        data: { coopname: COOP, braname: '', verificator: CHAIRMAN.account, username: who.account, procedure: 'passport' },
      }])

      const r = await unverify(chairmanToken, who.account)
      expect(r.errors).toEqual([])
      expect(hasPassport(r.data!.unverifyParticipant)).toBe(false)

      const after = await reviewsOf(who.account)
      expect(after).toHaveLength(1)
      expect(after[0]).toEqual(before)
    })
  })
})
