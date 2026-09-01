import { ChainHeadInfo, isActivePermissionFinalized, libBlockTimeMs } from './chain-finality';

const OPTS = { marginMs: 500, blockIntervalMs: 500 };

const EXACT: ChainHeadInfo = {
  head_block_num: 1000,
  head_block_time: '2026-06-14T12:00:00.000Z',
  last_irreversible_block_num: 998,
  last_irreversible_block_time: '2026-06-14T11:59:59.000Z',
};

const DERIVED: ChainHeadInfo = {
  head_block_num: 1000,
  head_block_time: '2026-06-14T12:00:00.000Z',
  last_irreversible_block_num: 900, // отстаёт на 100 блоков
};

describe('libBlockTimeMs', () => {
  it('берёт точное last_irreversible_block_time, если есть', () => {
    expect(libBlockTimeMs(EXACT, 500)).toBe(Date.parse('2026-06-14T11:59:59.000Z'));
  });
  it('оценивает по head − лаг×интервал, если точного времени нет', () => {
    expect(libBlockTimeMs(DERIVED, 500)).toBe(Date.parse('2026-06-14T12:00:00.000Z') - 100 * 500);
  });
  it('LIB впереди head (лаг<0) → null', () => {
    expect(libBlockTimeMs({ ...DERIVED, last_irreversible_block_num: 1100 }, 500)).toBeNull();
  });
  it('битое head-время → null', () => {
    expect(libBlockTimeMs({ ...DERIVED, head_block_time: 'not-a-date' }, 500)).toBeNull();
  });
});

describe('isActivePermissionFinalized', () => {
  it('нет last_updated → true (нечем доказать не-финализацию, не блокируем вход)', () => {
    expect(isActivePermissionFinalized(undefined, EXACT, OPTS)).toBe(true);
    expect(isActivePermissionFinalized(null, EXACT, OPTS)).toBe(true);
  });

  it('битое last_updated → true', () => {
    expect(isActivePermissionFinalized('garbage', EXACT, OPTS)).toBe(true);
  });

  it('точный LIB: last_updated сильно раньше границы → финализирован', () => {
    expect(isActivePermissionFinalized('2026-06-14T11:00:00.000Z', EXACT, OPTS)).toBe(true);
  });

  it('точный LIB: last_updated = head (новее LIB) → НЕ финализирован', () => {
    expect(isActivePermissionFinalized('2026-06-14T12:00:00.000Z', EXACT, OPTS)).toBe(false);
  });

  it('точный LIB: last_updated ровно на границе LIB → НЕ финализирован (в пределах запаса)', () => {
    expect(isActivePermissionFinalized('2026-06-14T11:59:59.000Z', EXACT, OPTS)).toBe(false);
  });

  it('оценка LIB: last_updated раньше оценочной границы → финализирован', () => {
    expect(isActivePermissionFinalized('2026-06-14T11:58:00.000Z', DERIVED, OPTS)).toBe(true);
  });

  it('оценка LIB: last_updated в реверсивном окне (после оценочной границы) → НЕ финализирован', () => {
    expect(isActivePermissionFinalized('2026-06-14T11:59:30.000Z', DERIVED, OPTS)).toBe(false);
  });

  it('недостаточно данных для оценки LIB → true (не блокируем)', () => {
    expect(isActivePermissionFinalized('2026-06-14T12:00:00.000Z', { ...DERIVED, head_block_time: 'x' }, OPTS)).toBe(true);
  });
});
