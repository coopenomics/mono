import { signReadUrl, verifyReadUrl } from './signing';

describe('signing', () => {
  const secret = 'test-secret-32-bytes-aaaaaaaaaaaa';

  it('подпись детерминирована для одинакового набора параметров', () => {
    const a = signReadUrl({ bucket: 'b1', key: 'k1', expUnix: 1000, secret });
    const b = signReadUrl({ bucket: 'b1', key: 'k1', expUnix: 1000, secret });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('verify проходит на корректную подпись', () => {
    const sig = signReadUrl({ bucket: 'orders-images', key: 'a/b.jpg', expUnix: 9999, secret });
    expect(verifyReadUrl({ bucket: 'orders-images', key: 'a/b.jpg', expUnix: 9999, sig, secret })).toBe(true);
  });

  it('verify отклоняет подмену bucket', () => {
    const sig = signReadUrl({ bucket: 'orders-images', key: 'a/b.jpg', expUnix: 9999, secret });
    expect(verifyReadUrl({ bucket: 'expenses-receipts', key: 'a/b.jpg', expUnix: 9999, sig, secret })).toBe(false);
  });

  it('verify отклоняет подмену key', () => {
    const sig = signReadUrl({ bucket: 'orders-images', key: 'a/b.jpg', expUnix: 9999, secret });
    expect(verifyReadUrl({ bucket: 'orders-images', key: 'a/c.jpg', expUnix: 9999, sig, secret })).toBe(false);
  });

  it('verify отклоняет подмену exp', () => {
    const sig = signReadUrl({ bucket: 'orders-images', key: 'a/b.jpg', expUnix: 9999, secret });
    expect(verifyReadUrl({ bucket: 'orders-images', key: 'a/b.jpg', expUnix: 10000, sig, secret })).toBe(false);
  });

  it('verify отклоняет подмену секрета', () => {
    const sig = signReadUrl({ bucket: 'orders-images', key: 'a/b.jpg', expUnix: 9999, secret });
    expect(
      verifyReadUrl({ bucket: 'orders-images', key: 'a/b.jpg', expUnix: 9999, sig, secret: 'other' }),
    ).toBe(false);
  });

  it('verify отклоняет подпись неверной длины без выброса исключения', () => {
    expect(
      verifyReadUrl({ bucket: 'b', key: 'k', expUnix: 1, sig: 'abcd', secret }),
    ).toBe(false);
  });

  it('verify отклоняет не-hex без выброса исключения', () => {
    const fake = 'z'.repeat(64);
    expect(
      verifyReadUrl({ bucket: 'b', key: 'k', expUnix: 1, sig: fake, secret }),
    ).toBe(false);
  });
});
