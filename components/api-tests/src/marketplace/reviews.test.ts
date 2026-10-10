/**
 * Профиль поставщика и отзывы заказчиков (реестр marketplace.reviews) снаружи.
 *
 * Набор сам ведёт два заказа пайщицы от корзины до получения и один оставляет
 * неполученным: отзыв пишется только по полученному заказу, один на заказ.
 * Дальше — правка автором, скрытие и возврат администратором, сводные оценки
 * предложения и поставщика, профиль поставщика и профиль кооператива.
 */
import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, ROLES, type Who, amount, caseName, freshMember, gql, login, tokenOf } from '../core'
import { KRG, type OfferLike, getOrder, pickOffer, placeOrder } from './flow'
import { PHOTO, type IssuedOrder, fundShare, issuedOrder, refusal } from './mkt-flows.helpers'
import { freshSupplier } from './offer.helpers'

const ekaterina = ROLES.member()
const ivanpetrov = ROLES.otherMember()
const sidorov = ROLES.supplier()
const chairkrg = ROLES.branchChairman()

let memberToken = ''
let otherToken = ''
let supplierToken = ''
let operatorToken = ''
let chairmanToken = ''

const REVIEW_FIELDS = 'id order_id offer_id offer_name supplier_account author_account author_name stars text status hidden_reason'
const CREATE = `mutation($d:MarketplaceCreateReviewInput!){ marketplaceCreateReview(data:$d){ ${REVIEW_FIELDS} } }`
const UPDATE = `mutation($d:MarketplaceUpdateMyReviewInput!){ marketplaceUpdateMyReview(data:$d){ ${REVIEW_FIELDS} } }`
const SET_STATUS = `mutation($d:MarketplaceSetReviewStatusInput!){ marketplaceSetReviewStatus(data:$d){ ${REVIEW_FIELDS} } }`
const LIST = `query($f:MarketplaceListReviewsFilterInput,$o:PaginationInput){ marketplaceListReviews(filter:$f, options:$o){ totalCount items{ ${REVIEW_FIELDS} } } }`
const SUMMARY = 'query($f:MarketplaceReviewSummaryInput!){ marketplaceReviewSummary(filter:$f){ rating_avg reviews_count stars_breakdown{ stars count } } }'
const MY_BY_ORDER = `query($o:String!){ marketplaceMyReviewByOrder(order_id:$o){ ${REVIEW_FIELDS} } }`
const OFFER_RATING = 'query($id:String!){ marketplaceGetOffer(id:$id){ id rating_avg reviews_count } }'

const PROFILE_FIELDS = 'supplier_account display_name custom_display_name about cover_url is_cooperative offers_count rating_avg reviews_count'
const PROFILE = `query($a:String!){ marketplaceSupplierProfile(supplier_account:$a){ ${PROFILE_FIELDS} } }`
const UPDATE_MY_PROFILE = `mutation($d:MarketplaceUpdateSupplierProfileInput!){ marketplaceUpdateMySupplierProfile(data:$d){ ${PROFILE_FIELDS} } }`
const UPDATE_COOP_PROFILE = `mutation($d:MarketplaceUpdateSupplierProfileInput!){ marketplaceUpdateCooperativeProfile(data:$d){ ${PROFILE_FIELDS} } }`

const PAGE = { page: 1, limit: 100, sortBy: 'created_at', sortOrder: 'DESC' }
/** Отказ общего гарда прав: кодом либо числом 403. */
const NO_RIGHT = ['403', 'KIT_INSUFFICIENT_RIGHTS']
const NOT_OWN = ['403', 'KIT_RIGHT_SCOPE_OWN']
/** Отказ проверки ввода приходит раньше доменного кода. */
const BAD_INPUT = ['400', '422']
/** Подписанная ссылка файлового хранилища: путь к файлу, срок и подпись. */
const SIGNED_URL = /\/storage\/.+\?exp=\d+&sig=[0-9a-f]+$/

async function reviewsOf(token: string, filter: Record<string, unknown>): Promise<any[]> {
  const d = await gql<any>(token, LIST, { f: filter, o: PAGE })
  return d.marketplaceListReviews.items
}

async function summaryOf(filter: Record<string, unknown>): Promise<any> {
  return (await gql<any>(memberToken, SUMMARY, { f: filter })).marketplaceReviewSummary
}

