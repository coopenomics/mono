/**
 * Отзывы заказчиков о полученном имуществе (задача 598-61, случаи mkt.review.*
 * в test-registry/marketplace.reviews.yaml).
 *
 * Инварианты:
 *   - отзыв пишет заказчик по своему заказу и только после получения;
 *   - на заказ отзыв один, двойное нажатие второго отзыва не создаёт;
 *   - оценка — целое от 1 до 5, текст не длиннее предела;
 *   - скрытый отзыв автор не правит; скрытие требует причины;
 *   - скрытые отзывы в списке видит только тот, кто вправе их модерировать;
 *   - сводные оценки карточек одной страницы каталога — один запрос к базе.
 */
import { MarketplaceReviewService } from '~/extensions/marketplace/application/services/marketplace-review.service';
import { MarketplaceOrderStatuses } from '~/extensions/marketplace/domain/entities/marketplace-order.types';
import { MarketplaceReviewDomainEntity } from '~/extensions/marketplace/domain/entities/marketplace-review.entity';
import {
  MARKETPLACE_REVIEW_TEXT_MAX,
  MarketplaceReviewStatuses,
} from '~/extensions/marketplace/domain/entities/marketplace-review.types';
import type {
  MarketplaceReviewDomainRepository,
  ReviewCreateInput,
} from '~/extensions/marketplace/domain/repositories/marketplace-review.repository';

type CreateInput = Parameters<MarketplaceReviewService['create']>[0];
type SetStatusInput = Parameters<MarketplaceReviewService['setStatus']>[0];

const COOP = 'voskhod';
const NOW = new Date('2026-10-10T10:00:00Z');
const PAGE = { page: 1, limit: 10, sortBy: 'created_at', sortOrder: 'DESC' as const };

function makeReview(over: Partial<MarketplaceReviewDomainEntity> = {}): MarketplaceReviewDomainEntity {
  return new MarketplaceReviewDomainEntity({
    id: 'rev-1',
    coopname: COOP,
    order_id: 'ord-1',
    offer_id: 'off-1',
    supplier_account: 'sup1',
    author_account: 'ivan',
    stars: 5,
    text: 'Свежее',
    status: MarketplaceReviewStatuses.PUBLISHED,
    hidden_by: null,
    hidden_at: null,
    hidden_reason: null,
    created_at: NOW,
    updated_at: NOW,
    ...over,
  });
}

function makeOrder(over: Record<string, unknown> = {}) {
  return {
    id: 'ord-1',
    coopname: COOP,
    orderer_account: 'ivan',
    supplier_account: 'sup1',
    offer_id: 'off-1',
    status: MarketplaceOrderStatuses.RECEIVED,
    ...over,
  };
}

function build(order: Record<string, unknown> | null = makeOrder()) {
  const reviews: jest.Mocked<MarketplaceReviewDomainRepository> = {
    findById: jest.fn().mockResolvedValue(null),
    findByOrder: jest.fn().mockResolvedValue(null),
    create: jest.fn(async (input: ReviewCreateInput) => makeReview(input)),
    updateContent: jest.fn(async (_id: string, patch: { stars: number; text: string }) => makeReview(patch)),
    setStatus: jest.fn(async (_id: string, patch: Partial<MarketplaceReviewDomainEntity>) => makeReview(patch)),
    list: jest.fn().mockResolvedValue({ items: [], totalCount: 0, totalPages: 1, currentPage: 1 }),
    ratingsByOffers: jest.fn().mockResolvedValue(new Map()),
    summary: jest.fn(),
  };
  const orders = { findById: jest.fn().mockResolvedValue(order) };
  const service = new MarketplaceReviewService(reviews, orders as any);
  return { service, reviews, orders };
}

const input = (over: Partial<CreateInput> = {}): CreateInput => ({
  coopname: COOP,
  author_account: 'ivan',
  order_id: 'ord-1',
  stars: 4,
  text: '  Всё хорошо  ',
  ...over,
});

