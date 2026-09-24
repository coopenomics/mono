/**
 * Предложение поставщика (test-registry/marketplace.offer.yaml): границы
 * данных при создании и правке, права и статусы модерации, остаток по
 * упаковкам, уведомление администратору о новой заявке.
 *
 * Поставщик — свежий (см. offer.helpers.ts), его список предложений ведёт
 * только этот файл, поэтому «предложение не создано» проверяется сверкой его
 * списка до и после отказа.
 *
 * Где сервис защищён ещё и валидацией входа (class-validator, код 422) или
 * типом схемы GraphQL, отказ приходит от них раньше доменного правила — тест
 * принимает любой из этих отказов, но требует, чтобы предложение не
 * появилось и не изменилось.
 */
import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, ROLES, caseName, ensureShareFunds, gql, gqlError, tokenOf, waitFor } from '../core'
import {
  APPROVE_OFFER,
  CREATE_OFFER,
  REJECT_OFFER,
  REPUBLISH_OFFER,
  UPDATE_OFFER,
  WITHDRAW_OFFER,
  approve,
  availableCategoryId,
  checkoutLines,
  createOffer,
  freshSupplier,
  getOffer,
  inboxOf,
  myOffers,
  offerInput,
  type Supplier,
} from './offer.helpers'

const TAG = Date.now().toString(36)
const name = (what: string) => `АТ ${what} ${TAG}`

/** Тип уведомления «новое предложение на модерации» (@coopenomics/notifications). */
const WF_ON_MODERATION = 'novoe-predlozhenie-na-moderatsii'

const code = (e: { code: unknown } | null) => String(e?.code ?? '')

let sup: Supplier
let categoryId: number

beforeAll(async () => {
  sup = await freshSupplier('mkof')
  categoryId = await availableCategoryId(sup.token)
})

/** Отказ создания: код из допустимых, список поставщика не изменился. */
async function expectCreateRefused(input: Record<string, unknown>, codes: string[]): Promise<{ code: string, message: string }> {
  const before = (await myOffers(sup.token)).map(o => o.id).sort()
  const err = await gqlError(sup.token, CREATE_OFFER, { i: input })
  expect(err, 'создание должно быть отклонено').not.toBeNull()
  expect(codes).toContain(code(err))
  const after = (await myOffers(sup.token)).map(o => o.id).sort()
  expect(after).toEqual(before)
  return { code: code(err), message: err!.message }
}

// ── Границы данных при создании и правке ──────────────────────────────────

