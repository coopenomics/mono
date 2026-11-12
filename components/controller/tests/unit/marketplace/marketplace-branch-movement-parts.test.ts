/**
 * Панель движения по общему кошельку участка (замечание владельца 09.11.2026:
 * «изъятие на распределение — какое распределение, куда пошло?»). По хэшу
 * процесса узел отдаёт движения участка в этом процессе: у распределения —
 * изъятие из общего кошелька и зачисление каждому доверенному, у заказа —
 * взнос участку. Процесс чужого участка не раскрывается.
 * Реестр: mkt.eco.side.13.
 */
import type { InnerLedger2HistoryFilter, InnerLedger2Operation } from '@coopenomics/innercoop';
import { MarketplaceEconomyService } from '~/extensions/marketplace/application/services/marketplace-economy.service';

const COOP = 'voskhod';
const ROUND = 'ab'.repeat(32);

function op(over: Partial<InnerLedger2Operation>): InnerLedger2Operation {
  return {
    globalSequence: '1',
    blockNum: 1,
    coopname: COOP,
    action: 'apply',
    operationCode: 'o.brn.release',
    processHash: ROUND,
    username: 'krg',
    quantity: '100.0000 RUB',
    memo: 'Распределение членских взносов кооперативного участка',
    createdAt: new Date('2026-11-09T09:51:00Z'),
    ...over,
  };
}

function build(items: InnerLedger2Operation[], orders: Array<{ order_hash: string; id: string }> = []) {
  const ledger2History = {
    getHistory: jest.fn(async (filter: InnerLedger2HistoryFilter) => {
      const picked = items.filter(
        (i) => i.processHash === filter.processHash && (!filter.operationCodes || filter.operationCodes.includes(i.operationCode ?? ''))
      );
      return { items: picked, totalCount: picked.length, totalPages: 1, currentPage: 1 };
    }),
  };
  const orderRepo = { findByOrderHashes: jest.fn(async () => orders) };
  const service = new MarketplaceEconomyService(
    {} as any,
    {} as any,
    { symbol: 'RUB', decimals: 4 } as any,
    {} as any,
    ledger2History as any,
    {} as any,
    {} as any,
    orderRepo as any,
    {} as any,
    {} as any
  );
  return { service, ledger2History };
}

describe('mkt.eco.side.13 — движения участка в одном процессе для панели движения', () => {
  it('распределение: изъятия из общего кошелька и зачисления доверенным с именами получателей', async () => {
    const { service, ledger2History } = build([
      op({ globalSequence: '10', operationCode: 'o.brn.release', username: 'krg', quantity: '4845.6900 RUB' }),
      op({ globalSequence: '11', operationCode: 'o.brn.person', username: 'chairkrg', quantity: '4845.6900 RUB' }),
      op({ globalSequence: '12', operationCode: 'o.brn.release', username: 'krg', quantity: '100.0000 RUB' }),
      op({ globalSequence: '13', operationCode: 'o.brn.person', username: 'trustedkrg', quantity: '100.0000 RUB' }),
    ]);

    const parts = await service.getBranchMovementParts(COOP, 'krg', ROUND);

    expect(ledger2History.getHistory).toHaveBeenCalledWith(
      expect.objectContaining({ coopname: COOP, processHash: ROUND, actionNames: ['apply'], sortOrder: 'ASC' })
    );
    expect(parts.filter((p) => p.operation_code === 'o.brn.person').map((p) => [p.username, p.quantity])).toEqual([
      ['chairkrg', '4845.6900 RUB'],
      ['trustedkrg', '100.0000 RUB'],
    ]);
  });

  it('заказ: только операции участка — движения кошельков пайщика по заказу в панель не попадают; заказ найден по хэшу', async () => {
    const order = 'cd'.repeat(32);
    const { service } = build(
      [
        op({ globalSequence: '20', operationCode: 'o.mkt.charge', processHash: order, username: 'ivanpetrov' }),
        op({ globalSequence: '21', operationCode: 'o.mkt.retdue', processHash: order, username: 'ivanpetrov' }),
        op({ globalSequence: '22', operationCode: 'o.brn.common', processHash: order, username: 'krg', quantity: '380.0000 RUB' }),
      ],
      [{ order_hash: order, id: '42' }]
    );

    const parts = await service.getBranchMovementParts(COOP, 'krg', order);

    expect(parts.map((p) => p.operation_code)).toEqual(['o.brn.common']);
    expect(parts[0]).toMatchObject({ username: 'krg', quantity: '380.0000 RUB', order_id: '42' });
  });

  it('процесс чужого участка не раскрывается', async () => {
    const { service } = build([
      op({ operationCode: 'o.brn.release', username: 'odn' }),
      op({ operationCode: 'o.brn.person', username: 'chairodn' }),
    ]);

    await expect(service.getBranchMovementParts(COOP, 'krg', ROUND)).resolves.toEqual([]);
  });
});
