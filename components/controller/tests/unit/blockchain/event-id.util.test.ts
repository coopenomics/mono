/**
 * Unit-тесты computeDeltaEventId / computeActionEventId (Story 2.2).
 *
 * event_id — фундамент идемпотентности (INV-09). Формула должна быть
 * детерминированной и не схлопывать разные логические события в один id
 * (иначе dedup-gate Story 2.3 отбросит реальное событие = silent data loss).
 * В Epic 3 phase 2 эти id сверяются с авторитетными из parser2.
 */

import { computeActionEventId, computeDeltaEventId, computeForkEventId } from '~/infrastructure/blockchain/event-id.util';

function makeDelta(over: Partial<any> = {}): any {
  return {
    chain_id: 'chain-aaa',
    block_num: 100,
    block_id: '0123456789abcdef',
    present: true,
    code: 'eosio.token',
    scope: 'voskhod',
    table: 'accounts',
    primary_key: '42',
    ...over,
  };
}

function makeAction(over: Partial<any> = {}): any {
  return {
    chain_id: 'chain-aaa',
    block_num: 100,
    block_id: '0123456789abcdef',
    global_sequence: '777',
    account: 'eosio.token',
    name: 'transfer',
    ...over,
  };
}

describe('computeDeltaEventId (Story 2.2)', () => {
  it('формирует id по формуле chain:delta:block:block_id_short:code:scope:table:primary_key', () => {
    expect(computeDeltaEventId(makeDelta())).toBe('chain-aaa:delta:100:01234567:eosio.token:voskhod:accounts:42');
  });

  it('детерминирован: один и тот же вход → один и тот же id', () => {
    expect(computeDeltaEventId(makeDelta())).toBe(computeDeltaEventId(makeDelta()));
  });

  it('разный primary_key → разный id', () => {
    expect(computeDeltaEventId(makeDelta({ primary_key: '1' }))).not.toBe(
      computeDeltaEventId(makeDelta({ primary_key: '2' }))
    );
  });

  it('разный блок → разный id (один и тот же ряд, обновлённый в другом блоке)', () => {
    expect(computeDeltaEventId(makeDelta({ block_num: 100, block_id: 'aaaa1111' }))).not.toBe(
      computeDeltaEventId(makeDelta({ block_num: 101, block_id: 'bbbb2222' }))
    );
  });

  it('обрезает block_id до 8 символов; короткий block_id не падает', () => {
    expect(computeDeltaEventId(makeDelta({ block_id: 'ab' }))).toBe('chain-aaa:delta:100:ab:eosio.token:voskhod:accounts:42');
  });
});

describe('computeActionEventId (Story 2.2)', () => {
  it('формирует id по формуле chain:action:block:block_id_short:global_sequence', () => {
    expect(computeActionEventId(makeAction())).toBe('chain-aaa:action:100:01234567:777');
  });

  it('разный global_sequence → разный id', () => {
    expect(computeActionEventId(makeAction({ global_sequence: '1' }))).not.toBe(
      computeActionEventId(makeAction({ global_sequence: '2' }))
    );
  });

  it('детерминирован', () => {
    expect(computeActionEventId(makeAction())).toBe(computeActionEventId(makeAction()));
  });
});

describe('computeForkEventId (Story 4.1)', () => {
  it('формирует id по формуле chain:fork:forked_from_block:new_head_block_id_short (kind = полное "fork", не parser2 "f")', () => {
    expect(computeForkEventId('chain-aaa', 1000, '0123456789abcdef')).toBe('chain-aaa:fork:1000:01234567');
  });

  it('одинаковые входы → одинаковый id (детерминирован)', () => {
    expect(computeForkEventId('chain-aaa', 1000, 'aaaa1111')).toBe(computeForkEventId('chain-aaa', 1000, 'aaaa1111'));
  });

  it('разный new_head_block_id (две разных «новых ветки» того же forked_from_block) → разный id', () => {
    expect(computeForkEventId('chain-aaa', 1000, 'aaaaaaaa')).not.toBe(
      computeForkEventId('chain-aaa', 1000, 'bbbbbbbb')
    );
  });

  it('разный forked_from_block → разный id', () => {
    expect(computeForkEventId('chain-aaa', 1000, 'aaaa1111')).not.toBe(
      computeForkEventId('chain-aaa', 1001, 'aaaa1111')
    );
  });

  it('короткий new_head_block_id (< 8 символов) не падает', () => {
    expect(computeForkEventId('chain-aaa', 1000, 'ab')).toBe('chain-aaa:fork:1000:ab');
  });
});
