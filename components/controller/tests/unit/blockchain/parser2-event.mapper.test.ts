/**
 * Unit-тесты mapParserDeltaToIDelta / mapParserActionToIAction (миграция на parser2).
 *
 * Маппер — единственная точка перевода ParserEvent → IDelta/IAction при смене
 * транспорта (DEC-T09). Все поля действия реальные из SHiP-трейса parser2 — паритет
 * с parser1: transaction_id/creator_action_ordinal (нужны ledger2 для cross-link
 * родительского apply), receipt с auth_sequence, console/elapsed/context_free/
 * account_ram_deltas (нужны blockchain-explorer).
 */

import { mapParserActionToIAction, mapParserDeltaToIDelta } from '~/infrastructure/blockchain/parser2-event.mapper';

function deltaEvent(over: Record<string, any> = {}): any {
  return {
    kind: 'delta',
    event_id: 'chain-aaa:d:100:0123456789abcdef:eosio.token:voskhod:accounts:42',
    chain_id: 'chain-aaa',
    block_num: 100,
    block_time: '2026-05-25T00:00:00.000Z',
    block_id: '0123456789abcdef0000',
    code: 'eosio.token',
    scope: 'voskhod',
    table: 'accounts',
    primary_key: '42',
    value: { balance: '10.0000 RUB', coopname: 'voskhod' },
    present: true,
    ...over,
  };
}

function actionEvent(over: Record<string, any> = {}): any {
  return {
    kind: 'action',
    event_id: 'chain-aaa:a:100:0123456789abcdef:777',
    chain_id: 'chain-aaa',
    block_num: 100,
    block_time: '2026-05-25T00:00:00.000Z',
    block_id: '0123456789abcdef0000',
    transaction_id: 'abc123def456',
    account: 'eosio.token',
    name: 'transfer',
    authorization: [{ actor: 'voskhod', permission: 'active' }],
    data: { from: 'voskhod', to: 'ant', quantity: '1.0000 RUB' },
    action_ordinal: 2,
    creator_action_ordinal: 1,
    global_sequence: 777n,
    receipt: {
      receiver: 'eosio.token',
      actDigest: 'deadbeef',
      globalSequence: 777n,
      recvSequence: 5n,
      authSequence: [{ account: 'voskhod', sequence: 9n }],
      codeSequence: 3,
      abiSequence: 4,
    },
    context_free: false,
    elapsed: 42,
    console: 'log-output',
    account_ram_deltas: [{ account: 'voskhod', delta: 128 }],
    ...over,
  };
}

describe('mapParserDeltaToIDelta', () => {
  it('мапит все поля DeltaEvent один-в-один', () => {
    expect(mapParserDeltaToIDelta(deltaEvent())).toEqual({
      chain_id: 'chain-aaa',
      block_num: 100,
      block_id: '0123456789abcdef0000',
      block_time: '2026-05-25T00:00:00.000Z',
      present: true,
      code: 'eosio.token',
      scope: 'voskhod',
      table: 'accounts',
      primary_key: '42',
      value: { balance: '10.0000 RUB', coopname: 'voskhod' },
    });
  });

  it('пробрасывает present=false (удаление строки)', () => {
    expect(mapParserDeltaToIDelta(deltaEvent({ present: false })).present).toBe(false);
  });

  it('пробрасывает block_time из SHiP-трейса (parser1 этого поля не давал)', () => {
    expect(mapParserDeltaToIDelta(deltaEvent()).block_time).toBe('2026-05-25T00:00:00.000Z');
  });
});

describe('mapParserActionToIAction', () => {
  it('пробрасывает реальные поля action и сериализует global_sequence (bigint → string)', () => {
    const a = mapParserActionToIAction(actionEvent());
    expect(a.account).toBe('eosio.token');
    expect(a.name).toBe('transfer');
    expect(a.block_num).toBe(100);
    expect(a.data).toEqual({ from: 'voskhod', to: 'ant', quantity: '1.0000 RUB' });
    expect(a.global_sequence).toBe('777');
    expect(typeof a.global_sequence).toBe('string');
    expect(a.authorization).toEqual([{ actor: 'voskhod', permission: 'active' }]);
  });

  it('несёт transaction_id и creator_action_ordinal (нужны ledger2 для cross-link)', () => {
    const a = mapParserActionToIAction(actionEvent());
    expect(a.transaction_id).toBe('abc123def456');
    expect(a.action_ordinal).toBe(2);
    expect(a.creator_action_ordinal).toBe(1);
  });

  it('мапит receipt с auth_sequence (bigint → string)', () => {
    const a = mapParserActionToIAction(actionEvent());
    expect(a.receipt).toEqual({
      receiver: 'eosio.token',
      act_digest: 'deadbeef',
      global_sequence: '777',
      recv_sequence: '5',
      auth_sequence: [{ account: 'voskhod', sequence: '9' }],
      code_sequence: 3,
      abi_sequence: 4,
    });
    expect(a.receiver).toBe('eosio.token');
  });

  it('несёт console/elapsed/context_free/account_ram_deltas (нужны blockchain-explorer)', () => {
    const a = mapParserActionToIAction(actionEvent());
    expect(a.console).toBe('log-output');
    expect(a.elapsed).toBe(42);
    expect(a.context_free).toBe(false);
    expect(a.account_ram_deltas).toEqual([{ account: 'voskhod', delta: 128 }]);
  });

  it('пробрасывает block_time из SHiP-трейса (parser1 этого поля не давал)', () => {
    const a = mapParserActionToIAction(actionEvent());
    expect(a.block_time).toBe('2026-05-25T00:00:00.000Z');
  });

  it('при отсутствии receipt (null) собирает дефолтный receipt, не падает', () => {
    const a = mapParserActionToIAction(actionEvent({ receipt: null }));
    expect(a.receipt.receiver).toBe('eosio.token');
    expect(a.receipt.global_sequence).toBe('777');
    expect(a.receipt.auth_sequence).toEqual([]);
  });
});
