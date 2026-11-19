/**
 * Повтор уценки, не дошедшей до цепи (задача 99D-15).
 *
 * Закрывающая подпись выдачи цепью принята, уценка идёт best-effort. Раньше
 * сбой только писался в журнал: уценка навсегда оставалась на счёте 10. Крон
 * довозит её по состоянию зеркала заказа. Выплату поставщику довозит обход
 * пакетов выплаты (marketplace-supplier-payout.test.ts).
 */
import { MarketplaceChainRetryCronService } from '~/extensions/marketplace/application/services/marketplace-chain-retry-cron.service';

const COOP = 'voskhod';

function buildService() {
  const orderRepo = {
    listMarkdownPending: jest.fn(async () => []),
    findByOrderHash: jest.fn(async () => null),
  };
  const chainPort = { markdown: jest.fn(async () => ({})) };
  const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() };
  const service = new MarketplaceChainRetryCronService(
    orderRepo as never,
    chainPort as never,
    { symbol: 'RUB', decimals: 4 } as never,
    logger as never
  );
  return { service, orderRepo, chainPort, logger };
}

describe('Повтор уценки, не дошедшей до цепи', () => {
  it('заказ с рассчитанной уценкой без зеркала на цепи получает повторный markdown на ту же сумму', async () => {
    const { service, orderRepo, chainPort } = buildService();
    orderRepo.listMarkdownPending.mockResolvedValue([
      { order_hash: 'h1', markdown_due: '200.0000', markdown_cost: null },
    ] as never);

    const res = await service.retryMarkdowns(COOP);

    expect(res).toEqual({ sent: 1, failed: 0 });
    expect(chainPort.markdown).toHaveBeenCalledWith({ coopname: COOP, order_hash: 'h1', amount: '200.0000 RUB' });
  });

  it('сбой цепи не роняет прогон: заказ остаётся кандидатом, отказ виден в журнале', async () => {
    const { service, orderRepo, chainPort, logger } = buildService();
    orderRepo.listMarkdownPending.mockResolvedValue([
      { order_hash: 'h1', markdown_due: '200.0000', markdown_cost: null },
      { order_hash: 'h2', markdown_due: '50.0000', markdown_cost: null },
    ] as never);
    chainPort.markdown.mockRejectedValueOnce(new Error('цепь недоступна'));

    const res = await service.retryMarkdowns(COOP);

    expect(res).toEqual({ sent: 1, failed: 1 });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('цепь недоступна'));
  });
});
