import { parseTrustProxy } from './trust-proxy';

describe('TRUST_PROXY — кому верить X-Forwarded-For', () => {
  it('по умолчанию — список частных сетей, как его понимает Express', () => {
    expect(parseTrustProxy('loopback, linklocal, uniquelocal')).toBe('loopback, linklocal, uniquelocal');
  });

  it('true/false и число звеньев переводятся в значения, а не в адреса', () => {
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy(' false ')).toBe(false);
    expect(parseTrustProxy('2')).toBe(2);
  });
});
