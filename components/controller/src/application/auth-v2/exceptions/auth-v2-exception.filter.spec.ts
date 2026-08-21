import type { ArgumentsHost } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { AuthV2Error, AuthV2ErrorCode, VaultServerDecryptionForbiddenError } from '~/domain/auth-v2/errors/auth-v2.error';
import { AuthV2ExceptionFilter } from './auth-v2-exception.filter';

function mockHost(): { host: ArgumentsHost; res: { status: jest.Mock; json: jest.Mock } } {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => res }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

describe('AuthV2ExceptionFilter (Story 1.11)', () => {
  const filter = new AuthV2ExceptionFilter();

  it.each([
    [AuthV2ErrorCode.CooposDegraded, HttpStatus.SERVICE_UNAVAILABLE],
    [AuthV2ErrorCode.VaultServerDecryptionForbidden, HttpStatus.FORBIDDEN],
    [AuthV2ErrorCode.InvalidCredentials, HttpStatus.BAD_REQUEST],
    [AuthV2ErrorCode.VaultDecryptionFailed, HttpStatus.BAD_REQUEST],
    [AuthV2ErrorCode.TimestampTooOld, HttpStatus.UNAUTHORIZED],
    [AuthV2ErrorCode.SessionBindingReused, HttpStatus.UNAUTHORIZED],
    [AuthV2ErrorCode.SessionBindingExpired, HttpStatus.UNAUTHORIZED],
    [AuthV2ErrorCode.ChainVerificationFailed, HttpStatus.UNAUTHORIZED],
    [AuthV2ErrorCode.TooManyAttempts, HttpStatus.TOO_MANY_REQUESTS],
    [AuthV2ErrorCode.TooManyRecoveryAttempts, HttpStatus.TOO_MANY_REQUESTS],
    [AuthV2ErrorCode.InvalidTwoFactorCode, HttpStatus.UNAUTHORIZED],
    [AuthV2ErrorCode.TwoFactorNotEnrolled, HttpStatus.BAD_REQUEST],
    [AuthV2ErrorCode.InvalidRecoveryToken, HttpStatus.BAD_REQUEST],
    [AuthV2ErrorCode.InvalidOfflineCode, HttpStatus.BAD_REQUEST],
  ])('маппит %s → HTTP %d', (code, status) => {
    const { host, res } = mockHost();
    filter.catch(new AuthV2Error(code, 'описание'), host);
    expect(res.status).toHaveBeenCalledWith(status);
  });

  it('тело ответа — формат OAuth 2.0 { error, error_description }', () => {
    const { host, res } = mockHost();
    filter.catch(new AuthV2Error(AuthV2ErrorCode.TimestampTooOld, 'Метка времени вне окна'), host);
    expect(res.json).toHaveBeenCalledWith({
      error: AuthV2ErrorCode.TimestampTooOld,
      error_description: 'Метка времени вне окна',
    });
  });

  it('подкласс VaultServerDecryptionForbiddenError маппится в 403', () => {
    const { host, res } = mockHost();
    filter.catch(new VaultServerDecryptionForbiddenError(), host);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: AuthV2ErrorCode.VaultServerDecryptionForbidden }),
    );
  });
});
