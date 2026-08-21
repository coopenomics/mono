import { assertContextHasNoSecrets } from './audit/audit.service';
import { mapAuthentikEvent } from './authentik-events.controller';

describe('mapAuthentikEvent (Story 1.5 + 8.3)', () => {
  describe('policy_execution → слабый пароль (Story 1.5)', () => {
    it('passing=false ⇒ WeakPasswordRejected', () => {
      const r = mapAuthentikEvent({
        event_action: 'policy_execution',
        passing: false,
        event_user: 'ant',
        messages: ['too short'],
        created: '2026-06-13T00:00:00',
      });
      expect(r).toEqual({
        event: 'WeakPasswordRejected',
        subjectId: 'ant',
        actor: 'ant',
        result: 'failure',
        context: { messages: ['too short'], authentik_created: '2026-06-13T00:00:00' },
      });
    });

    it('passing=true ⇒ null (не наш кейс)', () => {
      expect(mapAuthentikEvent({ event_action: 'policy_execution', passing: true })).toBeNull();
    });
  });

  describe('OIDC-операции → семантические Oidc* (Story 8.3)', () => {
    it('login ⇒ OidcLoginSuccess (success) + ip + app в контексте', () => {
      const r = mapAuthentikEvent({
        event_action: 'login',
        event_user: 'ant',
        client_ip: '1.2.3.4',
        app: 'CoopID',
        created: '2026-06-13T10:00:00',
      });
      expect(r).toEqual({
        event: 'OidcLoginSuccess',
        subjectId: 'ant',
        actor: 'ant',
        result: 'success',
        ip: '1.2.3.4',
        context: { authentik_action: 'login', app: 'CoopID', authentik_created: '2026-06-13T10:00:00' },
      });
    });

    it('logout ⇒ OidcLogout', () => {
      expect(mapAuthentikEvent({ event_action: 'logout', event_user: 'ant' })?.event).toBe('OidcLogout');
    });

    it('authorize_application ⇒ OidcTokenIssued с app', () => {
      const r = mapAuthentikEvent({ event_action: 'authorize_application', event_user: 'ant', app: 'Gitea' });
      expect(r?.event).toBe('OidcTokenIssued');
      expect(r?.result).toBe('success');
      expect(r?.context?.app).toBe('Gitea');
    });
  });

  describe('native-события authentik → Authentik* (Story 8.3)', () => {
    it('login_failed ⇒ AuthentikLoginFailed (failure)', () => {
      const r = mapAuthentikEvent({ event_action: 'login_failed', event_user: 'ant', client_ip: '9.9.9.9' });
      expect(r?.event).toBe('AuthentikLoginFailed');
      expect(r?.result).toBe('failure');
      expect(r?.ip).toBe('9.9.9.9');
    });

    it('suspicious_request ⇒ AuthentikSuspiciousRequest (failure)', () => {
      const r = mapAuthentikEvent({ event_action: 'suspicious_request', event_user: 'ant' });
      expect(r?.event).toBe('AuthentikSuspiciousRequest');
      expect(r?.result).toBe('failure');
    });

    it('неизвестный action ⇒ Authentik<PascalCase> (success по умолчанию)', () => {
      const r = mapAuthentikEvent({ event_action: 'user_write', event_user: 'ant' });
      expect(r?.event).toBe('AuthentikUserWrite');
      expect(r?.result).toBe('success');
    });
  });

  it('нет event_action ⇒ null', () => {
    expect(mapAuthentikEvent({})).toBeNull();
    expect(mapAuthentikEvent({ event_user: 'ant' })).toBeNull();
  });

  it('контекст любого замапленного события проходит secret-blacklist аудита', () => {
    for (const action of ['login', 'logout', 'authorize_application', 'login_failed', 'suspicious_request', 'user_write']) {
      const r = mapAuthentikEvent({ event_action: action, event_user: 'ant', app: 'X' });
      expect(() => assertContextHasNoSecrets(r?.context ?? {})).not.toThrow();
    }
  });
});
