/**
 * Решение совета по заявлению на материальную помощь (решение владельца
 * 04.11.2026): платёж кассиру появляется только после решения совета.
 *
 * При подаче узел сохраняет заявку на выплату с реквизитами — платежа нет,
 * кассир ничего не видит. `onaidauth` создаёт платёж из заявки, `onaiddecl`
 * закрывает заявку. Повтор события по решённому заявлению ничего не меняет и
 * второе уведомление не шлёт.
 */
import { InnerPayoutRequestStatus, PaymentStatus } from '@coopenomics/innercoop';
import { MarketplaceAidCouncilSyncService } from '~/extensions/marketplace/application/services/marketplace-aid-council-sync.service';
import { MARKETPLACE_AID_COUNCIL_DECIDED_EVENT } from '~/extensions/marketplace/application/events/marketplace-notification.events';

const COOP = 'voskhod';
const HASH = 'AB'.repeat(32);
const KEY = HASH.toLowerCase();

const request = (status: InnerPayoutRequestStatus) => ({
  hash: KEY,
  coopname: COOP,
  username: 'ivanpetrov',
  quantity: 300,
  symbol: 'RUB',
  status,
  created_at: new Date(),
});

function build(opts: { request?: InnerPayoutRequestStatus | null; legacyPayment?: PaymentStatus | null } = {}) {
  const desk = {
    getPayoutRequest: jest.fn().mockResolvedValue(opts.request ? request(opts.request) : null),
    getPayments: jest.fn().mockResolvedValue({
      items: opts.legacyPayment
        ? [{ id: 'p1', coopname: COOP, username: 'ivanpetrov', quantity: 300, symbol: 'RUB', status: opts.legacyPayment }]
        : [],
    }),
    releasePayoutRequest: jest.fn().mockResolvedValue({ id: 'p-new', status: PaymentStatus.PENDING }),
    declinePayoutRequest: jest.fn().mockResolvedValue(undefined),
    setPaymentStatus: jest.fn(),
  } as any;
  const eventBus = { emit: jest.fn() } as any;
  const logger = { setContext: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn(), log: jest.fn() } as any;
  const service = new MarketplaceAidCouncilSyncService(desk, eventBus, logger);
  return { service, desk, eventBus };
}

const action = (data: Record<string, unknown>) => ({ data }) as any;

describe('mkt.aid.council — решение совета по матпомощи создаёт платёж кассиру', () => {
  it('совет одобрил: платёж создаётся из заявки, пайщик получает уведомление с суммой заявки', async () => {
    const { service, desk, eventBus } = build({ request: InnerPayoutRequestStatus.AWAITING });

    await service.handleCouncilAuthorized(action({ coopname: COOP, hash: HASH }));

    expect(desk.releasePayoutRequest).toHaveBeenCalledWith(KEY);
    // Статус платежа напрямую не трогается: платежа до решения не было.
    expect(desk.setPaymentStatus).not.toHaveBeenCalled();
    expect(eventBus.emit).toHaveBeenCalledWith(
      MARKETPLACE_AID_COUNCIL_DECIDED_EVENT,
      expect.objectContaining({ member_account: 'ivanpetrov', amount: '300 RUB', approved: true })
    );
  });

  it('совет отказал: заявка закрывается, платёж не создаётся', async () => {
    const { service, desk, eventBus } = build({ request: InnerPayoutRequestStatus.AWAITING });

    await service.handleCouncilDeclined(action({ coopname: COOP, hash: HASH, reason: 'нет оснований' }));

    expect(desk.declinePayoutRequest).toHaveBeenCalledWith(KEY);
    expect(desk.releasePayoutRequest).not.toHaveBeenCalled();
    expect(eventBus.emit).toHaveBeenCalledWith(
      MARKETPLACE_AID_COUNCIL_DECIDED_EVENT,
      expect.objectContaining({ approved: false, reason: 'нет оснований' })
    );
  });

  it('повтор события по решённой заявке ничего не меняет и уведомление не дублирует', async () => {
    const { service, desk, eventBus } = build({ request: InnerPayoutRequestStatus.RELEASED });

    await service.handleCouncilAuthorized(action({ coopname: COOP, hash: HASH }));

    expect(desk.releasePayoutRequest).not.toHaveBeenCalled();
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('платёж «ожидает решения совета», заведённый до заявок, решение совета переводит кассиру', async () => {
    const { service, desk } = build({ request: null, legacyPayment: PaymentStatus.AWAITING_AUTHORIZATION });

    await service.handleCouncilAuthorized(action({ coopname: COOP, hash: HASH }));

    expect(desk.releasePayoutRequest).toHaveBeenCalledWith(KEY);
  });

  it('ни заявки, ни ожидающего платежа — решение не к чему применить', async () => {
    const { service, desk, eventBus } = build({ request: null, legacyPayment: PaymentStatus.PENDING });

    await service.handleCouncilAuthorized(action({ coopname: COOP, hash: HASH }));

    expect(desk.releasePayoutRequest).not.toHaveBeenCalled();
    expect(eventBus.emit).not.toHaveBeenCalled();
  });
});
