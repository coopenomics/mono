import { AccessRulePrincipalKind } from '~/domain/auth-v2/ports/access-rules.port';
import { RedisAccessRulesInvalidationPublisher } from './redis-access-rules-invalidation.publisher';

describe('RedisAccessRulesInvalidationPublisher (Story 6.2)', () => {
  it('публикует принципала в канал coopid:access-rules:invalidate', async () => {
    const publish = jest.fn(async () => 1);
    const pub = new RedisAccessRulesInvalidationPublisher({ publisher: { publish } as never });

    await pub.publish({ subjectType: AccessRulePrincipalKind.Participant, subjectId: 'ant' });

    expect(publish).toHaveBeenCalledWith(
      'coopid:access-rules:invalidate',
      JSON.stringify({ subjectType: 'participant', subjectId: 'ant' }),
    );
  });
});
