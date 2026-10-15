/**
 * Выдача из бандла: заявления по позициям подаются параллельно, до предела из
 * конфига расширения. По одной восемь позиций шли 37 с, и браузер обрывал
 * запрос по таймауту (тестнет, 11.09.2026). Проверяются предел одновременности,
 * порядок ответа, доведение всех позиций при сбое одной и то, что бандл не
 * принимается, пока поданы не все.
 */
import { ConflictException } from '@nestjs/common';
import { MarketplaceStockProposalService } from '~/extensions/marketplace/application/services/marketplace-stock-proposal.service';
import { mapSettledWithConcurrency } from '~/extensions/marketplace/application/shared/concurrency.util';
import { MarketplaceStockProposalDomainEntity } from '~/extensions/marketplace/domain/entities/marketplace-stock-proposal.entity';
import {
  MarketplaceStockProposalStatuses,
  type MarketplaceStockProposalItem,
  type MarketplaceStockProposalStatus,
} from '~/extensions/marketplace/domain/entities/marketplace-stock-proposal.types';

const COOP = 'voskhod';
const MEMBER = 'ant';

function item(n: number): MarketplaceStockProposalItem {
  return {
    offer_id: `offer-${n}`,
    quantity: 1,
    unit_price: '100.0000',
    product_name: `Товар ${n}`,
    unit_of_measure: null,
    order_id: `order-${n}`,
    order_hash: `hash-${n}`,
  };
}

function proposal(count: number, status: MarketplaceStockProposalStatus = MarketplaceStockProposalStatuses.PROPOSED) {
  const now = new Date();
  return new MarketplaceStockProposalDomainEntity({
    id: 'proposal-1',
    coopname: COOP,
    braname: 'krg',
    member_account: MEMBER,
    operator_account: 'chairkrg',
    items: Array.from({ length: count }, (_, i) => item(i + 1)),
    status,
    created_order_ids: [],
    resolved_at: null,
    created_at: now,
    updated_at: now,
  });
}

function signedInput(count: number) {
  return {
    order_lines: Array.from({ length: count }, (_, i) => ({ order_hash: `hash-${i + 1}`, signed_statement: { hash: `s-${i + 1}` } })),
    signed_convert: null,
  } as any;
}

