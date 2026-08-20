import { ForbiddenException } from '@nestjs/common';
import { VerificationResolver } from './verification.resolver';
import type { VerificationOnsiteService } from './verification-onsite.service';

/**
 * Полномочия совета проверяет сервер: транзакцию подписывает кооператив, и
 * контракт в этом случае доверяет ему. Полномочия участка остаются на контракте,
 * поэтому оператор участка проходит здесь без роли председателя.
 */
describe('VerificationResolver', () => {
  const chairman = { id: '1', username: 'ant', role: 'chairman' };
  const member = { id: '2', username: 'bob', role: 'user' };

  let onsite: jest.Mocked<Pick<VerificationOnsiteService, 'verifyOnsite' | 'unverify'>>;
  let resolver: VerificationResolver;

  beforeEach(() => {
    onsite = {
      verifyOnsite: jest.fn().mockResolvedValue([]),
      unverify: jest.fn().mockResolvedValue([]),
    };
    resolver = new VerificationResolver(onsite as unknown as VerificationOnsiteService);
  });

  it('председатель совета подтверждает личность без указания участка', async () => {
    await resolver.verifyParticipantOnsite(chairman, { username: 'zoe' });
    expect(onsite.verifyOnsite).toHaveBeenCalledWith('ant', 'zoe', undefined);
  });

  it('обычный пайщик не подтверждает личность от имени совета', async () => {
    await expect(resolver.verifyParticipantOnsite(member, { username: 'zoe' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(onsite.verifyOnsite).not.toHaveBeenCalled();
  });

  it('пайщик не верифицирует сам себя от имени совета', async () => {
    await expect(resolver.verifyParticipantOnsite(member, { username: member.username })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(onsite.verifyOnsite).not.toHaveBeenCalled();
  });

  it('оператор участка подтверждает личность без роли председателя — полномочия проверит контракт', async () => {
    await resolver.verifyParticipantOnsite(member, { username: 'zoe', braname: 'bra1' });
    expect(onsite.verifyOnsite).toHaveBeenCalledWith('bob', 'zoe', 'bra1');
  });

  it('отзыв верификации доступен только председателю совета', async () => {
    await expect(resolver.unverifyParticipant(member, { username: 'zoe' })).rejects.toBeInstanceOf(ForbiddenException);
    await resolver.unverifyParticipant(chairman, { username: 'zoe' });
    expect(onsite.unverify).toHaveBeenCalledWith('ant', 'zoe');
  });
});
