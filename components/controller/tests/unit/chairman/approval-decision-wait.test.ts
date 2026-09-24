/**
 * Решение председателя по одобрению отвечает после факта из цепи (ADR-009):
 * ждёт изменение самого одобрения и контракта-адресата из блока своей транзакции.
 */
import { ApprovalService } from '~/extensions/chairman/application/services/approval.service';

function make(chainWait: any) {
  const approval = {
    coopname: 'voskhod',
    approval_hash: 'ABC',
    callback_contract: 'edubridge',
    document: {},
    approve: jest.fn(),
    decline: jest.fn(),
  } as any;
  const repo = { findBySyncKey: jest.fn(async () => approval), save: jest.fn(async (a: any) => a) } as any;
  const chain = {
    confirmApprove: jest.fn(async () => ({ response: { processed: { block_num: 54696 } } })),
    declineApprove: jest.fn(async () => ({ response: { processed: { block_num: 54700 } } })),
  } as any;
  const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn() } as any;
  const documents = { buildAggregate: jest.fn(async () => ({})) } as any;
  return { service: new ApprovalService(repo, chain, logger, documents, chainWait), logger };
}

describe('ApprovalService — ответ после изменения из цепи', () => {
  it('подтверждение ждёт одобрение совета и контракт-адресат транзакции', async () => {
    const chainWait = { afterTransact: jest.fn(async () => true) };
    const { service } = make(chainWait);
    await service.confirmApprove({ coopname: 'voskhod', approval_hash: 'abc' } as any, 'ant');

    const [tx, waits] = (chainWait.afterTransact.mock.calls[0] as unknown) as [any, any[]];
    expect(tx.response.processed.block_num).toBe(54696);
    expect(waits).toHaveLength(2);
    expect(waits[0]).toMatchObject({ code: 'soviet', table: 'approvals', scope: 'voskhod' });
    expect(waits[0].match({ value: { approval_hash: 'abc' } })).toBe(true);
    expect(waits[0].match({ value: { approval_hash: 'other' } })).toBe(false);
    expect(waits[1]).toEqual({ code: 'edubridge', scope: 'voskhod' });
  });

  it('изменение не пришло в срок — ответ всё равно уходит, с предупреждением в журнал', async () => {
    const chainWait = { afterTransact: jest.fn(async () => false) };
    const { service, logger } = make(chainWait);
    await expect(service.declineApprove({ coopname: 'voskhod', approval_hash: 'abc', reason: 'нет' } as any, 'ant')).resolves.toBeDefined();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('без порта ожидания — ответ сразу, как раньше', async () => {
    const { service } = make(null);
    await expect(service.confirmApprove({ coopname: 'voskhod', approval_hash: 'abc' } as any, 'ant')).resolves.toBeDefined();
  });
});
