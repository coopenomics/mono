/**
 * Story 6.3 (Epic 6): юнит-тесты Zod-схем подписанных документов.
 */

import {
  signatureInfoSchema,
  chainDocumentSchema,
  singleSignatureChainDocumentSchema,
  twoSignatureChainDocumentSchema,
} from '~/shared/sync/signed-document-schemas';

const VALID_SIG = {
  public_key: 'EOS1...',
  signature: 'SIG_K1_...',
  signed_at: '2026-06-02T12:00:00.000',
  meta: '',
};

const VALID_CHAIN_DOC = {
  version: '1.0',
  hash: 'h'.repeat(64),
  doc_hash: 'd'.repeat(64),
  meta_hash: 'm'.repeat(64),
  meta: '{}',
  signatures: [VALID_SIG],
};

describe('Story 6.3: signatureInfoSchema', () => {
  it('валидная подпись проходит', () => {
    expect(() => signatureInfoSchema.parse(VALID_SIG)).not.toThrow();
  });

  it('пустой public_key — fail', () => {
    expect(() => signatureInfoSchema.parse({ ...VALID_SIG, public_key: '' })).toThrow();
  });

  it('пропущенный signed_at — fail', () => {
    const { signed_at: _, ...rest } = VALID_SIG;
    expect(() => signatureInfoSchema.parse(rest)).toThrow();
  });
});

describe('Story 6.3: chainDocumentSchema (≥1)', () => {
  it('1 подпись — ok', () => {
    expect(() => chainDocumentSchema.parse(VALID_CHAIN_DOC)).not.toThrow();
  });

  it('2 подписи — ok', () => {
    expect(() =>
      chainDocumentSchema.parse({ ...VALID_CHAIN_DOC, signatures: [VALID_SIG, VALID_SIG] })
    ).not.toThrow();
  });

  it('0 подписей — fail (минимум 1)', () => {
    expect(() => chainDocumentSchema.parse({ ...VALID_CHAIN_DOC, signatures: [] })).toThrow();
  });

  it('пропущенный hash — fail', () => {
    const { hash: _, ...rest } = VALID_CHAIN_DOC;
    expect(() => chainDocumentSchema.parse(rest)).toThrow();
  });
});

describe('Story 6.3: singleSignatureChainDocumentSchema (=1)', () => {
  it('ровно 1 подпись — ok', () => {
    expect(() => singleSignatureChainDocumentSchema.parse(VALID_CHAIN_DOC)).not.toThrow();
  });

  it('2 подписи — fail', () => {
    expect(() =>
      singleSignatureChainDocumentSchema.parse({ ...VALID_CHAIN_DOC, signatures: [VALID_SIG, VALID_SIG] })
    ).toThrow();
  });

  it('0 подписей — fail', () => {
    expect(() =>
      singleSignatureChainDocumentSchema.parse({ ...VALID_CHAIN_DOC, signatures: [] })
    ).toThrow();
  });
});

describe('Story 6.3: twoSignatureChainDocumentSchema (=2)', () => {
  it('ровно 2 подписи — ok', () => {
    expect(() =>
      twoSignatureChainDocumentSchema.parse({ ...VALID_CHAIN_DOC, signatures: [VALID_SIG, VALID_SIG] })
    ).not.toThrow();
  });

  it('1 подпись — fail', () => {
    expect(() => twoSignatureChainDocumentSchema.parse(VALID_CHAIN_DOC)).toThrow();
  });

  it('3 подписи — fail (двухподписный акт, не мульти)', () => {
    expect(() =>
      twoSignatureChainDocumentSchema.parse({ ...VALID_CHAIN_DOC, signatures: [VALID_SIG, VALID_SIG, VALID_SIG] })
    ).toThrow();
  });
});
