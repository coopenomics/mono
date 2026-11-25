import { MeetInteractor } from '~/application/meet/interactors/meet.interactor';

/**
 * Ссылка на собрание после повторного созыва (A86-3, 24.11.2026).
 *
 * Повторный созыв меняет хэш собрания в цепи. Ссылка по прежнему хэшу (письмо,
 * открытая вкладка) вела на черновик без собрания в цепи — пустая страница.
 * Черновик прежнего созыва помнит новый хэш, чтение идёт по цепочке замен.
 */
function build(replacements: Record<string, string>) {
  const chain = {
    getMeet: jest.fn(async ({ hash }: { hash: string }) =>
      hash === 'NEW2' ? { hash, meet: { id: 4, hash }, questions: [] } : null,
    ),
  };
  const pre = {
    findReplacement: jest.fn(async (hash: string) => replacements[hash] ?? null),
    findByHash: jest.fn(async (hash: string) => ({ hash })),
    markReplaced: jest.fn(async () => undefined),
  };
  const processed = { findByHash: jest.fn(async () => null) };
  const interactor = new MeetInteractor({} as any, pre as any, processed as any, chain as any, {} as any, {} as any);
  return { interactor, chain, pre };
}

describe('собрание по прежнему хэшу после повторного созыва', () => {
  it('чтение идёт по цепочке замен к действующему созыву', async () => {
    const { interactor, chain } = build({ OLD: 'NEW1', NEW1: 'NEW2' });
    const meet = await interactor.getMeet({ coopname: 'voskhod', hash: 'OLD' });
    expect(chain.getMeet).toHaveBeenCalledWith(expect.objectContaining({ hash: 'NEW2' }));
    expect(meet.hash).toBe('NEW2');
  });

  it('собрание без повторного созыва читается по своему хэшу', async () => {
    const { interactor, chain, pre } = build({});
    await interactor.getMeet({ coopname: 'voskhod', hash: 'NEW2' });
    expect(pre.findReplacement).toHaveBeenCalledWith('NEW2');
    expect(chain.getMeet).toHaveBeenCalledWith(expect.objectContaining({ hash: 'NEW2' }));
  });

  it('зацикленная цепочка замен не зацикливает чтение', async () => {
    const { interactor, pre } = build({ A: 'B', B: 'A' });
    await interactor.getMeet({ coopname: 'voskhod', hash: 'A' });
    expect(pre.findReplacement).toHaveBeenCalledTimes(20);
  });
});
