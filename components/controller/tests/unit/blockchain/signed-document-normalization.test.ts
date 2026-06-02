/**
 * Story 6.2 (Epic 6): юнит-тесты parseSignedDocPath + AbstractBlockchainDeltaMapper.normalizeSignedDocuments.
 *
 * Покрытие:
 * - parser: top-level, nested, array, mixed.
 * - normalize: top-level path, nested-array path, missing-field no-op,
 *   несколько полей одновременно, отсутствие signedDocumentFields → no-op.
 */

import {
  AbstractBlockchainDeltaMapper,
  parseSignedDocPath,
  type SignedDocField,
} from '~/shared/abstract-blockchain-delta.mapper';
import type { IDelta } from '~/types/common';

// Минимальный mapper-стаб для прямого вызова protected normalizeSignedDocuments.
class TestMapper<T = any> extends AbstractBlockchainDeltaMapper<T> {
  constructor(fields: ReadonlyArray<SignedDocField>) {
    super();
    (this as any).signedDocumentFields = fields;
  }
  getSupportedContractNames(): string[] {
    return [];
  }
  getSupportedTableNames(): string[] {
    return [];
  }
  mapDeltaToBlockchainData(_delta: IDelta): T | null {
    return null;
  }
  extractSyncValue(_delta: IDelta): string {
    return '';
  }
  extractSyncKey(): string {
    return '';
  }
  // Expose for test
  public normalize<U>(data: U): U {
    return (this as any).normalizeSignedDocuments(data);
  }
}

// Тестовый «chain document» формата IChainDocument2: meta — JSON-строка, после
// нормализации meta становится распарсенным объектом.
const CHAIN_DOC = {
  version: '1.0',
  hash: 'h1',
  doc_hash: 'dh1',
  meta_hash: 'mh1',
  meta: '{"k":"v"}',
  signatures: [{ signer: 'alice', signature: 'sig' }],
};

describe('Story 6.2: parseSignedDocPath', () => {
  it('top-level: "appendix" → [{field appendix}]', () => {
    expect(parseSignedDocPath('appendix')).toEqual([{ kind: 'field', key: 'appendix' }]);
  });

  it('nested: "a.b" → [{field a},{field b}]', () => {
    expect(parseSignedDocPath('a.b')).toEqual([
      { kind: 'field', key: 'a' },
      { kind: 'field', key: 'b' },
    ]);
  });

  it('array: "a[]" → [{field a},{array}]', () => {
    expect(parseSignedDocPath('a[]')).toEqual([
      { kind: 'field', key: 'a' },
      { kind: 'array' },
    ]);
  });

  it('mixed: "statement.attachments[].signed_attachment"', () => {
    expect(parseSignedDocPath('statement.attachments[].signed_attachment')).toEqual([
      { kind: 'field', key: 'statement' },
      { kind: 'field', key: 'attachments' },
      { kind: 'array' },
      { kind: 'field', key: 'signed_attachment' },
    ]);
  });
});

