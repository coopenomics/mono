/**
 * Время блока приходит из SHiP строкой без зоны. Если разобрать её как есть,
 * `new Date()` посчитает время локальным — и на узле в любом поясе кроме UTC
 * вся история уедет на несколько часов, оставаясь правдоподобной на вид.
 * Поэтому зона проставляется явно, и это проверяется здесь.
 */
import { chainBlockTimeTransformer, parseChainBlockTime } from '~/infrastructure/blockchain/block-time.util';

describe('Время блока: разбор строки из потока событий', () => {
  it('строка без зоны читается как UTC, а не как локальное время', () => {
    const parsed = parseChainBlockTime('2026-08-13T00:00:01.500');

    expect(parsed?.toISOString()).toBe('2026-08-13T00:00:01.500Z');
  });

  it('явная зона сохраняется как указана', () => {
    expect(parseChainBlockTime('2026-08-13T03:00:01.500+03:00')?.toISOString()).toBe('2026-08-13T00:00:01.500Z');
    expect(parseChainBlockTime('2026-08-13T00:00:01.500Z')?.toISOString()).toBe('2026-08-13T00:00:01.500Z');
  });

  it('времени нет — это законно: старый парсер его не отдавал, у блока без тела его не существует', () => {
    expect(parseChainBlockTime(undefined)).toBeNull();
    expect(parseChainBlockTime(null)).toBeNull();
    expect(parseChainBlockTime('')).toBeNull();
  });

  it('мусор вместо времени не роняет запись, а остаётся пустым полем', () => {
    expect(parseChainBlockTime('не время')).toBeNull();
  });

  it('готовый Date проходит насквозь', () => {
    const date = new Date('2026-08-13T00:00:01.500Z');

    expect(parseChainBlockTime(date)).toBe(date);
  });
});

describe('Время блока: хранение — строка в объекте, timestamptz в базе', () => {
  it('в базу уходит момент времени', () => {
    expect(chainBlockTimeTransformer.to('2026-08-13T00:00:01.500')).toEqual(new Date('2026-08-13T00:00:01.500Z'));
  });

  it('из базы возвращается строка ISO — та же форма, что в потоке событий', () => {
    expect(chainBlockTimeTransformer.from(new Date('2026-08-13T00:00:01.500Z'))).toBe('2026-08-13T00:00:01.500Z');
  });

  it('пустая колонка остаётся пустой в обе стороны', () => {
    expect(chainBlockTimeTransformer.to(null)).toBeNull();
    expect(chainBlockTimeTransformer.from(null)).toBeUndefined();
  });
});