async function profileOf(token: string, account: string): Promise<any> {
  return (await gql<any>(token, PROFILE, { a: account })).marketplaceSupplierProfile
}

describe('отзывы заказчиков: по полученному заказу, правка автором, скрытие администратором', () => {
  let offer: OfferLike
  let first: IssuedOrder
  let second: IssuedOrder
  let pendingOrderId = ''
  let review: any
  let summaryBefore: any

  beforeAll(async () => {
    memberToken = await tokenOf(ekaterina)
    otherToken = await tokenOf(ivanpetrov)
    supplierToken = await tokenOf(sidorov)
    operatorToken = await tokenOf(chairkrg)
    chairmanToken = await tokenOf(CHAIRMAN)

    offer = await pickOffer(sidorov.account, KRG, 'Мёд цветочный')
    summaryBefore = await summaryOf({ supplier_account: sidorov.account })

    first = await issuedOrder({ member: ekaterina, supplier: sidorov, operator: chairkrg, offer, quantity: 1 })
    second = await issuedOrder({ member: ekaterina, supplier: sidorov, operator: chairkrg, offer, quantity: 1 })
    expect((await getOrder(memberToken, first.orderId)).status, 'первый заказ получен').toBe('RECEIVED')
    expect((await getOrder(memberToken, second.orderId)).status, 'второй заказ получен').toBe('RECEIVED')

    await fundShare(ekaterina, amount(offer.price_per_unit) * 2)
    pendingOrderId = (await placeOrder({ who: ekaterina, offerId: offer.id, quantity: 1, braname: KRG })).orderId
  }, 1_800_000)

  it(caseName('mkt.review.side.01', 'по заказу, который ещё не получен, отзыв не принимается'), async () => {
    const r = await refusal(memberToken, CREATE, { d: { order_id: pendingOrderId, stars: 5, text: 'Рано' } })
    expect(r?.codeText, r?.message).toBe('MARKETPLACE_REVIEW_ORDER_NOT_RECEIVED')
  })

  it(caseName('mkt.review.side.03', 'заказа нет — «не найдено»'), async () => {
    const r = await refusal(memberToken, CREATE, { d: { order_id: randomUUID(), stars: 5 } })
    expect(r?.codeText, r?.message).toBe('MARKETPLACE_REVIEW_ORDER_NOT_FOUND')
  })

  it(caseName('mkt.review.side.05', 'оценка вне диапазона 1–5 — отказ'), async () => {
    for (const stars of [0, 6]) {
      const r = await refusal(memberToken, CREATE, { d: { order_id: first.orderId, stars } })
      expect([...BAD_INPUT, 'MARKETPLACE_REVIEW_STARS_OUT_OF_RANGE'], `${stars}: ${r?.message}`).toContain(r?.codeText)
    }
  })

  it(caseName('mkt.review.side.06', 'текст длиннее предела — отказ'), async () => {
    const r = await refusal(memberToken, CREATE, { d: { order_id: first.orderId, stars: 5, text: 'д'.repeat(4001) } })
    expect([...BAD_INPUT, 'MARKETPLACE_REVIEW_TEXT_TOO_LONG'], r?.message).toContain(r?.codeText)
    expect((await gql<any>(memberToken, MY_BY_ORDER, { o: first.orderId })).marketplaceMyReviewByOrder, 'отказ не оставляет отзыва').toBeNull()
  })

  it(caseName('mkt.review.rights.side.01', 'по чужому заказу отзыв не оставить'), async () => {
    const r = await refusal(otherToken, CREATE, { d: { order_id: first.orderId, stars: 1, text: 'Чужой заказ' } })
    expect(NOT_OWN, r?.message).toContain(r?.codeText)
  })

  it(caseName('mkt.review.rights.side.03', 'пайщик без оферты и пункта выдачи отзыв не оставляет'), async () => {
    const newcomer: Who = freshMember({ prefix: 'mkrv' })
    const r = await refusal(await login(newcomer), CREATE, { d: { order_id: first.orderId, stars: 5 } })
    expect(r?.codeText, r?.message).toBe('MARKETPLACE_ORDERER_ONBOARDING_REQUIRED')
  })

  it(caseName('mkt.review.happy.01', 'заказчица оставляет отзыв по полученному заказу'), async () => {
    const d = await gql<any>(memberToken, CREATE, { d: { order_id: first.orderId, stars: 5, text: '  Мёд 100% натуральный  ' } })
    review = d.marketplaceCreateReview
    expect(review).toMatchObject({
      order_id: first.orderId,
      offer_id: offer.id,
      supplier_account: sidorov.account,
      author_account: ekaterina.account,
      stars: 5,
      text: 'Мёд 100% натуральный',
      status: 'PUBLISHED',
    })
    expect(review.offer_name, 'название предложения').toBe(offer.product_name)
    expect(String(review.author_name ?? '').length, 'имя автора').toBeGreaterThan(0)
  })

  it(caseName('mkt.review.rights.happy.01', 'автор читает свой отзыв по заказу'), async () => {
    const mine = (await gql<any>(memberToken, MY_BY_ORDER, { o: first.orderId })).marketplaceMyReviewByOrder
    expect(mine?.id).toBe(review.id)
  })

  it(caseName('mkt.review.side.04', 'второй отзыв на тот же заказ — отказ'), async () => {
    const r = await refusal(memberToken, CREATE, { d: { order_id: first.orderId, stars: 4 } })
    expect(r?.codeText, r?.message).toBe('MARKETPLACE_REVIEW_ALREADY_EXISTS')
  })

  it(caseName('mkt.review.happy.02', 'оценка без текста принимается'), async () => {
    const d = await gql<any>(memberToken, CREATE, { d: { order_id: second.orderId, stars: 2 } })
    expect(d.marketplaceCreateReview).toMatchObject({ order_id: second.orderId, stars: 2, text: '', status: 'PUBLISHED' })
  })

  it(caseName('mkt.review.happy.07', 'предложение показывает сводную оценку по своим отзывам'), async () => {
    const o = (await gql<any>(memberToken, OFFER_RATING, { id: offer.id })).marketplaceGetOffer
    const s = await summaryOf({ offer_id: offer.id })
    expect(o.reviews_count, 'число отзывов предложения').toBe(s.reviews_count)
    expect(o.rating_avg, 'средняя оценка предложения').toBe(s.rating_avg)
    expect(o.reviews_count).toBeGreaterThanOrEqual(2)
  })

  it(caseName('mkt.review.happy.08', 'сводка поставщика: распределение по оценкам сходится с числом отзывов'), async () => {
    const s = await summaryOf({ supplier_account: sidorov.account })
    expect(s.reviews_count, 'два новых отзыва').toBe(summaryBefore.reviews_count + 2)
    expect(s.stars_breakdown.map((row: any) => row.stars), 'от пяти звёзд к одной').toEqual([5, 4, 3, 2, 1])
    expect(s.stars_breakdown.reduce((sum: number, row: any) => sum + row.count, 0)).toBe(s.reviews_count)
    expect(s.rating_avg).toBeGreaterThanOrEqual(1)
    expect(s.rating_avg).toBeLessThanOrEqual(5)
  })

  it(caseName('mkt.review.side.18', 'сводка предложения без отзывов: оценки нет, счётчик ноль'), async () => {
    const s = await summaryOf({ offer_id: randomUUID() })
    expect(s).toMatchObject({ rating_avg: null, reviews_count: 0 })
    expect(s.stars_breakdown).toHaveLength(5)
  })

  it(caseName('mkt.review.side.19', 'поиск по тексту: знаки подстановки ищутся буквально'), async () => {
    const literal = await reviewsOf(memberToken, { offer_id: offer.id, search: '100%' })
    expect(literal.map(r => r.id), 'отзыв с «100%» найден').toContain(review.id)
    // «_» в образце LIKE — любой знак: без экранирования «100_» нашёл бы «100%».
    const wildcard = await reviewsOf(memberToken, { offer_id: offer.id, search: '100_' })
    expect(wildcard.map(r => r.id), '«100_» отзыв с «100%» не находит').not.toContain(review.id)
  })

  it(caseName('mkt.review.happy.03', 'автор меняет оценку и текст своего отзыва'), async () => {
    const d = await gql<any>(memberToken, UPDATE, { d: { id: review.id, stars: 4, text: 'Мёд 100% натуральный, банка помята' } })
    expect(d.marketplaceUpdateMyReview).toMatchObject({ id: review.id, stars: 4, text: 'Мёд 100% натуральный, банка помята' })
  })

  it(caseName('mkt.review.rights.side.02', 'поставщик и посторонний пайщик на отзыв не влияют'), async () => {
    const edit = await refusal(otherToken, UPDATE, { d: { id: review.id, stars: 1 } })
    expect(NOT_OWN, edit?.message).toContain(edit?.codeText)
    const hide = await refusal(supplierToken, SET_STATUS, { d: { id: review.id, status: 'HIDDEN', reason: 'Не нравится' } })
    expect(NO_RIGHT, hide?.message).toContain(hide?.codeText)
  })

  it(caseName('mkt.review.rights.side.04', 'заказчица и оператор участка отзыв не скрывают'), async () => {
    for (const token of [memberToken, operatorToken]) {
      const r = await refusal(token, SET_STATUS, { d: { id: review.id, status: 'HIDDEN', reason: 'Причина' } })
      expect(NO_RIGHT, r?.message).toContain(r?.codeText)
    }
  })

  it(caseName('mkt.review.side.10', 'скрытие без причины — отказ'), async () => {
    const r = await refusal(chairmanToken, SET_STATUS, { d: { id: review.id, status: 'HIDDEN', reason: '   ' } })
    expect(r?.codeText, r?.message).toBe('MARKETPLACE_REVIEW_HIDE_REASON_REQUIRED')
  })

  it(caseName('mkt.review.side.12', 'скрытие отзыва, которого нет, — «не найдено»'), async () => {
    const r = await refusal(chairmanToken, SET_STATUS, { d: { id: randomUUID(), status: 'HIDDEN', reason: 'Причина' } })
    expect(r?.codeText, r?.message).toBe('MARKETPLACE_REVIEW_NOT_FOUND')
  })

  it(caseName('mkt.review.happy.04', 'администратор скрывает отзыв с причиной: он уходит из сводной оценки'), async () => {
    const before = await summaryOf({ offer_id: offer.id })
    const d = await gql<any>(chairmanToken, SET_STATUS, { d: { id: review.id, status: 'HIDDEN', reason: 'Внешний слой: проверка скрытия' } })
    expect(d.marketplaceSetReviewStatus).toMatchObject({ id: review.id, status: 'HIDDEN', hidden_reason: 'Внешний слой: проверка скрытия' })
    const after = await summaryOf({ offer_id: offer.id })
    expect(after.reviews_count, 'скрытый отзыв в сводку не входит').toBe(before.reviews_count - 1)
  })

  it(caseName('mkt.review.rights.happy.02', 'скрывать отзывы вправе администратор'), async () => {
    const hidden = await reviewsOf(chairmanToken, { offer_id: offer.id, include_hidden: true, status: 'HIDDEN' })
    expect(hidden.map(r => r.id)).toContain(review.id)
  })

  it(caseName('mkt.review.side.13', 'пайщик без права модерации скрытых отзывов не видит, даже если попросил'), async () => {
    const list = await reviewsOf(otherToken, { offer_id: offer.id, include_hidden: true })
    expect(list.map(r => r.id)).not.toContain(review.id)
    expect(list.every(r => r.status === 'PUBLISHED' && r.hidden_reason === null)).toBe(true)
  })

  it(caseName('mkt.review.side.14', 'администратор без просьбы о скрытых получает только опубликованные'), async () => {
    const list = await reviewsOf(chairmanToken, { offer_id: offer.id })
    expect(list.map(r => r.id)).not.toContain(review.id)
  })

  it(caseName('mkt.review.happy.06', 'администратор с просьбой о скрытых видит отзывы любого состояния'), async () => {
    const list = await reviewsOf(chairmanToken, { offer_id: offer.id, include_hidden: true })
    const statuses = new Set(list.map(r => r.status))
    expect(statuses.has('HIDDEN') && statuses.has('PUBLISHED'), [...statuses].join(',')).toBe(true)
  })

  it(caseName('mkt.review.side.15', 'скрытый отзыв по заказу виден автору с причиной, постороннему — нет'), async () => {
    const mine = (await gql<any>(memberToken, MY_BY_ORDER, { o: first.orderId })).marketplaceMyReviewByOrder
    expect(mine).toMatchObject({ id: review.id, status: 'HIDDEN', hidden_reason: 'Внешний слой: проверка скрытия' })
    const foreign = (await gql<any>(otherToken, MY_BY_ORDER, { o: first.orderId })).marketplaceMyReviewByOrder
    expect(foreign).toBeNull()
  })

  it(caseName('mkt.review.side.08', 'скрытый отзыв автор не правит'), async () => {
    const r = await refusal(memberToken, UPDATE, { d: { id: review.id, stars: 5, text: 'Передумала' } })
    expect(r?.codeText, r?.message).toBe('MARKETPLACE_REVIEW_HIDDEN_NOT_EDITABLE')
  })

  it(caseName('mkt.review.happy.05', 'администратор возвращает отзыв в публикацию'), async () => {
    const d = await gql<any>(chairmanToken, SET_STATUS, { d: { id: review.id, status: 'PUBLISHED' } })
    expect(d.marketplaceSetReviewStatus).toMatchObject({ id: review.id, status: 'PUBLISHED', hidden_reason: null })
    expect((await reviewsOf(otherToken, { offer_id: offer.id })).map(r => r.id)).toContain(review.id)
  })

  it(caseName('mkt.review.side.11', 'повторная публикация опубликованного отзыва ничего не меняет'), async () => {
    const d = await gql<any>(chairmanToken, SET_STATUS, { d: { id: review.id, status: 'PUBLISHED' } })
    expect(d.marketplaceSetReviewStatus).toMatchObject({ id: review.id, status: 'PUBLISHED' })
  })

  it(caseName('mkt.review.rights.happy.03', 'отзывы читают заказчик, поставщик, оператор участка и администратор'), async () => {
    for (const token of [memberToken, supplierToken, operatorToken, chairmanToken]) {
      const list = await reviewsOf(token, { supplier_account: sidorov.account })
      expect(list.map(r => r.id)).toContain(review.id)
    }
  })
})

