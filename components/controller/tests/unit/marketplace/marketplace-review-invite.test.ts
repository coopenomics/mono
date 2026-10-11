/**
 * Приглашение оставить отзыв (задача 598-61): через три часа после получения
 * заказа заказчику уходит одно уведомление со ссылкой на форму отзыва.
 * Проверяется, кого задача приглашает, что приглашение не повторяется и что
 * условия выборки отсекают заказы с отзывом и с уже отправленным приглашением.
 */
import { MARKETPLACE_REVIEW_INVITE_EVENT } from '~/extensions/marketplace/application/events/marketplace-notification.events';
import {
  MARKETPLACE_REVIEW_INVITE_AFTER_HOURS,
  MARKETPLACE_REVIEW_INVITE_WINDOW_HOURS,
  MarketplaceReviewInviteCronService,
} from '~/extensions/marketplace/application/services/marketplace-review-invite-cron.service';
import { MarketplaceReviewRepositoryAdapter } from '~/extensions/marketplace/infrastructure/adapters/marketplace-review-repository.adapter';
import { MARKETPLACE_REVIEW_STORE, marketplaceStoreProviders } from '~/extensions/marketplace/infrastructure/database/marketplace-stores';
import { recordingKysely, type ScriptedResult } from '../helpers/kysely-recorder';
import { storeFrom } from '../helpers/table-store';

const COOP = 'voskhod';
const NOW = new Date('2026-10-11T12:00:00.000Z');
const HOUR_MS = 60 * 60 * 1000;

const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), log: jest.fn(), error: jest.fn(), debug: jest.fn() };

function cron(reviews: Record<string, jest.Mock>) {
  const eventBus = { emit: jest.fn() };
  const service = new MarketplaceReviewInviteCronService(reviews as never, eventBus as never, logger as never);
  return { service, eventBus };
}

const candidate = (order_id: string) => ({ order_id, orderer_account: 'ant', product_name: 'Молоко' });

describe('задача приглашения оставить отзыв', () => {
  // mkt.review.invite.happy.01
  it('берёт заказы, полученные от трёх часов до двух суток назад, и шлёт по одному приглашению', async () => {
    const reviews = {
      listOrdersAwaitingInvite: jest.fn().mockResolvedValue([candidate('o1'), candidate('o2')]),
      claimInvite: jest.fn().mockResolvedValue(true),
    };
    const { service, eventBus } = cron(reviews);

    const result = await service.inviteReceived(COOP, NOW);

    expect(result).toEqual({ invited: 2 });
    const [coopname, receivedFrom, receivedTo, limit] = reviews.listOrdersAwaitingInvite.mock.calls[0];
    expect(coopname).toBe(COOP);
    expect(receivedFrom).toEqual(new Date(NOW.getTime() - MARKETPLACE_REVIEW_INVITE_WINDOW_HOURS * HOUR_MS));
    expect(receivedTo).toEqual(new Date(NOW.getTime() - MARKETPLACE_REVIEW_INVITE_AFTER_HOURS * HOUR_MS));
    expect(limit).toBeGreaterThan(0);
    expect(reviews.claimInvite).toHaveBeenCalledWith(COOP, 'o1', NOW);
    expect(eventBus.emit).toHaveBeenCalledTimes(2);
    expect(eventBus.emit).toHaveBeenCalledWith(MARKETPLACE_REVIEW_INVITE_EVENT, {
      coopname: COOP,
      order_id: 'o1',
      orderer_account: 'ant',
      product_name: 'Молоко',
    });
  });

  // mkt.review.invite.side.01
  it('заказ, отметку по которому поставил другой прогон, второй раз не приглашает', async () => {
    const reviews = {
      listOrdersAwaitingInvite: jest.fn().mockResolvedValue([candidate('o1'), candidate('o2')]),
      claimInvite: jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),
    };
    const { service, eventBus } = cron(reviews);

    expect(await service.inviteReceived(COOP, NOW)).toEqual({ invited: 1 });
    expect(eventBus.emit).toHaveBeenCalledTimes(1);
    expect(eventBus.emit.mock.calls[0][1]).toMatchObject({ order_id: 'o2' });
  });

  // mkt.review.invite.side.02
  it('сбой выборки и сбой по одному заказу остальных не останавливают', async () => {
    const broken = cron({ listOrdersAwaitingInvite: jest.fn().mockRejectedValue(new Error('db down')), claimInvite: jest.fn() });
    expect(await broken.service.inviteReceived(COOP, NOW)).toEqual({ invited: 0 });
    expect(broken.eventBus.emit).not.toHaveBeenCalled();

    const reviews = {
      listOrdersAwaitingInvite: jest.fn().mockResolvedValue([candidate('o1'), candidate('o2')]),
      claimInvite: jest.fn().mockRejectedValueOnce(new Error('lock timeout')).mockResolvedValueOnce(true),
    };
    const partial = cron(reviews);
    expect(await partial.service.inviteReceived(COOP, NOW)).toEqual({ invited: 1 });
    expect(partial.eventBus.emit.mock.calls[0][1]).toMatchObject({ order_id: 'o2' });
  });
});

describe('хранилище: заказы без отзыва и отметка приглашения', () => {
  function setup(results: ScriptedResult[]) {
    const { db, queries } = recordingKysely(results);
    const repo = new MarketplaceReviewRepositoryAdapter(storeFrom(marketplaceStoreProviders, MARKETPLACE_REVIEW_STORE, db) as never);
    return { repo, queries };
  }

  // mkt.review.invite.side.03
  it('выборка отсекает заказы с отзывом, с отправленным приглашением и вне промежутка получения', async () => {
    const { repo, queries } = setup([{ rows: [{ order_id: 'o1', orderer_account: 'ant', product_name: null }] }]);
    const from = new Date(NOW.getTime() - 48 * HOUR_MS);
    const to = new Date(NOW.getTime() - 3 * HOUR_MS);

    const found = await repo.listOrdersAwaitingInvite(COOP, from, to, 100);

    expect(found).toEqual([{ order_id: 'o1', orderer_account: 'ant', product_name: '' }]);
    const sql = queries[0].sql.replace(/\s+/g, ' ');
    expect(sql).toContain("o.status = 'RECEIVED'");
    expect(sql).toContain('o.review_invited_at IS NULL');
    expect(sql).toContain('o.received_at > $2 AND o.received_at <= $3');
    expect(sql).toContain('NOT EXISTS (SELECT 1 FROM marketplace_review r WHERE r.coopname = o.coopname AND r.order_id = o.id)');
    expect(sql).toContain('ORDER BY o.received_at ASC LIMIT $4');
    expect(queries[0].parameters).toEqual([COOP, from, to, 100]);
  });

  // mkt.review.invite.side.04
  it('отметка ставится только на заказ без отметки и сообщает, поставлена ли она', async () => {
    const { repo, queries } = setup([{ rows: [{ id: 'o1' }] }, { rows: [] }]);

    expect(await repo.claimInvite(COOP, 'o1', NOW)).toBe(true);
    expect(await repo.claimInvite(COOP, 'o1', NOW)).toBe(false);

    const sql = queries[0].sql.replace(/\s+/g, ' ');
    expect(sql).toContain('UPDATE marketplace_order SET review_invited_at = $3');
    expect(sql).toContain('WHERE coopname = $1 AND id = $2 AND review_invited_at IS NULL');
    expect(queries[0].parameters).toEqual([COOP, 'o1', NOW]);
  });
});
