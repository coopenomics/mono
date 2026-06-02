/**
 * Story 6.4 (Epic 6): юнит-тесты canonicalStringify + computeBcChecksum.
 * Покрытие: детерминизм, change-detection, nested, arrays, primitives, null/undefined.
 */

import { createHash } from 'crypto';
import { canonicalStringify, computeBcChecksum } from '~/shared/sync/checksum.util';

describe('Story 6.4: canonicalStringify', () => {
  it('primitives', () => {
    expect(canonicalStringify(1)).toBe('1');
    expect(canonicalStringify('hello')).toBe('"hello"');
    expect(canonicalStringify(true)).toBe('true');
    expect(canonicalStringify(null)).toBe('null');
    expect(canonicalStringify(undefined)).toBe('null');
  });

  it('пустой объект и пустой массив', () => {
    expect(canonicalStringify({})).toBe('{}');
    expect(canonicalStringify([])).toBe('[]');
  });

  it('сортирует ключи объекта лексикографически', () => {
    expect(canonicalStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalStringify({ a: 2, b: 1 })).toBe('{"a":2,"b":1}');
  });

  it('массивы сохраняют порядок', () => {
    expect(canonicalStringify([3, 1, 2])).toBe('[3,1,2]');
  });

  it('вложенные объекты рекурсивно сортируются', () => {
    expect(
      canonicalStringify({
        z: { y: 2, x: 1 },
        a: [{ q: 1, p: 2 }],
      })
    ).toBe('{"a":[{"p":2,"q":1}],"z":{"x":1,"y":2}}');
  });

  it('bigint конвертируется в строку', () => {
    expect(canonicalStringify({ n: 100n })).toBe('{"n":"100"}');
  });
});

describe('Story 6.4: computeBcChecksum', () => {
  it('64 lowercase hex chars', () => {
    const h = computeBcChecksum({ a: 1 });
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('детерминирован: одинаковый объект → одинаковый hash', () => {
    const a = { id: 1, coopname: 'voskhod', title: 'X' };
    const b = { id: 1, coopname: 'voskhod', title: 'X' };
    expect(computeBcChecksum(a)).toBe(computeBcChecksum(b));
  });

  it('детерминирован: перестановка ключей не влияет (canonical-order)', () => {
    expect(computeBcChecksum({ a: 1, b: 2 })).toBe(computeBcChecksum({ b: 2, a: 1 }));
  });

  it('change-detection: изменение поля → новый hash', () => {
    const h1 = computeBcChecksum({ id: 1, title: 'X' });
    const h2 = computeBcChecksum({ id: 1, title: 'Y' });
    expect(h1).not.toBe(h2);
  });

  it('change-detection: добавление поля → новый hash', () => {
    const h1 = computeBcChecksum({ id: 1 });
    const h2 = computeBcChecksum({ id: 1, extra: 'X' });
    expect(h1).not.toBe(h2);
  });

  it('null/undefined → стабильный hash от "null"', () => {
    const expected = createHash('sha256').update('null', 'utf8').digest('hex');
    expect(computeBcChecksum(null)).toBe(expected);
    expect(computeBcChecksum(undefined)).toBe(expected);
  });

  it('массивы — порядок важен (не сортируем массивы)', () => {
    expect(computeBcChecksum({ items: [1, 2] })).not.toBe(computeBcChecksum({ items: [2, 1] }));
  });

  it('вложенные структуры: контрольная проверка по фиксированному входу', () => {
    // Это catch-test: если кто-то поменяет алгоритм canonicalStringify несовместимо,
    // этот тест упадёт. Контрольное значение получено руками.
    const data = {
      version: '1.0',
      signatures: [
        { public_key: 'pk', signed_at: '2026-06-02', signature: 'sig', meta: '' },
      ],
      hash: 'h',
    };
    const expected = createHash('sha256')
      .update(
        '{"hash":"h","signatures":[{"meta":"","public_key":"pk","signature":"sig","signed_at":"2026-06-02"}],"version":"1.0"}',
        'utf8'
      )
      .digest('hex');
    expect(computeBcChecksum(data)).toBe(expected);
  });
});
