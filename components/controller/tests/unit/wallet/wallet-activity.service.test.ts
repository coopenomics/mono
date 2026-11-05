/**
 * Движения и неисполненные заявки на странице кошелька пайщика (решение
 * владельца 04.11.2026): под кошельками — история по всем кошелькам пайщика с
 * отбором по одному, над ней — что ещё в работе.
 *
 * Кошелёк и направление строки выводятся из реестра операций по коду: учётная
 * книга хранит операцию, а не то, чей это кошелёк. Ошибка здесь — пополнение,
 * показанное списанием, или чужая операция кооператива в истории пайщика.
 */
import { Ledger2 } from 'cooptypes';
import { WalletActivityService } from '~/application/wallet/services/wallet-activity.service';
import { WalletMovementDirection, WalletPendingState } from '~/application/wallet/dto/wallet-activity.dto';
import { PaymentDirectionEnum, PaymentTypeEnum } from '~/domain/gateway/enums/payment-type.enum';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import { PayoutRequestStatusEnum } from '~/domain/gateway/repositories/payout-request.repository';

const COOP = 'voskhod';

function op(code: string, extra: Record<string, unknown> = {}) {
  return { globalSequence: '1', createdAt: new Date('2026-11-04T10:00:00Z'), operationCode: code, quantity: '1000.0000 RUB', processHash: 'ab'.repeat(32), memo: null, ...extra };
}

function build(opts: { history?: any[]; requests?: any[]; payments?: any[] } = {}) {
  const ledger2 = {
    getHistory: jest.fn().mockResolvedValue({ items: opts.history ?? [], totalCount: (opts.history ?? []).length, totalPages: 1, currentPage: 1 }),
  } as any;
  const payments = { getAllPayments: jest.fn().mockResolvedValue({ items: opts.payments ?? [] }) } as any;
  const requests = { listAwaitingByMember: jest.fn().mockResolvedValue(opts.requests ?? []) } as any;
  return { service: new WalletActivityService(ledger2, payments, requests), ledger2 };
}

describe('wallet.activity.movements — движения по кошелькам пайщика', () => {
  it('пополнение — поступление, резерв под возврат — списание с паевого, выплата возврата из резерва — шаг процесса', async () => {
    const { service } = build({ history: [op('o.wal.depcpl'), op('o.wal.wthreq'), op('o.wal.wthcpl')] });

    const page = await service.movements({ coopname: COOP, username: 'ivan' });

    expect(page.items[0]).toMatchObject({ direction: WalletMovementDirection.IN, wallet_name: 'w.wal.share', operation_name: 'Внесение пайщиком паевого взноса' });
    expect(page.items[1]).toMatchObject({ direction: WalletMovementDirection.OUT, wallet_name: 'w.wal.share' });
    // Резерв под возврат — кошелёк кооператива: выплата не движение по кошелькам пайщика, но его история.
    expect(page.items[2]).toMatchObject({ direction: WalletMovementDirection.PROCESS, operation_name: 'Возврат паевого взноса пайщику' });
    expect(page.items[0].process_hash).toBe('ab'.repeat(32));
  });

  it('без отбора читается вся история этого пайщика, свежие сверху', async () => {
    const { service, ledger2 } = build();

    await service.movements({ coopname: COOP, username: 'ivan', page: 2, limit: 10 });

    const filter = ledger2.getHistory.mock.calls[0][0];
    expect(filter).toMatchObject({ coopname: COOP, username: 'ivan', actionNames: ['apply'], page: 2, limit: 10, sortOrder: 'DESC' });
    expect(filter.operationCodes).toBeUndefined();
  });

  it('отбор по кошельку: только операции этого кошелька; перевод между своими — относительно выбранного', async () => {
    const { service, ledger2 } = build({ history: [op('o.mkt.lock')] });

    const page = await service.movements({ coopname: COOP, username: 'ivan', wallet_name: 'w.wal.share' });

    const codes = ledger2.getHistory.mock.calls[0][0].operationCodes as string[];
    for (const code of codes) {
      const meta = Ledger2.getOperationMeta(code)!;
      expect([meta.wallet_from, meta.wallet_to]).toContain('w.wal.share');
    }
    // Блокировка под заказ: с паевого кошелька в кошелёк заказа — списание с выбранного.
    expect(page.items[0].direction).toBe(WalletMovementDirection.OUT);
  });

  it('без отбора перевод между своими кошельками показан переводом', async () => {
    const { service } = build({ history: [op('o.mkt.lock')] });

    const page = await service.movements({ coopname: COOP, username: 'ivan' });

    expect(page.items[0].direction).toBe(WalletMovementDirection.MOVE);
  });
});

describe('wallet.activity.pending — что у пайщика в работе', () => {
  it('заявка до решения совета, выплата у кассира и неоплаченное пополнение — новые сверху; исполненное не показывается', async () => {
    const { service } = build({
      requests: [{ hash: 'r1', type: PaymentTypeEnum.WITHDRAWAL, quantity: 1500, symbol: 'RUB', payment_method_id: 'm1', status: PayoutRequestStatusEnum.AWAITING, created_at: new Date('2026-11-04T12:00:00Z') }],
      payments: [
        { hash: 'p1', type: PaymentTypeEnum.AID, direction: PaymentDirectionEnum.OUTGOING, status: PaymentStatusEnum.PENDING, quantity: 300, symbol: 'RUB', payment_method_id: 'm1', created_at: new Date('2026-11-04T11:00:00Z') },
        { hash: 'p2', type: PaymentTypeEnum.DEPOSIT, direction: PaymentDirectionEnum.INCOMING, status: PaymentStatusEnum.PENDING, quantity: 5000, symbol: 'RUB', created_at: new Date('2026-11-04T10:00:00Z') },
        { hash: 'p3', type: PaymentTypeEnum.DEPOSIT, direction: PaymentDirectionEnum.INCOMING, status: PaymentStatusEnum.COMPLETED, quantity: 100, symbol: 'RUB', created_at: new Date('2026-11-04T09:00:00Z') },
      ],
    });

    const items = await service.pending({ coopname: COOP, username: 'ivan' });

    expect(items.map((i) => [i.hash, i.state])).toEqual([
      ['r1', WalletPendingState.COUNCIL_REVIEW],
      ['p1', WalletPendingState.AWAITING_CASHIER],
      ['p2', WalletPendingState.AWAITING_PAYMENT],
    ]);
    expect(items[0]).toMatchObject({ quantity: '1500.0000 RUB', payment_method_id: 'm1' });
  });

  it('название для пайщика — за что выплата, а не подпись кассира «Оплата»', async () => {
    const { service } = build({
      requests: [{ hash: 'r1', type: PaymentTypeEnum.WITHDRAWAL, quantity: 1500, symbol: 'RUB', payment_method_id: 'm1', status: PayoutRequestStatusEnum.AWAITING, created_at: new Date('2026-11-04T12:00:00Z') }],
      payments: [
        { hash: 'o1', type: PaymentTypeEnum.PAYMENT, direction: PaymentDirectionEnum.OUTGOING, status: PaymentStatusEnum.PENDING, quantity: 500, symbol: 'RUB', payment_method_id: 'm1', created_at: new Date('2026-11-04T11:00:00Z') },
      ],
    });

    const items = await service.pending({ coopname: COOP, username: 'ivan' });

    expect(items.map((i) => i.title)).toEqual(['Возврат паевого взноса', 'Выплата за имущество, переданное кооперативу']);
  });
});