describe('профиль поставщика: читают все, правит поставщик; профиль кооператива — администратор', () => {
  /** Свежий поставщик из реестра: о себе не писал, предложений нет. */
  let newSupplier: Who

  beforeAll(async () => {
    memberToken = await tokenOf(ekaterina)
    supplierToken = await tokenOf(sidorov)
    operatorToken = await tokenOf(chairkrg)
    chairmanToken = await tokenOf(CHAIRMAN)
    newSupplier = (await freshSupplier('mkpf')).who
  }, 600_000)

  it(caseName('mkt.profile.happy.02', 'поставщик о себе ещё не писал: имя из сертификата, страница открывается'), async () => {
    const p = await profileOf(memberToken, newSupplier.account)
    expect(p).toMatchObject({ supplier_account: newSupplier.account, custom_display_name: null, about: '', cover_url: null, is_cooperative: false })
    expect(String(p.display_name).length, 'имя из сертификата').toBeGreaterThan(0)
  })

  it(caseName('mkt.profile.side.01', 'поставщик из реестра без предложений — страница открывается'), async () => {
    const p = await profileOf(memberToken, newSupplier.account)
    expect(p.offers_count).toBe(0)
  })

  it(caseName('mkt.profile.side.02', 'учётная запись вне реестра и без предложений — «не найдено»'), async () => {
    // Пайщик, который поставщиком не был: ни записи в реестре, ни предложений.
    const stranger = freshMember({ prefix: 'mkpn' })
    await login(stranger)
    const r = await refusal(memberToken, PROFILE, { a: stranger.account })
    expect(r?.codeText, r?.message).toBe('MARKETPLACE_SUPPLIER_PROFILE_NOT_FOUND')
  })

  it(caseName('mkt.profile.rights.side.01', 'заказчик, не поставщик, профиль поставщика не ведёт'), async () => {
    const r = await refusal(memberToken, UPDATE_MY_PROFILE, { d: { about: 'Я не поставщик' } })
    expect(NO_RIGHT, r?.message).toContain(r?.codeText)
  })

  it(caseName('mkt.profile.side.04', 'рассказ длиннее предела — отказ'), async () => {
    const r = await refusal(supplierToken, UPDATE_MY_PROFILE, { d: { about: 'а'.repeat(4001) } })
    expect([...BAD_INPUT, 'MARKETPLACE_SUPPLIER_PROFILE_ABOUT_TOO_LONG'], r?.message).toContain(r?.codeText)
  })

  it(caseName('mkt.profile.break.01', 'обложка неподдерживаемого типа — отказ, профиль не меняется'), async () => {
    const before = await profileOf(supplierToken, sidorov.account)
    const r = await refusal(supplierToken, UPDATE_MY_PROFILE, { d: { about: 'Не должно сохраниться', cover: { base64: PHOTO.base64, mime_type: 'image/gif' } } })
    expect(r?.codeText, r?.message).toBe('MARKETPLACE_OFFER_IMAGE_TYPE_UNSUPPORTED')
    expect((await profileOf(supplierToken, sidorov.account)).about).toBe(before.about)
  })

  it(caseName('mkt.profile.happy.04', 'поставщик сохраняет название, рассказ и обложку'), async () => {
    const d = await gql<any>(supplierToken, UPDATE_MY_PROFILE, { d: { display_name: ' Пасека Сидорова ', about: '  Мёд с собственной пасеки  ', cover: PHOTO } })
    expect(d.marketplaceUpdateMySupplierProfile).toMatchObject({
      supplier_account: sidorov.account,
      display_name: 'Пасека Сидорова',
      custom_display_name: 'Пасека Сидорова',
      about: 'Мёд с собственной пасеки',
    })
  })

  it(caseName('mkt.profile.rights.happy.01', 'поставщик правит свой профиль'), async () => {
    expect((await profileOf(supplierToken, sidorov.account)).custom_display_name).toBe('Пасека Сидорова')
  })

  it(caseName('mkt.profile.happy.07', 'обложка отдаётся ссылкой'), async () => {
    const p = await profileOf(memberToken, sidorov.account)
    expect(String(p.cover_url), 'ссылка на обложку').toMatch(SIGNED_URL)
  })

  it(caseName('mkt.profile.happy.01', 'заказчик читает профиль: название, рассказ, число предложений и оценка'), async () => {
    const p = await profileOf(memberToken, sidorov.account)
    const s = await summaryOf({ supplier_account: sidorov.account })
    expect(p).toMatchObject({ display_name: 'Пасека Сидорова', about: 'Мёд с собственной пасеки', is_cooperative: false })
    expect(p.offers_count, 'предложения поставщика в каталоге').toBeGreaterThan(0)
    expect(p.reviews_count).toBe(s.reviews_count)
    expect(p.rating_avg).toBe(s.rating_avg)
    // Имя на карточке предложения остаётся именем из сертификата; профиль читают все столы.
    for (const token of [supplierToken, operatorToken, chairmanToken])
      expect((await profileOf(token, sidorov.account)).display_name).toBe('Пасека Сидорова')
  })

  it(caseName('mkt.profile.happy.05', 'правка одного поля остальные не трогает'), async () => {
    const d = await gql<any>(supplierToken, UPDATE_MY_PROFILE, { d: { about: 'Мёд и воск' } })
    const p = d.marketplaceUpdateMySupplierProfile
    expect(p).toMatchObject({ about: 'Мёд и воск', custom_display_name: 'Пасека Сидорова' })
    expect(String(p.cover_url), 'обложка на месте').toMatch(SIGNED_URL)
  })

  it(caseName('mkt.profile.happy.06', 'пустое название возвращает имя из сертификата, обложка убирается'), async () => {
    const d = await gql<any>(supplierToken, UPDATE_MY_PROFILE, { d: { display_name: '', remove_cover: true } })
    const p = d.marketplaceUpdateMySupplierProfile
    expect(p).toMatchObject({ custom_display_name: null, cover_url: null, about: 'Мёд и воск' })
    expect(p.display_name, 'имя из сертификата').not.toBe('Пасека Сидорова')
    expect(String(p.display_name).length).toBeGreaterThan(0)
  })

  it(caseName('mkt.profile.rights.side.02', 'поставщик и оператор участка профиль кооператива не правят'), async () => {
    for (const token of [supplierToken, operatorToken]) {
      const r = await refusal(token, UPDATE_COOP_PROFILE, { d: { about: 'Чужой профиль' } })
      expect(NO_RIGHT, r?.message).toContain(r?.codeText)
    }
  })

  it(caseName('mkt.profile.rights.happy.02', 'администратор правит профиль кооператива'), async () => {
    const d = await gql<any>(chairmanToken, UPDATE_COOP_PROFILE, { d: { about: 'Склад кооператива: имущество выдаётся сразу' } })
    expect(d.marketplaceUpdateCooperativeProfile).toMatchObject({ supplier_account: COOP, is_cooperative: true, about: 'Склад кооператива: имущество выдаётся сразу' })
  })

  it(caseName('mkt.profile.happy.03', 'профиль кооператива открывается заказчику'), async () => {
    const p = await profileOf(memberToken, COOP)
    expect(p).toMatchObject({ supplier_account: COOP, is_cooperative: true, about: 'Склад кооператива: имущество выдаётся сразу' })
  })
})