describe('предложение: границы данных', () => {
  it(caseName('mkt.offer.side.01', 'название из одних пробелов — отказ, предложение не создаётся'), async () => {
    await expectCreateRefused(offerInput('   ', categoryId), ['MARKETPLACE_PRODUCT_NAME_REQUIRED'])
    // Пустая строка отсекается ещё валидацией входа.
    await expectCreateRefused(offerInput('', categoryId), ['422', 'MARKETPLACE_PRODUCT_NAME_REQUIRED'])
  })

  it(caseName('mkt.offer.side.02', 'отрицательный срок годности — отказ, предложение не создаётся'), async () => {
    await expectCreateRefused(offerInput(name('срок'), categoryId, { shelf_life_days: -1 }), ['422', 'MARKETPLACE_SHELF_LIFE_NEGATIVE'])
  })

  it(caseName('mkt.offer.side.03', 'цена с пятью знаками после запятой — отказ'), async () => {
    await expectCreateRefused(offerInput(name('цена'), categoryId, { price_per_unit: '10.12345' }), ['422', 'MARKETPLACE_PRICE_PRECISION_INVALID'])
  })

  it(caseName('mkt.offer.side.04', 'нет ни количества, ни признака «без ограничения» — отказ'), async () => {
    await expectCreateRefused(
      offerInput(name('остаток'), categoryId, { quantity_available: null, unlimited_flag: false }),
      ['MARKETPLACE_OFFER_QUANTITY_REQUIRED'],
    )
  })

  it(caseName('mkt.offer.side.05', 'размер упаковки без стратегии «по упаковке» — отказ'), async () => {
    await expectCreateRefused(
      offerInput(name('упак-без-стратегии'), categoryId, { pack_size: 6 }),
      ['MARKETPLACE_PACKAGE_SIZE_WITHOUT_STRATEGY'],
    )
    await expectCreateRefused(
      offerInput(name('упак-по-заказу'), categoryId, { barcode_strategy: 'PER_ORDER', pack_size: 6 }),
      ['MARKETPLACE_PACKAGE_SIZE_NOT_APPLICABLE'],
    )
  })

  it(caseName('mkt.offer.side.06', 'стратегия «по упаковке» без размера упаковки — отказ'), async () => {
    await expectCreateRefused(
      offerInput(name('стратегия-без-размера'), categoryId, { barcode_strategy: 'PER_PACKAGE' }),
      ['MARKETPLACE_PACKAGE_STRATEGY_SIZE_REQUIRED'],
    )
  })

  it(caseName('mkt.offer.side.07', 'размер упаковки ноль или меньше — отказ'), async () => {
    const pkg = (size: number) => offerInput(name(`размер ${size}`), categoryId, {
      sale_form: 'PACKAGED',
      unit_of_measure: 'LITER',
      packages: [{ size, price: '50.00', package_type: 'стекло', quantity_available: 1, is_default: true }],
    })
    await expectCreateRefused(pkg(0), ['MARKETPLACE_PACKAGE_SIZE_MUST_BE_POSITIVE'])
    await expectCreateRefused(pkg(-0.5), ['422', 'MARKETPLACE_PACKAGE_SIZE_MUST_BE_POSITIVE'])
  })

  it(caseName('mkt.offer.side.08', 'отпуск упаковкой без единой упаковки — отказ'), async () => {
    await expectCreateRefused(
      offerInput(name('без-упаковок'), categoryId, { sale_form: 'PACKAGED', unit_of_measure: 'LITER', packages: [] }),
      ['MARKETPLACE_PACKAGE_LIST_REQUIRED'],
    )
  })

  it(caseName('mkt.offer.side.09', 'упаковок больше предела (12) — отказ'), async () => {
    const packages = Array.from({ length: 13 }, (_, i) => ({ size: i + 1, price: '10.00', package_type: 'пакет', quantity_available: 1 }))
    await expectCreateRefused(
      offerInput(name('много-упаковок'), categoryId, { sale_form: 'PACKAGED', unit_of_measure: 'PIECE', packages }),
      ['422', 'MARKETPLACE_PACKAGE_COUNT_LIMIT_EXCEEDED'],
    )
  })

  it(caseName('mkt.offer.side.10', 'недопустимая единица измерения — отказ'), async () => {
    const before = (await myOffers(sup.token)).length
    const err = await gqlError(sup.token, CREATE_OFFER, { i: offerInput(name('единица'), categoryId, { unit_of_measure: 'GALLON' }) })
    // Единица — перечисление схемы: чужое значение отбивает сама схема GraphQL.
    expect(err).not.toBeNull()
    expect(err!.message).toMatch(/unit_of_measure|MarketplaceUnitOfMeasure|GALLON/)
    expect((await myOffers(sup.token)).length).toBe(before)
  })

  it(caseName('mkt.offer.side.11', 'ни одной точки поставки — отказ'), async () => {
    await expectCreateRefused(offerInput(name('без-КУ'), categoryId, { delivery_points: [] }), ['MARKETPLACE_OFFER_DELIVERY_BRANCH_REQUIRED'])
  })

  it(caseName('mkt.offer.side.12', 'один участок в поставке дважды — отказ с именем участка'), async () => {
    const r = await expectCreateRefused(
      offerInput(name('КУ-дважды'), categoryId, {
        delivery_points: [{ braname: 'krg', min_supply_volume: 1 }, { braname: 'krg', min_supply_volume: 5 }],
      }),
      ['MARKETPLACE_DELIVERY_BRANCH_DUPLICATED'],
    )
    expect(r.message).toContain('krg')
  })
})

