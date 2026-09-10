/**
 * Повтор уценки и инициации выплаты, не дошедших до цепи (задача 99D-15).
 *
 * Закрывающие подписи цепь уже приняла, второй шаг (уценка, выплата) идёт
 * best-effort. Раньше сбой только писался в журнал: уценка навсегда
 * оставалась на счёте 10, выплату кассир не видел. Крон довозит недостающий
 * шаг по состоянию проекции и зеркала заказа.
 */
import { MarketplaceChainRetryCronService } from '~/extensions/marketplace/application/services/marketplace-chain-retry-cron.service';

const COOP = 'voskhod';

function buildService() {
  const orderRepo = {
    listMarkdownPending: jest.fn(async () => []),
    findByOrderHash: jest.fn(async () => null),
  };
  const paymentRepo = { listAll: jest.fn(async () => []) };
  const chainPort = { markdown: jest.fn(async () => ({})) };
  const receptionService = { redeliverPayout: jest.fn(async () => undefined) };
  const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() };
  const service = new MarketplaceChainRetryCronService(
    orderRepo as never,
    paymentRepo as never,
    chainPort as never,
    receptionService as never,
    { symbol: 'RUB', decimals: 4 } as never,
    logger as never
  );
  return { service, orderRepo, paymentRepo, chainPort, receptionService, logger };
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

describe('Повтор инициации выплаты поставщику', () => {
  const projection = (over: Record<string, unknown> = {}) => ({
    order_hash: 'h1',
    amount: '800.0000',
    core_payment_id: 'core-1',
    ...over,
  });

  it('цепь выплату не приняла — повторяется marketplace::payout', async () => {
    const { service, orderRepo, paymentRepo, receptionService } = buildService();
    paymentRepo.listAll.mockResolvedValue([projection()] as never);
    orderRepo.findByOrderHash.mockResolvedValue({ on_chain_present: true, payout_status: null } as never);

    const res = await service.retryPayouts(COOP);

    expect(res).toEqual({ redelivered: 1 });
    expect(receptionService.redeliverPayout).toHaveBeenCalledWith(
      expect.objectContaining({ order_hash: 'h1' }),
      { createCorePayment: false, submitChain: true }
    );
  });

  it('на цепи выплата ждёт кассира, а платежа в общем реестре нет — довозится только платёж', async () => {
    const { service, orderRepo, paymentRepo, receptionService } = buildService();
    paymentRepo.listAll.mockResolvedValue([projection({ core_payment_id: null })] as never);
    orderRepo.findByOrderHash.mockResolvedValue({ on_chain_present: true, payout_status: 'pending' } as never);

    await service.retryPayouts(COOP);

    expect(receptionService.redeliverPayout).toHaveBeenCalledWith(expect.anything(), {
      createCorePayment: true,
      submitChain: false,
    });
  });

  it('выплата на цепи есть и платёж создан — повторять нечего', async () => {
    const { service, orderRepo, paymentRepo, receptionService } = buildService();
    paymentRepo.listAll.mockResolvedValue([projection()] as never);
    orderRepo.findByOrderHash.mockResolvedValue({ on_chain_present: true, payout_status: 'pending' } as never);

    const res = await service.retryPayouts(COOP);

    expect(res).toEqual({ redelivered: 0 });
    expect(receptionService.redeliverPayout).not.toHaveBeenCalled();
  });

  it('заказа на цепи уже нет — выплата закрыта им самим, повтор не идёт', async () => {
    const { service, orderRepo, paymentRepo, receptionService } = buildService();
    paymentRepo.listAll.mockResolvedValue([projection({ core_payment_id: null })] as never);
    orderRepo.findByOrderHash.mockResolvedValue({ on_chain_present: false, payout_status: null } as never);

    await service.retryPayouts(COOP);

    expect(receptionService.redeliverPayout).not.toHaveBeenCalled();
  });

  it('долг покрыл всю выплату — платёж кассиру не создаётся, но инициация на цепи повторяется', async () => {
    const { service, orderRepo, paymentRepo, receptionService } = buildService();
    paymentRepo.listAll.mockResolvedValue([projection({ amount: '0.0000', core_payment_id: null })] as never);
    orderRepo.findByOrderHash.mockResolvedValue({ on_chain_present: true, payout_status: 'none' } as never);

    await service.retryPayouts(COOP);

    expect(receptionService.redeliverPayout).toHaveBeenCalledWith(expect.anything(), {
      createCorePayment: false,
      submitChain: true,
    });
  });
});
