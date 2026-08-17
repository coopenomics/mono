import { mapParserActionToIAction, mapParserDeltaToIDelta } from './parser2-event.mapper';

/**
 * Регистр хэшей — контракт данных между индексером и всем остальным узлом.
 *
 * Прежний индексер отдавал шестнадцатеричные значения заглавными (eosjs
 * заканчивает arrayToHex вызовом toUpperCase), новый — строчными. Узел годами
 * складывал их в свои таблицы как есть и ищет точным сравнением, поэтому смена
 * регистра означала бы, что старые и новые записи перестают находить друг друга.
 * Эти тесты закрепляют прежний формат.
 */
describe('перевод событий индексера во внутренний вид', () => {
  const lower = '2f158d869466cd9dbf127607a8a284eb8624cda2e91465d6bf08ac5089488003';
  const upper = lower.toUpperCase();

  it('дельта: хэши в теле и идентификатор блока приходят заглавными', () => {
    const delta = mapParserDeltaToIDelta({
      chain_id: 'db79',
      block_num: 23347,
      block_id: lower,
      block_time: '2026-08-13T12:26:55',
      present: true,
      code: 'soviet',
      scope: 'voskhod',
      table: 'decisions',
      primary_key: '2',
      value: { id: 2, hash: lower, document: { doc_hash: lower } },
    } as any);

    expect(delta.block_id).toBe(upper);
    expect((delta.value as any).hash).toBe(upper);
    // Вложенность любой глубины — хэш документа лежит внутри объекта.
    expect((delta.value as any).document.doc_hash).toBe(upper);
  });

  it('действие: идентификатор транзакции и хэши полезной нагрузки — заглавными', () => {
    const action = mapParserActionToIAction({
      transaction_id: lower,
      account: 'soviet',
      block_num: 23347,
      block_id: lower,
      block_time: '2026-08-13T12:26:55',
      chain_id: 'db79',
      name: 'newsubmitted',
      authorization: [{ actor: 'soviet', permission: 'active' }],
      data: { package: lower, links: [lower], document: { doc_hash: lower } },
      action_ordinal: 1,
      global_sequence: 23760n,
      account_ram_deltas: [],
      console: '',
      receipt: {
        receiver: 'soviet',
        actDigest: lower,
        globalSequence: 23760n,
        recvSequence: 1n,
        authSequence: [{ account: 'soviet', sequence: 1n }],
        codeSequence: 1,
        abiSequence: 1,
      },
      creator_action_ordinal: 0,
      context_free: false,
      elapsed: 10,
    } as any);

    expect(action.transaction_id).toBe(upper);
    expect(action.block_id).toBe(upper);
    expect(action.data.package).toBe(upper);
    expect(action.data.links[0]).toBe(upper);
    expect(action.data.document.doc_hash).toBe(upper);
    expect(action.receipt.act_digest).toBe(upper);
  });

  it('всё, что не хэш, остаётся нетронутым', () => {
    const delta = mapParserDeltaToIDelta({
      chain_id: 'db79',
      block_num: 1,
      block_id: lower,
      block_time: '2026-08-13T12:26:55',
      present: true,
      code: 'soviet',
      scope: 'voskhod',
      table: 'decisions',
      primary_key: '1',
      value: {
        username: 'ant',
        type: 'freedecision',
        // Имя счёта и текст с шестнадцатеричными символами под хэш не подходят —
        // регистр в них значим и меняться не должен.
        wallet: 'w.cap.gen',
        title: 'Решение Совета',
        amount: '100.0000 RUB',
        short: 'deadbeef',
        flag: true,
        count: 42,
        nothing: null,
      },
    } as any);

    expect(delta.value).toEqual({
      username: 'ant',
      type: 'freedecision',
      wallet: 'w.cap.gen',
      title: 'Решение Совета',
      amount: '100.0000 RUB',
      short: 'deadbeef',
      flag: true,
      count: 42,
      nothing: null,
    });
  });
});
