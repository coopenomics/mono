import type { InterFileStorageBucketSpec } from '@coopenomics/inter';
import { BucketRegistry } from './bucket-registry';

describe('BucketRegistry', () => {
  beforeEach(() => {
    BucketRegistry._resetForTests();
  });

  const spec = (name: string): InterFileStorageBucketSpec => ({
    name,
    maxBytes: 1024,
    allowedMime: ['image/jpeg'],
  });

  it('add + get возвращает зарегистрированную спеку', () => {
    class A {}
    BucketRegistry.add(A, spec('ext-a:images'));
    expect(BucketRegistry.get(A)?.name).toBe('ext-a:images');
  });

  it('повторная регистрация того же класса под тем же именем — no-op (идемпотентно)', () => {
    class A {}
    BucketRegistry.add(A, spec('ext-a:images'));
    expect(() => BucketRegistry.add(A, spec('ext-a:images'))).not.toThrow();
  });

  it('повторная регистрация того же класса под другим именем — выбрасывает', () => {
    class A {}
    BucketRegistry.add(A, spec('ext-a:images'));
    expect(() => BucketRegistry.add(A, spec('ext-a:other'))).toThrow(/уже зарегистрирован/);
  });

  it('list возвращает все зарегистрированные пары', () => {
    class A {}
    class B {}
    BucketRegistry.add(A, spec('ext-a:images'));
    BucketRegistry.add(B, spec('ext-b:receipts'));
    const list = BucketRegistry.list();
    expect(list).toHaveLength(2);
    expect(list.map((r) => r.spec.name).sort()).toEqual(['ext-a:images', 'ext-b:receipts']);
  });
});
