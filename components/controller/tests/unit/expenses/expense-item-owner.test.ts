/**
 * Отчёт и возврат по строке-авансу — только от получателя аванса или совета.
 * Контракт `expense` проверяет лишь подпись кооператива, поэтому без этой
 * проверки любой вошедший списывал бы подотчёт с чужого аванса «возвратом».
 */
import { ForbiddenException } from '@nestjs/common';
import { ExpenseMutationsResolver } from '~/extensions/expenses/application/resolvers/expense-mutations.resolver';

const PROPOSAL = 'a'.repeat(64);
const ITEM = 'b'.repeat(64);

function build() {
  const mutations = {
    reportExpenseItem: jest.fn().mockResolvedValue({ closed: true }),
    returnExpenseItem: jest.fn().mockResolvedValue({ ok: true }),
  };
  const management = {
    getProposalByHash: jest.fn().mockResolvedValue({
      proposal_hash: PROPOSAL,
      items: [{ item_hash: ITEM.toUpperCase(), recipient: 'bob' }],
    }),
  };
  const resolver = new ExpenseMutationsResolver(mutations as any, management as any);
  return { resolver, mutations };
}

const returnInput = { coopname: 'voskhod', proposal_hash: PROPOSAL, item_hash: ITEM, return_amount: '10.0000 RUB' } as any;
const reportInput = { coopname: 'voskhod', proposal_hash: PROPOSAL, item_hash: ITEM, actual_amount: '10.0000 RUB' } as any;

describe('строка-аванс: кто распоряжается', () => {
  it('получатель аванса возвращает остаток и отчитывается', async () => {
    const { resolver, mutations } = build();
    await resolver.returnExpenseItem(returnInput, { username: 'bob', role: 'user' } as any);
    await resolver.reportExpenseItem(reportInput, { username: 'bob', role: 'user' } as any);
    expect(mutations.returnExpenseItem).toHaveBeenCalledTimes(1);
    expect(mutations.reportExpenseItem).toHaveBeenCalledTimes(1);
  });

  it('другой пайщик — отказ, до цепи не доходит', async () => {
    const { resolver, mutations } = build();
    await expect(resolver.returnExpenseItem(returnInput, { username: 'mallory', role: 'user' } as any)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    await expect(resolver.reportExpenseItem(reportInput, { username: 'mallory', role: 'user' } as any)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(mutations.returnExpenseItem).not.toHaveBeenCalled();
    expect(mutations.reportExpenseItem).not.toHaveBeenCalled();
  });

  it('несуществующая строка — отказ', async () => {
    const { resolver } = build();
    await expect(
      resolver.returnExpenseItem({ ...returnInput, item_hash: 'c'.repeat(64) }, { username: 'bob', role: 'user' } as any)
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('совет распоряжается любой строкой', async () => {
    const { resolver, mutations } = build();
    await resolver.returnExpenseItem(returnInput, { username: 'ant', role: 'chairman' } as any);
    await resolver.returnExpenseItem(returnInput, { username: 'kim', role: 'member' } as any);
    expect(mutations.returnExpenseItem).toHaveBeenCalledTimes(2);
  });
});