// ── Жизненный цикл: изображения, права и статусы модерации ────────────────

describe('предложение: модерация, снятие и возврат', () => {
  let offerA: any // основная карточка: на модерации → одобрена → снята
  let offerR: any // отклонённая карточка

  beforeAll(async () => {
    offerA = await createOffer(sup.token, offerInput(name('карточка А'), categoryId))
    offerR = await createOffer(sup.token, offerInput(name('карточка Р'), categoryId))
    expect(offerA.status).toBe('PENDING_MODERATION')
    expect(offerR.status).toBe('PENDING_MODERATION')
  })

  it(caseName('mkt.offer.side.25', 'новая заявка — уведомление администратору с названием, поставщиком и ссылкой на очередь'), async () => {
    const chairToken = await tokenOf(CHAIRMAN)
    // timing: backoff — уведомление доставляет фоновый обработчик очереди уведомлений
    const note = await waitFor(async () => {
      const list = await inboxOf(chairToken, WF_ON_MODERATION)
      return list.find(n => n.payload?.productName === offerA.product_name) ?? null
    }, { timeoutMs: 90_000, intervalMs: 3_000, label: 'уведомление о модерации в инбоксе председателя' })
    expect(note.payload.supplierName).toBeTruthy()
    expect(String(note.payload.deepLinkUrl)).toContain('/market-admin/moderation')
  })

  it(caseName('mkt.offer.side.13', 'изображение без содержимого — отказ при создании и при правке'), async () => {
    await expectCreateRefused(
      offerInput(name('пустое фото'), categoryId, { images: [{ mime_type: 'image/png' }] }),
      ['MARKETPLACE_OFFER_IMAGE_CONTENT_EMPTY', 'MARKETPLACE_OFFER_IMAGE_DECODE_FAILED'],
    )
    const err = await gqlError(sup.token, UPDATE_OFFER, { i: { id: offerA.id, images: [{ mime_type: 'image/png' }] } })
    expect(['MARKETPLACE_OFFER_IMAGE_CONTENT_EMPTY', 'MARKETPLACE_OFFER_IMAGE_DECODE_FAILED']).toContain(code(err))
    const after = await getOffer(sup.token, offerA.id)
    expect(after.images).toEqual(offerA.images)
    expect(after.status).toBe('PENDING_MODERATION')
  })

  it(caseName('mkt.offer.side.18', 'отклонение без причины — отказ, статус прежний'), async () => {
    const chairToken = await tokenOf(CHAIRMAN)
    expect(code(await gqlError(chairToken, REJECT_OFFER, { i: { offer_id: offerA.id, reason: '   ' } }))).toBe('MARKETPLACE_REJECT_REASON_REQUIRED')
    expect(['422', 'MARKETPLACE_REJECT_REASON_REQUIRED']).toContain(code(await gqlError(chairToken, REJECT_OFFER, { i: { offer_id: offerA.id, reason: '' } })))
    expect((await getOffer(sup.token, offerA.id)).status).toBe('PENDING_MODERATION')
  })

  it(caseName('mkt.offer.side.19', 'причина длиннее 1000 знаков — отказ, статус прежний'), async () => {
    const err = await gqlError(await tokenOf(CHAIRMAN), REJECT_OFFER, { i: { offer_id: offerA.id, reason: 'ж'.repeat(1001) } })
    expect(['422', 'MARKETPLACE_REJECT_REASON_TOO_LONG']).toContain(code(err))
    expect((await getOffer(sup.token, offerA.id)).status).toBe('PENDING_MODERATION')
  })

  it(caseName('mkt.offer.side.20', 'модерация несуществующего предложения — «не найдено»'), async () => {
    const chairToken = await tokenOf(CHAIRMAN)
    const ghost = randomUUID()
    expect(code(await gqlError(chairToken, APPROVE_OFFER, { i: { offer_id: ghost, warranty_days: 7 } }))).toBe('MARKETPLACE_OFFER_NOT_FOUND')
    expect(code(await gqlError(chairToken, REJECT_OFFER, { i: { offer_id: ghost, reason: 'нет такого' } }))).toBe('MARKETPLACE_OFFER_NOT_FOUND')
  })

  it(caseName('mkt.offer.side.21', 'гарантийный срок отрицательный или дробный — отказ, статус прежний'), async () => {
    const chairToken = await tokenOf(CHAIRMAN)
    const neg = await gqlError(chairToken, APPROVE_OFFER, { i: { offer_id: offerA.id, warranty_days: -1 } })
    expect(['422', 'MARKETPLACE_WARRANTY_DAYS_INVALID']).toContain(code(neg))
    // Дробное число не проходит тип Int схемы.
    const frac = await gqlError(chairToken, APPROVE_OFFER, { i: { offer_id: offerA.id, warranty_days: 1.5 } })
    expect(frac).not.toBeNull()
    const after = await getOffer(sup.token, offerA.id)
    expect(after.status).toBe('PENDING_MODERATION')
    expect(after.approved_at).toBeNull()
  })

  it(caseName('mkt.offer.side.22', 'модерация пайщиком без прав администратора — отказ, статус прежний'), async () => {
    for (const who of [ROLES.member(), ROLES.branchChairman(), sup.who]) {
      const t = await tokenOf(who)
      expect(code(await gqlError(t, APPROVE_OFFER, { i: { offer_id: offerA.id, warranty_days: 7 } })), `${who.account}: одобрение`).toBe('403')
      expect(code(await gqlError(t, REJECT_OFFER, { i: { offer_id: offerA.id, reason: 'чужая модерация' } })), `${who.account}: отклонение`).toBe('403')
    }
    expect((await getOffer(sup.token, offerA.id)).status).toBe('PENDING_MODERATION')
  })

  it(caseName('mkt.offer.side.15', 'вернуть на публикацию неснятое предложение — отказ'), async () => {
    expect(code(await gqlError(sup.token, REPUBLISH_OFFER, { i: { id: offerA.id } }))).toBe('MARKETPLACE_OFFER_REPUBLISH_WRONG_STATUS')
    expect((await getOffer(sup.token, offerA.id)).status).toBe('PENDING_MODERATION')
  })

  it(caseName('mkt.offer.side.23', 'повторное одобрение — применяется один раз, второе отбивается конфликтом'), async () => {
    const first = await approve(offerA.id, 14)
    expect(first.status).toBe('ACTIVE')
    expect(first.warranty_days).toBe(14)
    const second = await gqlError(await tokenOf(CHAIRMAN), APPROVE_OFFER, { i: { offer_id: offerA.id, warranty_days: 30 } })
    expect(code(second)).toBe('MARKETPLACE_OFFER_MODERATION_ALREADY_DONE')
    const after = await getOffer(sup.token, offerA.id)
    expect(after.status).toBe('ACTIVE')
    expect(after.warranty_days).toBe(14)
    const log = await gql<any>(await tokenOf(CHAIRMAN), 'query($id:String!){ marketplaceListModerationLog(offer_id:$id){ action by_account } }', { id: offerA.id })
    expect(log.marketplaceListModerationLog.filter((e: any) => e.action === 'approve')).toHaveLength(1)
  })

  it(caseName('mkt.offer.side.17', 'модерация уже одобренного или отклонённого — конфликт'), async () => {
    const chairToken = await tokenOf(CHAIRMAN)
    const rejected = await gql<any>(chairToken, REJECT_OFFER, { i: { offer_id: offerR.id, reason: 'Нет фотографии товара' } })
    expect(rejected.marketplaceRejectOffer.status).toBe('REJECTED')

    expect(code(await gqlError(chairToken, REJECT_OFFER, { i: { offer_id: offerA.id, reason: 'передумали' } }))).toBe('MARKETPLACE_OFFER_MODERATION_ALREADY_DONE')
    expect(code(await gqlError(chairToken, APPROVE_OFFER, { i: { offer_id: offerR.id, warranty_days: 7 } }))).toBe('MARKETPLACE_OFFER_MODERATION_ALREADY_DONE')
    expect(code(await gqlError(chairToken, REJECT_OFFER, { i: { offer_id: offerR.id, reason: 'ещё раз' } }))).toBe('MARKETPLACE_OFFER_MODERATION_ALREADY_DONE')

    expect((await getOffer(sup.token, offerA.id)).status).toBe('ACTIVE')
    const r = await getOffer(sup.token, offerR.id)
    expect(r.status).toBe('REJECTED')
    expect(r.reject_reason).toBe('Нет фотографии товара')
  })

  it(caseName('mkt.offer.side.16', 'снять уже снятое или отклонённое — отказ'), async () => {
    const w = await gql<any>(sup.token, WITHDRAW_OFFER, { i: { id: offerA.id } })
    expect(w.marketplaceWithdrawOffer.status).toBe('WITHDRAWN')
    expect(code(await gqlError(sup.token, WITHDRAW_OFFER, { i: { id: offerA.id } }))).toBe('MARKETPLACE_OFFER_UNPUBLISH_ALREADY_DONE')
    expect(code(await gqlError(sup.token, WITHDRAW_OFFER, { i: { id: offerR.id } }))).toBe('MARKETPLACE_OFFER_UNPUBLISH_ALREADY_DONE')
    expect((await getOffer(sup.token, offerA.id)).status).toBe('WITHDRAWN')
    expect((await getOffer(sup.token, offerR.id)).status).toBe('REJECTED')
  })

  it(caseName('mkt.offer.side.14', 'вернуть на публикацию чужое снятое предложение — отказ'), async () => {
    const other = await tokenOf(ROLES.supplier())
    expect(code(await gqlError(other, REPUBLISH_OFFER, { i: { id: offerA.id } }))).toBe('MARKETPLACE_OFFER_EDIT_FORBIDDEN_NOT_OWNER')
    expect((await getOffer(sup.token, offerA.id)).status).toBe('WITHDRAWN')
    // Своё снятое и ранее одобренное владелец возвращает сразу в каталог.
    const back = await gql<any>(sup.token, REPUBLISH_OFFER, { i: { id: offerA.id } })
    expect(back.marketplaceRepublishOffer.status).toBe('ACTIVE')
  })
})

