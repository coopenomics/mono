import 'reflect-metadata';
import { BucketRegistry } from './bucket-registry';
import { UseBucket, bucketTokenFor } from './use-bucket.decorator';

describe('UseBucket decorator', () => {
  beforeEach(() => {
    BucketRegistry._resetForTests();
  });

  it('регистрирует спеку класса в BucketRegistry', () => {
    @UseBucket({ name: 'demo:images', maxBytes: 1024, allowedMime: ['image/png'] })
    class DemoService {}

    const got = BucketRegistry.get(DemoService);
    expect(got).toBeDefined();
    expect(got?.name).toBe('demo:images');
    expect(got?.maxBytes).toBe(1024);
    expect(got?.allowedMime).toEqual(['image/png']);
  });

  it('bucketTokenFor стабилен и зависит только от имени класса', () => {
    class FooService {}
    expect(bucketTokenFor(FooService)).toBe('__InterFileStorageBucket:FooService');
    expect(bucketTokenFor(FooService)).toBe(bucketTokenFor(FooService));
  });
});
