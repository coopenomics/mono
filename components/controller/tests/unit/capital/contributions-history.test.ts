/** Страница «Мои взносы»: история паевых взносов пайщика из книги учёта. */
jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({ coopname: 'voskhod' }),
}));
import { ContributionsHistoryService } from '~/extensions/capital/application/services/contributions-history.service';
import { ContributionKind } from '~/extensions/capital/domain/enums/contribution-kind.enum';

const op = (operationCode: string, quantity: string, globalSequence: string) => ({
  globalSequence,
  blockNum: 1,
  coopname: 'voskhod',
  action: 'apply',
  operationCode,
  processHash: 'ab'.repeat(32),
  username: 'ant',
  quantity,
  memo: null,
  createdAt: new Date('2026-10-30T10:00:00Z'),
});

describe('ContributionsHistoryService — история паевых взносов пайщика', () => {
  it('просит у книги учёта только операции взносов этого пайщика, новые первыми', async () => {
    const port = { getHistory: jest.fn(async () => ({ items: [], totalCount: 0, totalPages: 0, currentPage: 1 })) } as any;
    await new ContributionsHistoryService(port).getContributions('ant');

    expect(port.getHistory).toHaveBeenCalledWith({
      coopname: 'voskhod',
      username: 'ant',
      actionNames: ['apply'],
      operationCodes: ['o.cap.invest', 'o.cap.actprp', 'o.cap.ridshr', 'o.cap.import'],
      page: 1,
      limit: 20,
      sortOrder: 'DESC',
    });
  });

  it('операция книги учёта становится взносом своего вида с суммой и датой', async () => {
    const port = {
      getHistory: jest.fn(async () => ({
        items: [op('o.cap.invest', '1000.0000 RUB', '11'), op('o.cap.actprp', '85000.0000 RUB', '12'), op('o.cap.ridshr', '500.0000 RUB', '13')],
        totalCount: 3,
        totalPages: 1,
        currentPage: 1,
      })),
    } as any;

    const result = await new ContributionsHistoryService(port).getContributions('ant', { page: 1, limit: 10 } as any);

    expect(result.totalCount).toBe(3);
    expect(result.items.map((i) => i.kind)).toEqual([ContributionKind.MONEY, ContributionKind.PROPERTY, ContributionKind.RESULT]);
    expect(result.items[1]).toEqual({
      id: '12',
      kind: ContributionKind.PROPERTY,
      amount: '85000.0000 RUB',
      created_at: '2026-10-30T10:00:00.000Z',
      process_hash: 'ab'.repeat(32),
      memo: null,
    });
  });
});