// ── Остаток по упаковкам ──────────────────────────────────────────────────

const packaged = (what: string, packages: Record<string, unknown>[], extra: Record<string, unknown> = {}) =>
  offerInput(name(what), categoryId, {
    sale_form: 'PACKAGED',
    unit_of_measure: 'LITER',
    quantity_available: null,
    packages,
    ...extra,
  })

describe('предложение: остаток по упаковкам', () => {
  it(caseName('mkt.offer.side.29', 'остаток на каждой упаковке: 3 × 0,5 л и 8 × 1 л → предложение 9,5 л'), async () => {
    const o = await createOffer(sup.token, packaged('молоко по упаковкам', [
      { size: 0.5, price: '50.00', label: 'Бутылка 0,5 л', package_type: 'стекло', quantity_available: 3, is_default: true },
      { size: 1, price: '90.00', label: 'Бутылка 1 л', package_type: 'стекло', quantity_available: 8 },
    ]))
    const read = await getOffer(sup.token, o.id)
    const half = read.packages.find((p: any) => p.size === 0.5)
    const litre = read.packages.find((p: any) => p.size === 1)
    expect([half.quantity_available, half.quantity_blocked, half.quantity_consumed]).toEqual([3, 0, 0])
    expect([litre.quantity_available, litre.quantity_blocked, litre.quantity_consumed]).toEqual([8, 0, 0])
    expect(read.quantity_available).toBeCloseTo(9.5, 6)
    expect(read.quantity_blocked).toBe(0)
  })

  it(caseName('mkt.offer.side.30', 'ограниченный остаток без остатка на упаковке — отказ, предложение не создаётся'), async () => {
    await expectCreateRefused(
      packaged('без остатка упаковки', [{ size: 0.5, price: '50.00', package_type: 'стекло', is_default: true }]),
      ['MARKETPLACE_PACKAGE_FREE_COUNT_REQUIRED'],
    )
  })

  it(caseName('mkt.offer.side.31', 'отпуск упаковкой без ограничения — остатки нули'), async () => {
    const o = await createOffer(sup.token, packaged('безлимит упаковкой', [
      { size: 0.5, price: '50.00', package_type: 'стекло', quantity_available: 5, is_default: true },
    ], { unlimited_flag: true }))
    const read = await getOffer(sup.token, o.id)
    expect(read.unlimited_flag).toBe(true)
    expect(read.quantity_available).toBe(0)
    expect(read.packages.map((p: any) => p.quantity_available)).toEqual([0])
  })

  it(caseName('mkt.offer.side.32', 'заказ упаковкой блокирует упаковки, дробные упаковки — отказ, дробная мера проходит'), async () => {
    const pk = await createOffer(sup.token, packaged('сок к заказу', [
      { size: 0.5, price: '50.00', package_type: 'стекло', quantity_available: 3, is_default: true },
      { size: 1, price: '90.00', package_type: 'стекло', quantity_available: 8 },
    ]))
    const byMeasure = await createOffer(sup.token, offerInput(name('крупа к заказу'), categoryId, { quantity_available: 10 }))
    await approve(pk.id)
    await approve(byMeasure.id)
    const halfId = pk.packages.find((p: any) => p.size === 0.5).id
    const litreId = pk.packages.find((p: any) => p.size === 1).id

    const member = ROLES.member()
    const memberToken = await tokenOf(member)
    // Дробное число упаковок отбивается до резерва.
    await gql(memberToken, 'mutation{ marketplaceClearCart{ __typename } }')
    const frac = await gqlError(memberToken, 'mutation($i:MarketplaceAddToCartInput!){ marketplaceAddToCart(input:$i){ __typename } }', {
      i: { offer_id: pk.id, package_id: halfId, quantity: 1.5, delivery_braname: 'krg' },
    })
    expect(code(frac)).toBe('MARKETPLACE_PACKAGING_COUNT_INVALID')

    await ensureShareFunds(member.account, 2_000, memberToken)
    const orders = await checkoutLines(member, [
      { offer_id: pk.id, package_id: halfId, quantity: 2 },
      { offer_id: byMeasure.id, quantity: 0.5 },
    ])
    expect(orders.length).toBeGreaterThan(0)

    const p = await getOffer(sup.token, pk.id)
    const half = p.packages.find((x: any) => x.id === halfId)
    const litre = p.packages.find((x: any) => x.id === litreId)
    expect([half.quantity_available, half.quantity_blocked]).toEqual([1, 2])
    expect([litre.quantity_available, litre.quantity_blocked]).toEqual([8, 0])
    expect(p.quantity_blocked).toBeCloseTo(1, 6)
    expect(p.quantity_available).toBeCloseTo(8.5, 6)

    const m = await getOffer(sup.token, byMeasure.id)
    expect(m.quantity_blocked).toBeCloseTo(0.5, 6)
    expect(m.quantity_available).toBeCloseTo(9.5, 6)
  })
})