describe('отзыв по полученному заказу', () => {
  // mkt.review.happy.01
  it('заказчик оставляет отзыв по полученному заказу: поставщик и предложение берутся из заказа', async () => {
    const { service, reviews } = build();

    const review = await service.create(input());

    expect(reviews.create).toHaveBeenCalledWith({
      coopname: COOP,
      order_id: 'ord-1',
      offer_id: 'off-1',
      supplier_account: 'sup1',
      author_account: 'ivan',
      stars: 4,
      text: 'Всё хорошо',
    });
    expect(review.stars).toBe(4);
  });

  // mkt.review.happy.02
  it('оценка без текста принимается, возвращённый после выдачи заказ — тоже', async () => {
    const { service, reviews } = build(makeOrder({ status: MarketplaceOrderStatuses.RETURNED }));

    await service.create(input({ text: null }));

    expect(reviews.create).toHaveBeenCalledWith(expect.objectContaining({ stars: 4, text: '' }));
  });

  // mkt.review.side.01
  it.each([
    MarketplaceOrderStatuses.ACTIVE,
    MarketplaceOrderStatuses.ACCEPTED,
    MarketplaceOrderStatuses.READY_TO_RECEIVE,
    MarketplaceOrderStatuses.ISSUE_ACT1,
    MarketplaceOrderStatuses.CANCELLED_BY_ORDERER,
    MarketplaceOrderStatuses.CANCELLED_BY_SUPPLIER,
  ])('заказ в статусе %s ещё не получен — отзыв не принимается', async (status) => {
    const { service, reviews } = build(makeOrder({ status }));

    await expect(service.create(input())).rejects.toMatchObject({ code: 'MARKETPLACE_REVIEW_ORDER_NOT_RECEIVED' });
    expect(reviews.create).not.toHaveBeenCalled();
  });

  // mkt.review.side.02
  it('чужой заказ — отказ, отзыв не создаётся', async () => {
    const { service, reviews } = build(makeOrder({ orderer_account: 'petr' }));

    await expect(service.create(input())).rejects.toMatchObject({ code: 'MARKETPLACE_REVIEW_FOREIGN_ORDER' });
    expect(reviews.create).not.toHaveBeenCalled();
  });

  // mkt.review.side.03
  it('заказа нет либо он другого кооператива — «не найдено»', async () => {
    await expect(build(null).service.create(input())).rejects.toMatchObject({
      code: 'MARKETPLACE_REVIEW_ORDER_NOT_FOUND',
    });
    await expect(build(makeOrder({ coopname: 'other' })).service.create(input())).rejects.toMatchObject({
      code: 'MARKETPLACE_REVIEW_ORDER_NOT_FOUND',
    });
  });

  // mkt.review.side.04
  it('второй отзыв на тот же заказ — отказ', async () => {
    const { service, reviews } = build();
    reviews.findByOrder.mockResolvedValue(makeReview());

    await expect(service.create(input())).rejects.toMatchObject({ code: 'MARKETPLACE_REVIEW_ALREADY_EXISTS' });
    expect(reviews.create).not.toHaveBeenCalled();
  });

  // mkt.review.break.01
  it('двойное нажатие: база отвергла вторую запись по уникальности — тот же отказ, а не ошибка сервера', async () => {
    const { service, reviews } = build();
    reviews.create.mockRejectedValue(Object.assign(new Error('duplicate key'), { code: '23505' }));

    await expect(service.create(input())).rejects.toMatchObject({ code: 'MARKETPLACE_REVIEW_ALREADY_EXISTS' });
  });

  // mkt.review.break.02
  it('иная ошибка базы не маскируется под «отзыв уже есть»', async () => {
    const { service, reviews } = build();
    reviews.create.mockRejectedValue(new Error('connection lost'));

    await expect(service.create(input())).rejects.toThrow('connection lost');
  });

  // mkt.review.side.05
  it.each([0, 6, -1, 4.5, Number.NaN])('оценка %s вне диапазона 1–5 — отказ до обращения к заказу', async (stars) => {
    const { service, orders } = build();

    await expect(service.create(input({ stars }))).rejects.toMatchObject({
      code: 'MARKETPLACE_REVIEW_STARS_OUT_OF_RANGE',
    });
    expect(orders.findById).not.toHaveBeenCalled();
  });

  // mkt.review.side.06
  it('текст длиннее предела — отказ; ровно предел — принимается', async () => {
    const { service, reviews } = build();

    await expect(service.create(input({ text: 'а'.repeat(MARKETPLACE_REVIEW_TEXT_MAX + 1) }))).rejects.toMatchObject({
      code: 'MARKETPLACE_REVIEW_TEXT_TOO_LONG',
    });
    await service.create(input({ text: 'а'.repeat(MARKETPLACE_REVIEW_TEXT_MAX) }));
    expect(reviews.create).toHaveBeenCalledTimes(1);
  });
});

