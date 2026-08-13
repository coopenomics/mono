import { ControllerChainDataSource } from './controller-chain-data.source';

/**
 * Источник данных цепи для фабрики документов заменил собой обозреватель
 * старого парсера. Проверяем то, что при такой замене легко потерять:
 *   1. шаблон берётся из реестра, а не из журнала дельт, и с учётом блока —
 *      иначе старый документ пересоберётся сегодняшним текстом;
 *   2. переводы отдаются по одному на язык, свежие;
 *   3. прочие таблицы читаются из журнала дельт с тем же правилом «последнее
 *      изменение не позже блока»;
 *   4. строка, стёртая в цепи, не выдаётся как существующая;
 *   5. имя поля в условии не попадает в запрос как есть.
 */
describe('ControllerChainDataSource', () => {
  const query = jest.fn();
  const findTemplateAt = jest.fn();
  const actionsFind = jest.fn();
  const getInfo = jest.fn();

  const source = new ControllerChainDataSource(
    { query } as any,
    { findTemplateAt } as any,
    { find: actionsFind } as any,
    { getInfo } as any
  );

  beforeEach(() => {
    query.mockReset().mockResolvedValue([]);
    findTemplateAt.mockReset().mockResolvedValue(null);
    actionsFind.mockReset().mockResolvedValue({ results: [], page: 1, limit: 10, total: 0 });
    getInfo.mockReset().mockResolvedValue({ head_block_num: 42 });
  });

  it('шаблон берётся из реестра на указанный блок', async () => {
    findTemplateAt.mockResolvedValue({ registry_id: '100', title: 'Заявление' });

    const rows = await source.getTableRows({
      code: 'draft',
      scope: 'draft',
      table: 'drafts',
      filter: { registry_id: '100' },
      block_num: 500,
    });

    expect(rows).toEqual([{ registry_id: '100', title: 'Заявление' }]);
    expect(findTemplateAt).toHaveBeenCalledWith('100', 500);
    // Журнал дельт для шаблонов не привлекается — у реестра своя история.
    expect(query).not.toHaveBeenCalled();
  });

  it('переводы отдаются по одному на язык', async () => {
    query.mockResolvedValue([{ value: { lang: 'ru' } }, { value: { lang: 'en' } }]);

    const rows = await source.getTableRows({
      code: 'draft',
      scope: 'draft',
      table: 'translations',
      filter: { draft_id: '100' },
      block_num: 500,
    });

    expect(rows).toEqual([{ lang: 'ru' }, { lang: 'en' }]);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('DISTINCT ON (lang)');
    expect(params).toEqual(['100', 500]);
  });

  it('прочие таблицы читаются из журнала дельт с ограничением по блоку', async () => {
    query.mockResolvedValue([{ value: { hash: 'ABC' }, present: true }]);

    const rows = await source.getTableRows({
      code: 'meet',
      scope: 'voskhod',
      table: 'meets',
      filter: { hash: 'ABC' },
      block_num: 777,
    });

    expect(rows).toEqual([{ hash: 'ABC' }]);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('DISTINCT ON (primary_key)');
    expect(sql).toContain("d.value ->> 'hash'");
    expect(params).toEqual(['meet', 'voskhod', 'meets', 777, 'ABC']);
  });

  it('удалённая в цепи строка не выдаётся', async () => {
    query.mockResolvedValue([
      { value: { id: 1 }, present: false },
      { value: { id: 2 }, present: true },
    ]);

    const rows = await source.getTableRows({ code: 'soviet', scope: 'voskhod', table: 'boards' });

    expect(rows).toEqual([{ id: 2 }]);
  });

  it('хэш в условии сравнивается без учёта регистра', async () => {
    const hash = '2F158D869466CD9DBF127607A8A284EB8624CDA2E91465D6BF08AC5089488003';

    await source.getTableRows({
      code: 'soviet',
      scope: 'voskhod',
      table: 'decisions',
      filter: { hash },
    });

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("lower(d.value ->> 'hash')");
    expect(params).toContain(hash.toLowerCase());
  });

  it('вложенный путь в условии разворачивается, мусорное имя поля отвергается', async () => {
    await source.getTableRows({
      code: 'soviet',
      scope: 'voskhod',
      table: 'agreements3',
      filter: { 'document.doc_hash': 'DEAD' },
    });

    expect(query.mock.calls[0][0]).toContain("d.value #>> '{document,doc_hash}'");

    await expect(
      source.getTableRows({
        code: 'soviet',
        scope: 'voskhod',
        table: 'boards',
        filter: { "id'; DROP TABLE blockchain_deltas; --": '1' },
      })
    ).rejects.toThrow('Недопустимое имя поля');
  });

  it('действия берутся из истории узла', async () => {
    actionsFind.mockResolvedValue({ results: [{ name: 'votefor' }], page: 1, limit: 100, total: 1 });

    const actions = await source.getActions({
      account: 'soviet',
      name: 'votefor',
      data: { decision_id: 7 },
    });

    expect(actions).toEqual([{ name: 'votefor' }]);
    expect(actionsFind).toHaveBeenCalledWith(
      { account: 'soviet', name: 'votefor', data: { decision_id: '7' } },
      1,
      100
    );
  });

  it('текущий блок берётся у цепи', async () => {
    await expect(source.getCurrentBlock()).resolves.toBe(42);
  });
});
