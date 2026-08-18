import { BlockchainActionHistoryService } from './blockchain-action-history.service';

/**
 * История действий переехала из обозревателя парсера в собственную базу узла.
 * Проверяем то, что при переезде легко потерять:
 *   1. запрос отдаёт последнее действие — вызывающие берут первый результат;
 *   2. плоский запрос обозревателя разбирается правильно: `receiver` — поле
 *      действия, `data.document.doc_hash` — путь внутрь полезной нагрузки;
 *   3. поле, не входящее в набор колонок действия, попадает в условие по
 *      полезной нагрузке, а не отбрасывается молча;
 *   4. пустой результат отдаётся как null, а не как исключение — вызывающая
 *      сторона трактует это как «парсер ещё не проиндексировал».
 */
describe('BlockchainActionHistoryService', () => {
  const findMany = jest.fn();
  const service = new BlockchainActionHistoryService({ findMany } as any);

  beforeEach(() => {
    findMany.mockReset();
    findMany.mockResolvedValue({ results: [], page: 1, limit: 10, total: 0 });
  });

  it('отдаёт последнее действие под фильтр', async () => {
    findMany.mockResolvedValue({
      results: [{ account: 'soviet', name: 'newsubmitted' }],
      page: 1,
      limit: 1,
      total: 1,
    });

    const action = await service.findLast({ account: 'soviet', name: 'newsubmitted' });

    expect(action).toMatchObject({ account: 'soviet', name: 'newsubmitted' });
    // Запрашивается ровно одна запись: вызывающему нужна последняя, не страница.
    expect(findMany).toHaveBeenCalledWith({ account: 'soviet', name: 'newsubmitted' }, 1, 1);
  });

  it('отсутствие действия отдаёт как null', async () => {
    await expect(service.findLast({ account: 'soviet', name: 'newdecision' })).resolves.toBeNull();
  });

  it('плоский запрос разбирает поля действия и пути внутрь полезной нагрузки', async () => {
    await service.findByQuery(
      { account: 'soviet', name: 'newagreement' },
      { receiver: 'voskhod', 'data.document.doc_hash': 'ABCD' },
      2,
      50
    );

    expect(findMany).toHaveBeenCalledWith(
      {
        account: 'soviet',
        name: 'newagreement',
        receiver: 'voskhod',
        data: { 'document.doc_hash': 'ABCD' },
      },
      2,
      50
    );
  });

  it('неизвестный ключ считает полем полезной нагрузки — так его понимал обозреватель', async () => {
    await service.findByQuery({ account: 'soviet', name: 'newact' }, { package: 'HASH1' });

    expect(findMany).toHaveBeenCalledWith(
      { account: 'soviet', name: 'newact', data: { package: 'HASH1' } },
      1,
      10
    );
  });

  it('пустые значения в запрос не попадают', async () => {
    await service.findByQuery({ account: 'soviet', name: 'newlink' }, { receiver: undefined, package: null });

    expect(findMany).toHaveBeenCalledWith({ account: 'soviet', name: 'newlink' }, 1, 10);
  });
});