describe('правка своего отзыва', () => {
  // mkt.review.happy.03
  it('автор меняет оценку и текст', async () => {
    const { service, reviews } = build();
    reviews.findById.mockResolvedValue(makeReview());

    await service.updateMine({ coopname: COOP, author_account: 'ivan', id: 'rev-1', stars: 2, text: ' Передумал ' });

    expect(reviews.updateContent).toHaveBeenCalledWith('rev-1', { stars: 2, text: 'Передумал' });
  });

  // mkt.review.side.07
  it('чужой отзыв править нельзя', async () => {
    const { service, reviews } = build();
    reviews.findById.mockResolvedValue(makeReview({ author_account: 'petr' }));

    await expect(
      service.updateMine({ coopname: COOP, author_account: 'ivan', id: 'rev-1', stars: 2, text: '' })
    ).rejects.toMatchObject({ code: 'MARKETPLACE_REVIEW_FOREIGN' });
    expect(reviews.updateContent).not.toHaveBeenCalled();
  });

  // mkt.review.side.08
  it('скрытый администратором отзыв автор не правит', async () => {
    const { service, reviews } = build();
    reviews.findById.mockResolvedValue(makeReview({ status: MarketplaceReviewStatuses.HIDDEN }));

    await expect(
      service.updateMine({ coopname: COOP, author_account: 'ivan', id: 'rev-1', stars: 5, text: '' })
    ).rejects.toMatchObject({ code: 'MARKETPLACE_REVIEW_HIDDEN_NOT_EDITABLE' });
    expect(reviews.updateContent).not.toHaveBeenCalled();
  });

  // mkt.review.side.09
  it('отзыв другого кооператива — «не найдено»', async () => {
    const { service, reviews } = build();
    reviews.findById.mockResolvedValue(makeReview({ coopname: 'other' }));

    await expect(
      service.updateMine({ coopname: COOP, author_account: 'ivan', id: 'rev-1', stars: 5, text: '' })
    ).rejects.toMatchObject({ code: 'MARKETPLACE_REVIEW_NOT_FOUND' });
  });
});

describe('скрытие отзыва администратором', () => {
  const hide = (over: Partial<SetStatusInput> = {}): SetStatusInput => ({
    coopname: COOP,
    actor_account: 'ant',
    id: 'rev-1',
    status: MarketplaceReviewStatuses.HIDDEN,
    reason: ' Оскорбления ',
    now: NOW,
    ...over,
  });

  // mkt.review.happy.04
  it('скрытие записывает, кто, когда и почему', async () => {
    const { service, reviews } = build();
    reviews.findById.mockResolvedValue(makeReview());

    await service.setStatus(hide());

    expect(reviews.setStatus).toHaveBeenCalledWith('rev-1', {
      status: MarketplaceReviewStatuses.HIDDEN,
      hidden_by: 'ant',
      hidden_at: NOW,
      hidden_reason: 'Оскорбления',
    });
  });

  // mkt.review.side.10
  it.each([null, '', '   '])('скрытие без причины (%p) — отказ', async (reason) => {
    const { service, reviews } = build();
    reviews.findById.mockResolvedValue(makeReview());

    await expect(service.setStatus(hide({ reason }))).rejects.toMatchObject({
      code: 'MARKETPLACE_REVIEW_HIDE_REASON_REQUIRED',
    });
    expect(reviews.setStatus).not.toHaveBeenCalled();
  });

  // mkt.review.happy.05
  it('возврат в публикацию очищает сведения о скрытии', async () => {
    const { service, reviews } = build();
    reviews.findById.mockResolvedValue(
      makeReview({ status: MarketplaceReviewStatuses.HIDDEN, hidden_by: 'ant', hidden_at: NOW, hidden_reason: 'x' })
    );

    await service.setStatus(hide({ status: MarketplaceReviewStatuses.PUBLISHED, reason: null }));

    expect(reviews.setStatus).toHaveBeenCalledWith('rev-1', {
      status: MarketplaceReviewStatuses.PUBLISHED,
      hidden_by: null,
      hidden_at: null,
      hidden_reason: null,
    });
  });

  // mkt.review.side.11
  it('публикация уже опубликованного отзыва ничего не пишет', async () => {
    const { service, reviews } = build();
    reviews.findById.mockResolvedValue(makeReview());

    await service.setStatus(hide({ status: MarketplaceReviewStatuses.PUBLISHED, reason: null }));

    expect(reviews.setStatus).not.toHaveBeenCalled();
  });

  // mkt.review.side.12
  it('отзыва нет — «не найдено»', async () => {
    const { service } = build();

    await expect(service.setStatus(hide())).rejects.toMatchObject({ code: 'MARKETPLACE_REVIEW_NOT_FOUND' });
  });
});

