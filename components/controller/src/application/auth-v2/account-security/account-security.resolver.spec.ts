import type { SessionsService } from '../sessions/sessions.service';
import type { TwoFactorService } from '../two-factor/two-factor.service';
import type { RecoveryStrategyService } from '../recovery/recovery-strategy.service';
import type { SecurityIncidentService } from '../security/security-incident.service';
import type { LoginFactorsService } from '../login-2fa/login-factors.service';
import { RecoveryStrategy } from '~/domain/auth-v2/recovery-strategy/recovery-strategy.types';
import { AccountSecurityResolver } from './account-security.resolver';

// session_id — идентификатор текущей сессии из JWT: по нему список помечает
// current, а «завершить все» щадит ту, из которой пришёл запрос.
const USER = { id: 'u1', username: 'payer1', role: 'user', session_id: 's1' };
const IP = '203.0.113.7';

function build() {
  const sessions = {
    list: jest.fn(async () => [
      {
        id: 's1',
        device: 'Firefox',
        ip: '10.0.0.1',
        createdAt: '2026-06-13T00:00:00Z',
        lastSeenAt: '2026-06-14T00:00:00Z',
        current: true,
      },
    ]),
    revoke: jest.fn(async () => undefined),
    revokeAll: jest.fn(async () => ({ revoked: 3 })),
  };
  const twoFactor = {
    beginEnrollment: jest.fn(async () => ({ secret: 'BASE32SECRET', otpauthUri: 'otpauth://totp/x' })),
    activate: jest.fn(async () => undefined),
    disable: jest.fn(async () => undefined),
  };
  const recoveryStrategy = {
    getStrategy: jest.fn(async () => RecoveryStrategy.OfflineCode),
    setStrategy: jest.fn(async () => undefined),
  };
  const incidents = {
    report: jest.fn(async () => ({ revoked: 2 })),
  };
  const loginFactors = {
    get: jest.fn(async () => ({ totp_enrolled: true, second_factor: 'totp' })),
    set: jest.fn(async () => ({ totp_enrolled: true, second_factor: 'totp' })),
    onTotpUnenrolled: jest.fn(async () => undefined),
  };
  const resolver = new AccountSecurityResolver(
    sessions as unknown as SessionsService,
    twoFactor as unknown as TwoFactorService,
    recoveryStrategy as unknown as RecoveryStrategyService,
    incidents as unknown as SecurityIncidentService,
    loginFactors as unknown as LoginFactorsService,
  );
  return { resolver, sessions, twoFactor, recoveryStrategy, incidents, loginFactors };
}

describe('AccountSecurityResolver', () => {
  it('getSessions маппит сессии в snake_case и передаёт refresh-токен текущей сессии', async () => {
    const { resolver, sessions } = build();
    const out = await resolver.getSessions(USER, 'rt-current');
    expect(sessions.list).toHaveBeenCalledWith('u1', 'rt-current', 's1');
    expect(out).toEqual([
      {
        id: 's1',
        device: 'Firefox',
        ip: '10.0.0.1',
        created_at: '2026-06-13T00:00:00Z',
        last_seen_at: '2026-06-14T00:00:00Z',
        current: true,
      },
    ]);
  });

  it('getRecoveryStrategy возвращает стратегию пайщика', async () => {
    const { resolver, recoveryStrategy } = build();
    const out = await resolver.getRecoveryStrategy(USER);
    expect(recoveryStrategy.getStrategy).toHaveBeenCalledWith('u1');
    expect(out).toBe(RecoveryStrategy.OfflineCode);
  });

  it('revokeSession завершает сессию по id с IP для аудита', async () => {
    const { resolver, sessions } = build();
    const ok = await resolver.revokeSession({ session_id: 's1' }, USER, IP);
    expect(ok).toBe(true);
    expect(sessions.revoke).toHaveBeenCalledWith('u1', 's1', IP);
  });

  it('revokeAllSessions возвращает число завершённых', async () => {
    const { resolver, sessions } = build();
    const out = await resolver.revokeAllSessions(USER, IP);
    // Третьим аргументом идёт текущая сессия — её revokeAll не трогает.
    expect(sessions.revokeAll).toHaveBeenCalledWith('u1', IP, 's1');
    expect(out).toEqual({ revoked: 3 });
  });

  it('enrollTwoFactor маппит otpauthUri в otpauth_uri', async () => {
    const { resolver, twoFactor } = build();
    const out = await resolver.enrollTwoFactor(USER);
    expect(twoFactor.beginEnrollment).toHaveBeenCalledWith('u1', 'payer1');
    expect(out).toEqual({ secret: 'BASE32SECRET', otpauth_uri: 'otpauth://totp/x' });
  });

  it('activateTwoFactor подтверждает второй фактор кодом', async () => {
    const { resolver, twoFactor } = build();
    const ok = await resolver.activateTwoFactor({ code: '123456' }, USER, IP);
    expect(ok).toBe(true);
    expect(twoFactor.activate).toHaveBeenCalledWith('u1', '123456', IP);
  });

  it('disableTwoFactor отключает второй фактор кодом', async () => {
    const { resolver, twoFactor } = build();
    const ok = await resolver.disableTwoFactor({ code: '654321' }, USER, IP);
    expect(ok).toBe(true);
    expect(twoFactor.disable).toHaveBeenCalledWith('u1', '654321', IP);
  });

  it('setRecoveryStrategy меняет стратегию со step-up кодом', async () => {
    const { resolver, recoveryStrategy } = build();
    const ok = await resolver.setRecoveryStrategy({ strategy: RecoveryStrategy.Council, code: '000111' }, USER, IP);
    expect(ok).toBe(true);
    expect(recoveryStrategy.setStrategy).toHaveBeenCalledWith('u1', RecoveryStrategy.Council, '000111', IP);
  });

  it('reportNotMe зовёт report с source=settings и подозрительной сессией', async () => {
    const { resolver, incidents } = build();
    const out = await resolver.reportNotMe({ session_id: 's9' }, USER, IP);
    expect(incidents.report).toHaveBeenCalledWith({
      subjectId: 'u1',
      ip: IP,
      source: 'settings',
      reportedSessionId: 's9',
    });
    expect(out).toEqual({ revoked: 2 });
  });

  it('reportNotMe без session_id передаёт reportedSessionId=null', async () => {
    const { resolver, incidents } = build();
    await resolver.reportNotMe({}, USER, IP);
    expect(incidents.report).toHaveBeenCalledWith({
      subjectId: 'u1',
      ip: IP,
      source: 'settings',
      reportedSessionId: null,
    });
  });
});
