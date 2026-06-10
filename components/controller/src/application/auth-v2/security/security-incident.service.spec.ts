import { BadRequestException } from '@nestjs/common';
import { SecurityIncidentService } from './security-incident.service';

function setup() {
  const sessions = { revokeAll: jest.fn().mockResolvedValue({ revoked: 3 }) };
  const notMeTokens = { issue: jest.fn(), consume: jest.fn() };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new SecurityIncidentService(sessions as never, notMeTokens as never, audit as never);
  return { service, sessions, notMeTokens, audit };
}

describe('SecurityIncidentService (Story 3.10 — флаг «Это не я»)', () => {
  describe('report (аутентифицированный путь из настроек)', () => {
    it('отзывает все сессии и пишет audit с источником/счётчиком', async () => {
      const { service, sessions, audit } = setup();

      const res = await service.report({ subjectId: 'u1', ip: '1.2.3.4', source: 'settings', reportedSessionId: 'sess-9' });

      expect(sessions.revokeAll).toHaveBeenCalledWith('u1', '1.2.3.4');
      expect(res).toEqual({ revoked: 3 });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'coopid.security.suspicious_login_reported',
          subjectId: 'u1',
          result: 'success',
          context: { source: 'settings', reported_session_id: 'sess-9', revoked_count: 3 },
        }),
      );
    });

    it('best-effort audit: сбой записи не пробрасывается (сессии уже отозваны)', async () => {
      const { service, audit } = setup();
      audit.record.mockRejectedValueOnce(new Error('audit db down'));

      await expect(service.report({ subjectId: 'u1', ip: null, source: 'settings' })).resolves.toEqual({ revoked: 3 });
    });
  });

  describe('reportByToken (one-click из письма)', () => {
    it('валидный токен → consume → отзыв сессий с источником one_click', async () => {
      const { service, sessions, notMeTokens, audit } = setup();
      notMeTokens.consume.mockResolvedValueOnce('u7');

      const res = await service.reportByToken('token-xyz', '9.9.9.9');

      expect(notMeTokens.consume).toHaveBeenCalledWith('token-xyz');
      expect(sessions.revokeAll).toHaveBeenCalledWith('u7', '9.9.9.9');
      expect(res).toEqual({ revoked: 3 });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ subjectId: 'u7', context: expect.objectContaining({ source: 'one_click' }) }),
      );
    });

    it('недействительный/использованный токен → BadRequest, сессии не трогаем', async () => {
      const { service, sessions, notMeTokens } = setup();
      notMeTokens.consume.mockResolvedValueOnce(null);

      await expect(service.reportByToken('bad', null)).rejects.toBeInstanceOf(BadRequestException);
      expect(sessions.revokeAll).not.toHaveBeenCalled();
    });
  });
});