/** Задержка, управляемая тестом: позиция завершается, когда её отпустят. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

function build(count: number, parallel: number | null) {
  const base = proposal(count);
  const proposalRepo = {
    findById: jest.fn(async () => base),
    applyResolution: jest.fn(async () => proposal(count, MarketplaceStockProposalStatuses.ACCEPTED)),
  };
  const issuanceService = {
    readyIssue: jest.fn(),
    fixFact: jest.fn(),
    submitStatement: jest.fn(),
  };
  const extensionConfig = {
    get: jest.fn(async () => (parallel === null ? null : { issuance: { parallel_statements: parallel } })),
  };
  const eventBus = { emit: jest.fn() };
  const logger = { setContext: jest.fn(), log: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const service = new MarketplaceStockProposalService(
    proposalRepo as any,
    {} as any,
    {} as any,
    {} as any,
    issuanceService as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    extensionConfig as any,
    eventBus as any,
    logger as any
  );
  // План бандла без перевода в членский кошелёк: проверяется только фаза заявлений.
  jest.spyOn(service as any, 'planBundle').mockResolvedValue({ fee_convert_units: 0n, transfer_units: 0n, convert_targets: [] });
  return { service, proposalRepo, issuanceService, extensionConfig, eventBus };
}

describe('mapSettledWithConcurrency', () => {
  it('держит не больше предела задач, доводит все и отдаёт результаты в порядке входа', async () => {
    let active = 0;
    let peak = 0;
    const results = await mapSettledWithConcurrency([30, 10, 20, 5, 15], 2, async (ms, index) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, ms));
      active -= 1;
      if (index === 2) throw new Error('сбой третьей');
      return ms * 2;
    });
    expect(peak).toBe(2);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled', 'rejected', 'fulfilled', 'fulfilled']);
    expect((results[0] as PromiseFulfilledResult<number>).value).toBe(60);
    expect((results[4] as PromiseFulfilledResult<number>).value).toBe(30);
  });

  it('пустой вход — пустой результат, некорректный предел трактуется как 1', async () => {
    await expect(mapSettledWithConcurrency([], 4, async () => 1)).resolves.toEqual([]);
    const results = await mapSettledWithConcurrency([1, 2], 0, async (x) => x);
    expect(results).toEqual([
      { status: 'fulfilled', value: 1 },
      { status: 'fulfilled', value: 2 },
    ]);
  });
});

describe('finalizeStockIssuance: параллельная подача заявлений', () => {
  it('подаёт позиции одновременно не больше предела из конфига', async () => {
    const { service, issuanceService } = build(5, 2);
    const gates = Array.from({ length: 5 }, () => deferred<any>());
    let active = 0;
    let peak = 0;
    issuanceService.submitStatement.mockImplementation(async (input: { order_id: string }) => {
      const index = Number(input.order_id.split('-')[1]) - 1;
      active += 1;
      peak = Math.max(peak, active);
      try {
        return await gates[index].promise;
      } finally {
        active -= 1;
      }
    });

    const pending = service.finalizeStockIssuance(COOP, 'proposal-1', MEMBER, signedInput(5));
    await flush();
    expect(issuanceService.submitStatement).toHaveBeenCalledTimes(2);
    gates[0].resolve({ id: 'saga-1' });
    await flush();
    expect(issuanceService.submitStatement).toHaveBeenCalledTimes(3);
    gates.forEach((g, i) => g.resolve({ id: `saga-${i + 1}` }));
    await pending;

    expect(peak).toBe(2);
    expect(issuanceService.submitStatement).toHaveBeenCalledTimes(5);
  });

  it('ответ в порядке бандла, даже если позиции завершились в обратном порядке', async () => {
    const { service, issuanceService, proposalRepo } = build(3, 3);
    const gates = Array.from({ length: 3 }, () => deferred<any>());
    issuanceService.submitStatement.mockImplementation((input: { order_id: string }) => gates[Number(input.order_id.split('-')[1]) - 1].promise);

    const pending = service.finalizeStockIssuance(COOP, 'proposal-1', MEMBER, signedInput(3));
    await flush();
    gates[2].resolve({ id: 'saga-3' });
    await flush();
    gates[1].resolve({ id: 'saga-2' });
    await flush();
    gates[0].resolve({ id: 'saga-1' });
    const result = await pending;

    expect(result.order_ids).toEqual(['order-1', 'order-2', 'order-3']);
    expect(result.sagas.map((s: any) => s.id)).toEqual(['saga-1', 'saga-2', 'saga-3']);
    expect(proposalRepo.applyResolution).toHaveBeenCalledWith(
      'proposal-1',
      MarketplaceStockProposalStatuses.PROPOSED,
      MarketplaceStockProposalStatuses.ACCEPTED,
      ['order-1', 'order-2', 'order-3']
    );
  });

  it('сбой одной позиции не прерывает остальные; ошибка после всех, бандл не принят', async () => {
    const { service, issuanceService, proposalRepo } = build(4, 2);
    const chainError = new ConflictException('Заявление не принято цепью: нехватка. Повторите подписание.');
    issuanceService.submitStatement.mockImplementation(async (input: { order_id: string }) => {
      if (input.order_id === 'order-1') throw chainError;
      return { id: `saga-${input.order_id}` };
    });

    await expect(service.finalizeStockIssuance(COOP, 'proposal-1', MEMBER, signedInput(4))).rejects.toBe(chainError);
    expect(issuanceService.submitStatement).toHaveBeenCalledTimes(4);
    expect(proposalRepo.applyResolution).not.toHaveBeenCalled();
  });

  it('несколько сбоев — одна понятная ошибка с числом и названиями позиций', async () => {
    const { service, issuanceService, proposalRepo } = build(5, 3);
    issuanceService.submitStatement.mockImplementation(async (input: { order_id: string }) => {
      if (input.order_id === 'order-2' || input.order_id === 'order-5') throw new Error(`отказ ${input.order_id}`);
      return { id: `saga-${input.order_id}` };
    });

    const error = await service.finalizeStockIssuance(COOP, 'proposal-1', MEMBER, signedInput(5)).catch((e) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect(error.message).toContain('по 2 позициям из 5');
    expect(error.message).toContain('«Товар 2»: отказ order-2');
    expect(error.message).toContain('«Товар 5»: отказ order-5');
    expect(issuanceService.submitStatement).toHaveBeenCalledTimes(5);
    expect(proposalRepo.applyResolution).not.toHaveBeenCalled();
  });

  it('без конфига расширения предел берётся из умолчаний (4)', async () => {
    const { service, issuanceService } = build(6, null);
    const gates = Array.from({ length: 6 }, () => deferred<any>());
    issuanceService.submitStatement.mockImplementation((input: { order_id: string }) => gates[Number(input.order_id.split('-')[1]) - 1].promise);

    const pending = service.finalizeStockIssuance(COOP, 'proposal-1', MEMBER, signedInput(6));
    await flush();
    expect(issuanceService.submitStatement).toHaveBeenCalledTimes(4);
    gates.forEach((g, i) => g.resolve({ id: `saga-${i + 1}` }));
    await pending;
    expect(issuanceService.submitStatement).toHaveBeenCalledTimes(6);
  });
});
