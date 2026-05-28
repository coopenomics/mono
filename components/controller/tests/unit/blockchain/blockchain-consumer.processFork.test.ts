// parser2 — ESM-only пакет; в unit-тестах нам он не нужен, мокаем как virtual,
// иначе jest падает с "Cannot find module" на import top-level.
jest.mock('@coopenomics/parser2', () => ({ ParserClient: class {} }), { virtual: true });

/**
 * Unit-тесты BlockchainConsumerService.processFork (Story 4.1, ADR-005).
 *
 * Контрактные инварианты:
 * - Порядок шагов: forkRegistry.runAll → consumerDedup.deleteAfterBlock → saveFork → (deprecated emit).
 * - Ошибка в runAll останавливает цепочку: дальнейшие шаги НЕ вызываются, ошибка пробрасывается.
 * - Ошибка в deleteAfterBlock останавливает saveFork.
 * - blockNum прокидывается одинаково во все шаги.
 * - markEventApplied в process{Action,Delta} вызывается с block_num.
 */

import { BlockchainConsumerService } from '~/infrastructure/blockchain/blockchain-consumer.service';

function makeLoggerStub(): any {
  return {
    setContext: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function makeEventsServiceStub(): any {
  return {
    emit: jest.fn(),
    emitAsyncWithTimeout: jest.fn(async () => true),
  };
}

function makeParserInteractorStub(): any {
  return {
    saveFork: jest.fn(async () => undefined),
    saveDelta: jest.fn(async () => undefined),
    saveAction: jest.fn(async () => undefined),
    isEventApplied: jest.fn(async () => false),
    markEventApplied: jest.fn(async () => undefined),
    deleteDedupAfterBlock: jest.fn(async () => 0),
  };
}

function makeForkRegistryStub(): any {
  return {
    runAll: jest.fn(async () => undefined),
    size: jest.fn(() => 0),
  };
}

function makeService(overrides: {
  logger?: any;
  events?: any;
  parserInteractor?: any;
  forkRegistry?: any;
}) {
  const logger = overrides.logger ?? makeLoggerStub();
  const events = overrides.events ?? makeEventsServiceStub();
  const parser = overrides.parserInteractor ?? makeParserInteractorStub();
  const fork = overrides.forkRegistry ?? makeForkRegistryStub();
  const service = new BlockchainConsumerService(logger, events, parser, fork);
  return { service, logger, events, parser, fork };
}

describe('BlockchainConsumerService.processFork (Story 4.1)', () => {
  it('вызывает шаги В ПРАВИЛЬНОМ ПОРЯДКЕ: runAll → deleteDedupAfterBlock → saveFork → emit', async () => {
    const calls: string[] = [];
    const parser = makeParserInteractorStub();
    parser.deleteDedupAfterBlock.mockImplementation(async () => {
      calls.push('deleteDedupAfterBlock');
      return 0;
    });
    parser.saveFork.mockImplementation(async () => {
      calls.push('saveFork');
    });
    const fork = makeForkRegistryStub();
    fork.runAll.mockImplementation(async () => {
      calls.push('runAll');
    });
    const events = makeEventsServiceStub();
    events.emitAsyncWithTimeout.mockImplementation(async () => {
      calls.push('emit');
      return true;
    });

    const { service } = makeService({ events, parserInteractor: parser, forkRegistry: fork });
    await (service as any).processFork(100);

    expect(calls).toEqual(['runAll', 'deleteDedupAfterBlock', 'saveFork', 'emit']);
  });

  it('прокидывает forked_from_block во ВСЕ шаги (один и тот же N)', async () => {
    const parser = makeParserInteractorStub();
    const fork = makeForkRegistryStub();
    const events = makeEventsServiceStub();
    const { service } = makeService({ events, parserInteractor: parser, forkRegistry: fork });

    await (service as any).processFork(12345);

    expect(fork.runAll).toHaveBeenCalledWith(12345);
    expect(parser.deleteDedupAfterBlock).toHaveBeenCalledWith(12345);
    expect(parser.saveFork).toHaveBeenCalledWith(expect.objectContaining({ block_num: 12345 }));
    expect(events.emitAsyncWithTimeout).toHaveBeenCalledWith(
      'fork::12345',
      expect.objectContaining({ block_num: 12345 }),
      expect.any(Number)
    );
  });

  it('ошибка в forkRegistry.runAll: deleteDedupAfterBlock и saveFork НЕ вызываются, ошибка пробрасывается', async () => {
    const parser = makeParserInteractorStub();
    const fork = makeForkRegistryStub();
    fork.runAll.mockRejectedValueOnce(new Error('syncer #3 rollback failed'));
    const { service } = makeService({ parserInteractor: parser, forkRegistry: fork });

    await expect((service as any).processFork(100)).rejects.toThrow('syncer #3 rollback failed');

    expect(parser.deleteDedupAfterBlock).not.toHaveBeenCalled();
    expect(parser.saveFork).not.toHaveBeenCalled();
  });

  it('ошибка в deleteDedupAfterBlock: saveFork НЕ вызывается, ошибка пробрасывается', async () => {
    const parser = makeParserInteractorStub();
    parser.deleteDedupAfterBlock.mockRejectedValueOnce(new Error('PG outage'));
    const { service } = makeService({ parserInteractor: parser });

    await expect((service as any).processFork(100)).rejects.toThrow('PG outage');

    expect(parser.saveFork).not.toHaveBeenCalled();
  });

  it('ошибка в saveFork: emit НЕ вызывается, ошибка пробрасывается', async () => {
    const parser = makeParserInteractorStub();
    parser.saveFork.mockRejectedValueOnce(new Error('fork insert failed'));
    const events = makeEventsServiceStub();
    const { service } = makeService({ parserInteractor: parser, events });

    await expect((service as any).processFork(100)).rejects.toThrow('fork insert failed');

    expect(events.emitAsyncWithTimeout).not.toHaveBeenCalled();
  });

  // controller считает свой event_id в формате chain:fork:block_num:short_id (полное "fork",
  // не parser2-однобуквенное "f") — поэтому ожидаемый ID = 'c1:fork:100:abc12345' (slice 8).
  const FORK_EVENT = {
    kind: 'fork' as const,
    event_id: 'c1:f:100:abc12345', // parser2-формат — controller его НЕ использует
    chain_id: 'c1',
    forked_from_block: 100,
    new_head_block_id: 'abc12345xyz',
  };
  const EXPECTED_CONTROLLER_ID = 'c1:fork:100:abc12345';

  it('fork-event dedup (Story 4.1 AC INV-09): уже-applied event_id — handleEvent ранний return', async () => {
    const parser = makeParserInteractorStub();
    parser.isEventApplied.mockResolvedValueOnce(true);
    const fork = makeForkRegistryStub();
    const events = makeEventsServiceStub();
    const { service } = makeService({ parserInteractor: parser, forkRegistry: fork, events });

    await (service as any).handleEvent(FORK_EVENT);

    expect(parser.isEventApplied).toHaveBeenCalledWith(EXPECTED_CONTROLLER_ID);
    expect(fork.runAll).not.toHaveBeenCalled();
    expect(parser.deleteDedupAfterBlock).not.toHaveBeenCalled();
    expect(parser.saveFork).not.toHaveBeenCalled();
    expect(parser.markEventApplied).not.toHaveBeenCalled();
    expect(events.emitAsyncWithTimeout).not.toHaveBeenCalled();
  });

  it('fork-event новый: controller использует свой event_id (chain:fork:...), НЕ parser2-формат (chain:f:...)', async () => {
    const parser = makeParserInteractorStub();
    parser.isEventApplied.mockResolvedValueOnce(false);
    const { service } = makeService({ parserInteractor: parser });

    await (service as any).handleEvent(FORK_EVENT);

    expect(parser.isEventApplied).toHaveBeenCalledWith(EXPECTED_CONTROLLER_ID);
    expect(parser.markEventApplied).toHaveBeenCalledWith(EXPECTED_CONTROLLER_ID, 100);
    // Никаких следов parser2-формата (`:f:`) в обращениях к dedup-порту:
    expect(parser.isEventApplied).not.toHaveBeenCalledWith(expect.stringContaining(':f:'));
    expect(parser.markEventApplied).not.toHaveBeenCalledWith(expect.stringContaining(':f:'), expect.anything());
  });

  it('fork-event новый: ошибка в processFork → markEventApplied НЕ вызывается', async () => {
    const parser = makeParserInteractorStub();
    parser.isEventApplied.mockResolvedValueOnce(false);
    const fork = makeForkRegistryStub();
    fork.runAll.mockRejectedValueOnce(new Error('rollback fail'));
    const { service } = makeService({ parserInteractor: parser, forkRegistry: fork });

    await expect((service as any).handleEvent(FORK_EVENT)).rejects.toThrow('rollback fail');

    expect(parser.markEventApplied).not.toHaveBeenCalled();
  });

  it('deprecated broadcast не завершился вовремя — service логирует warn, но НЕ бросает', async () => {
    const events = makeEventsServiceStub();
    events.emitAsyncWithTimeout.mockResolvedValueOnce(false);
    const logger = makeLoggerStub();
    const { service } = makeService({ events, logger });

    await expect((service as any).processFork(100)).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('deprecated broadcast не завершился'));
  });
});

describe('BlockchainConsumerService.processAction/processDelta — markEventApplied с block_num (Story 4.1)', () => {
  // config.coopname — сравниваем с тем, что в тестовой среде. Берём из mock'а конфига если есть,
  // иначе тестовый сценарий использует exception (eosio.token::transfer) который проходит без coopname.

  it('processAction: markEventApplied вызывается с block_num действия', async () => {
    const parser = makeParserInteractorStub();
    const { service } = makeService({ parserInteractor: parser });

    const action = {
      account: 'eosio.token',
      name: 'transfer',
      receiver: 'eosio.token',
      data: { coopname: 'irrelevant' },
      block_num: 999,
      global_sequence: 1,
    } as any;

    await (service as any).processActionDelayed(action);

    expect(parser.markEventApplied).toHaveBeenCalledWith(expect.any(String), 999);
  });

  it('processDelta: markEventApplied вызывается с block_num дельты', async () => {
    const parser = makeParserInteractorStub();
    const { service } = makeService({ parserInteractor: parser });

    // config.coopname прокидывается через scope для прохода фильтра.
    const { config } = await import('~/config');
    const delta = {
      code: 'capital',
      table: 'projects',
      primary_key: '1',
      value: { coopname: config.coopname },
      scope: config.coopname,
      block_num: 12345,
      present: true,
    } as any;

    await (service as any).processDeltaDelayed(delta);

    expect(parser.markEventApplied).toHaveBeenCalledWith(expect.any(String), 12345);
  });
});
