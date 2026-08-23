import { ForbiddenException } from '@nestjs/common';
import { VerificationAuthorityService } from './verification-authority.service';

/**
 * Полномочия сверки проверяет сервер: транзакцию подписывает кооператив, и
 * контракт в этом случае ему доверяет. Круг тот же, что на контракте: участок —
 * председатель участка и доверенные лица, без участка — председатель совета.
 */
describe('VerificationAuthorityService', () => {
  const branch = { braname: 'bra1', trustee: 'kuchair', trusted: ['helper1', 'helper2'] };
  let branchPort: { getBranch: jest.Mock; getBranches: jest.Mock };
  let service: VerificationAuthorityService;

  beforeEach(() => {
    branchPort = { getBranch: jest.fn().mockResolvedValue(branch), getBranches: jest.fn() };
    service = new VerificationAuthorityService(branchPort as any);
  });

  it('председатель совета сверяет без указания участка', async () => {
    await expect(service.assertMayVerify({ username: 'ant', role: 'chairman' })).resolves.toBeUndefined();
    expect(branchPort.getBranch).not.toHaveBeenCalled();
  });

  it('обычный пайщик не сверяет от имени совета', async () => {
    await expect(service.assertMayVerify({ username: 'bob', role: 'user' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('председатель участка и доверенное лицо сверяют на своём участке', async () => {
    await expect(
      service.assertMayVerify({ username: 'kuchair', role: 'user', braname: 'bra1' }),
    ).resolves.toBeUndefined();
    await expect(
      service.assertMayVerify({ username: 'helper2', role: 'user', braname: 'bra1' }),
    ).resolves.toBeUndefined();
  });

  it('посторонний не сверяет на участке даже будучи председателем совета', async () => {
    await expect(
      service.assertMayVerify({ username: 'ant', role: 'chairman', braname: 'bra1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('несуществующий участок — отказ', async () => {
    branchPort.getBranch.mockResolvedValue(null);
    await expect(
      service.assertMayVerify({ username: 'kuchair', role: 'user', braname: 'nope' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('отзыв верификации — только председатель совета', () => {
    expect(() => service.assertMayUnverify({ username: 'ant', role: 'chairman' })).not.toThrow();
    expect(() => service.assertMayUnverify({ username: 'kuchair', role: 'user' })).toThrow(ForbiddenException);
  });
});