describe('список отзывов: скрытые видит только модератор', () => {
  // mkt.review.side.13
  it('пайщик без права модерации получает только опубликованные, даже если попросил скрытые', async () => {
    const { service, reviews } = build();

    await service.list(
      { coopname: COOP, offer_id: 'off-1', include_hidden: true, status: MarketplaceReviewStatuses.HIDDEN },
      PAGE,
      { can_moderate: false }
    );

    expect(reviews.list).toHaveBeenCalledWith(
      expect.objectContaining({ coopname: COOP, offer_id: 'off-1', status: MarketplaceReviewStatuses.PUBLISHED }),
      PAGE
    );
  });

  // mkt.review.side.14
  it('модератор без просьбы о скрытых тоже получает только опубликованные', async () => {
    const { service, reviews } = build();

    await service.list({ coopname: COOP, supplier_account: 'sup1' }, PAGE, { can_moderate: true });

    expect(reviews.list).toHaveBeenCalledWith(
      expect.objectContaining({ supplier_account: 'sup1', status: MarketplaceReviewStatuses.PUBLISHED }),
      PAGE
    );
  });

  // mkt.review.happy.06
  it('модератор с просьбой о скрытых получает отзывы любого статуса либо выбранного', async () => {
    const { service, reviews } = build();

    await service.list({ coopname: COOP, include_hidden: true }, PAGE, { can_moderate: true });
    expect(reviews.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: undefined }), PAGE);

    await service.list(
      { coopname: COOP, include_hidden: true, status: MarketplaceReviewStatuses.HIDDEN },
      PAGE,
      { can_moderate: true }
    );
    expect(reviews.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: MarketplaceReviewStatuses.HIDDEN }),
      PAGE
    );
  });

  // mkt.review.side.15
  it('отзыв по заказу отдаётся только его автору — и скрытый тоже', async () => {
    const { service, reviews } = build();
    reviews.findByOrder.mockResolvedValue(makeReview({ status: MarketplaceReviewStatuses.HIDDEN }));

    await expect(service.findMineByOrder(COOP, 'ivan', 'ord-1')).resolves.toMatchObject({ id: 'rev-1' });
    await expect(service.findMineByOrder(COOP, 'petr', 'ord-1')).resolves.toBeNull();
  });
});

describe('сводная оценка предложения для карточек каталога', () => {
  // mkt.review.happy.07
  it('обращения одной страницы каталога складываются в один запрос к базе', async () => {
    const { service, reviews } = build();
    reviews.ratingsByOffers.mockResolvedValue(new Map([['off-1', { rating_avg: 4.5, reviews_count: 2 }]]));

    const [first, again, empty] = await Promise.all([
      service.ratingOfOffer(COOP, 'off-1'),
      service.ratingOfOffer(COOP, 'off-1'),
      service.ratingOfOffer(COOP, 'off-2'),
    ]);

    expect(reviews.ratingsByOffers).toHaveBeenCalledTimes(1);
    expect(reviews.ratingsByOffers).toHaveBeenCalledWith(COOP, ['off-1', 'off-2']);
    expect(first).toEqual({ rating_avg: 4.5, reviews_count: 2 });
    expect(again).toEqual(first);
    // Предложение без отзывов: оценки нет, счётчик ноль.
    expect(empty).toEqual({ rating_avg: null, reviews_count: 0 });
  });

  // mkt.review.side.16
  it('следующая страница — новый запрос: оценки между запросами не запоминаются', async () => {
    const { service, reviews } = build();

    await service.ratingOfOffer(COOP, 'off-1');
    await service.ratingOfOffer(COOP, 'off-1');

    expect(reviews.ratingsByOffers).toHaveBeenCalledTimes(2);
  });
});