describe('Story 6.2: normalizeSignedDocuments', () => {
  it('top-level: appendix-mapper кейс — meta из string в объект', () => {
    const mapper = new TestMapper([{ path: 'appendix' }]);
    const data = { id: 1, appendix: { ...CHAIN_DOC } };
    const result = mapper.normalize(data);
    expect(result.appendix.meta).toEqual({ k: 'v' });
    expect(result.appendix.hash).toBe('h1');
  });

  it('nested-array: statement.attachments[].signed_attachment — каждый attachment нормализуется', () => {
    const mapper = new TestMapper([{ path: 'statement.attachments[].signed_attachment' }]);
    const data = {
      statement: {
        attachments: [
          { kind: 'a', signed_attachment: { ...CHAIN_DOC } },
          { kind: 'b', signed_attachment: { ...CHAIN_DOC, meta: '{"n":2}' } },
        ],
      },
    };
    const result = mapper.normalize(data);
    expect(result.statement.attachments[0].signed_attachment.meta).toEqual({ k: 'v' });
    expect(result.statement.attachments[1].signed_attachment.meta).toEqual({ n: 2 });
  });

  it('missing-field: путь к несуществующему полю → тихий no-op', () => {
    const mapper = new TestMapper([{ path: 'missing' }]);
    const data: any = { id: 1 };
    const result = mapper.normalize(data);
    expect(result).toEqual({ id: 1 });
  });

  it('несколько полей: оба нормализуются', () => {
    const mapper = new TestMapper([{ path: 'a' }, { path: 'b' }]);
    const data = { a: { ...CHAIN_DOC }, b: { ...CHAIN_DOC, meta: '{"x":1}' } };
    const result = mapper.normalize(data);
    expect(result.a.meta).toEqual({ k: 'v' });
    expect(result.b.meta).toEqual({ x: 1 });
  });

  it('пустой signedDocumentFields: данные не трогаем', () => {
    const mapper = new TestMapper([]);
    const data = { whatever: 'value' };
    const result = mapper.normalize(data);
    expect(result).toEqual({ whatever: 'value' });
  });

  it('null/undefined data: no-op', () => {
    const mapper = new TestMapper([{ path: 'appendix' }]);
    expect(mapper.normalize(null as any)).toBeNull();
    expect(mapper.normalize(undefined as any)).toBeUndefined();
  });

  it('immutability: caller должен сам делать shallow-copy — helper мутирует in-place', () => {
    const mapper = new TestMapper([{ path: 'appendix' }]);
    const orig = { appendix: { ...CHAIN_DOC } };
    const copy = { ...orig };
    mapper.normalize(copy);
    // меняется именно copy (и его appendix, который shared reference с orig.appendix)
    // — для гарантии immutability в реальном mapper делается `{ ...value }` + transform внутри.
    expect((copy.appendix as any).meta).toEqual({ k: 'v' });
  });
});

describe('Story 6.3: schema-валидация ДО transform', () => {
  // re-import без top-level чтобы избежать циклов; используем chainDocumentSchema.
  const { chainDocumentSchema, singleSignatureChainDocumentSchema } = require('~/shared/sync/signed-document-schemas');

  it('валидная schema → нормализация проходит', () => {
    const mapper = new TestMapper([{ path: 'appendix', schema: chainDocumentSchema }]);
    const data = {
      appendix: {
        ...CHAIN_DOC,
        hash: 'h'.repeat(64),
        doc_hash: 'd'.repeat(64),
        meta_hash: 'm'.repeat(64),
        signatures: [
          { public_key: 'pk', signature: 'sig', signed_at: '2026-06-02T12:00:00', meta: '' },
        ],
      },
    };
    expect(() => mapper.normalize(data)).not.toThrow();
    expect((data.appendix as any).meta).toEqual({ k: 'v' });
  });

  it('два подписанта в single-signature schema → ZodError', () => {
    const mapper = new TestMapper([{ path: 'appendix', schema: singleSignatureChainDocumentSchema }]);
    const data = {
      appendix: {
        ...CHAIN_DOC,
        signatures: [
          { public_key: 'pk1', signature: 'sig1', signed_at: '2026-06-02T12:00:00', meta: '' },
          { public_key: 'pk2', signature: 'sig2', signed_at: '2026-06-02T12:00:00', meta: '' },
        ],
      },
    };
    expect(() => mapper.normalize(data)).toThrow();
  });

  it('schema mismatch (нет hash) → ZodError, meta НЕ обновляется (transform не вызвался)', () => {
    const mapper = new TestMapper([{ path: 'appendix', schema: chainDocumentSchema }]);
    const data = {
      appendix: { ...CHAIN_DOC, hash: '' }, // hash пуст — Zod fail
    };
    expect(() => mapper.normalize(data)).toThrow();
    // meta осталось JSON-строкой, т.к. transform не отработал
    expect(typeof (data.appendix as any).meta).toBe('string');
  });
});
