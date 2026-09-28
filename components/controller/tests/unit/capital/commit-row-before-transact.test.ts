/**
 * Коммит Благороста: одна строка на хэш.
 *
 * transact возвращается, когда блок уже разобран: синхронизатор по дельте
 * своего блока не находил строки коммита и заводил её сам, а интерактор после
 * транзакции вставлял вторую с тем же хэшем — одобрение и отклонение брали
 * любую из двух (нашёл внешний слой, 25.09.2026, C28-80).
 */
import { GenerationInteractor } from '~/extensions/capital/application/use-cases/generation.interactor';

function build() {
  const calls: string[] = [];
  const row = { _id: 'commit-1', commit_hash: '', data: [] as any[] };
  const commitRepository = {
    findByCommitHash: jest.fn(async (): Promise<any> => null),
    create: jest.fn(async (entity: any) => {
      row.commit_hash = entity.commit_hash;
      return { ...entity };
    }),
    saveCreated: jest.fn(async () => {
      calls.push('save');
      return row;
    }),
    save: jest.fn(async (c: any) => {
      calls.push('update');
      return c;
    }),
    delete: jest.fn(async () => {
      calls.push('delete');
    }),
  };
  const chain = {
    createCommit: jest.fn(async () => {
      calls.push('chain');
      return { transaction_id: 'tx-1' };
    }),
  };
  const timeTracking = {
    getAvailableCommitHours: jest.fn(async () => 5),
    commitTime: jest.fn(async () => undefined),
    getCommittedIssueSummaries: jest.fn(async () => [{ issue_hash: 'i1', title: 'Задача', hours: 3 }]),
  };
  const interactor = new GenerationInteractor(
    chain as any,
    timeTracking as any,
    { isGitUrl: () => false } as any,
    { findByUsernameAndCoopname: jest.fn(async () => ({ contributor_hash: 'c1', rate_per_hour: '1000.0000 RUB' })) } as any,
    commitRepository as any,
    { findByHash: jest.fn(async () => ({ project_hash: 'p1', origin: 'blockchain' })) } as any,
    {} as any,
    { findUnconsumedByProjectAndUsername: jest.fn(async () => []), markConsumed: jest.fn() } as any,
    { setContext: jest.fn(), debug: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() } as any
  );
  return { interactor, commitRepository, chain, calls, row };
}

const input = {
  coopname: 'voskhod',
  username: 'ivanov',
  project_hash: 'p1',
  commit_hours: 3,
  description: 'Работа по задаче',
  meta: '',
};

describe('коммит Благороста — строка до транзакции', () => {
  it('строка сохраняется до отправки в цепь; после — перечитывается и дополняется снимком задач, второй строки нет', async () => {
    const m = build();
    m.commitRepository.findByCommitHash.mockResolvedValueOnce(null).mockResolvedValueOnce(m.row);

    const commit = await m.interactor.createCommit(input as any, {} as any);

    expect(m.calls).toEqual(['save', 'chain', 'update']);
    expect(m.commitRepository.saveCreated).toHaveBeenCalledTimes(1);
    expect(commit).toBe(m.row);
    expect(commit.data).toEqual([expect.objectContaining({ type: 'committed_issues' })]);
  });

  it('цепь отказала — строка удалена, отказ передан наверх', async () => {
    const m = build();
    m.chain.createCommit.mockRejectedValueOnce(new Error('assertion failure'));

    await expect(m.interactor.createCommit(input as any, {} as any)).rejects.toThrow('assertion failure');
    expect(m.chain.createCommit).toHaveBeenCalledTimes(1);
    expect(m.calls).toEqual(['save', 'delete']);
    expect(m.commitRepository.delete).toHaveBeenCalledWith('commit-1');
  });
});
