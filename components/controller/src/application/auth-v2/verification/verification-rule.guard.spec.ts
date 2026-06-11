import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { AuthV2Error, AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { VerificationType } from '~/domain/auth-v2/verification/verification.types';
import { VerificationRuleGuard } from './verification-rule.guard';

const BASELINE_ENTRY = {
  type: VerificationType.CoopBaseline,
  status: 'verified',
  source: 'cooperative_decision',
  verified_at: '2026-01-01T00:00:00.000Z',
};

function makeContext(actionCode: string | undefined, user: { username: string } | undefined): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function makeGuard(opts: { actionCode?: string; required?: VerificationType[]; entries?: any[] }) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(opts.actionCode) };
  const rulesService = { getRequiredTypes: jest.fn().mockResolvedValue(opts.required ?? []) };
  const verificationTypesService = { resolveForUsername: jest.fn().mockResolvedValue(opts.entries ?? [BASELINE_ENTRY]) };
  const guard = new VerificationRuleGuard(reflector as any, rulesService as any, verificationTypesService as any);
  return { guard, reflector, rulesService, verificationTypesService };
}

describe('VerificationRuleGuard (Story 4.2)', () => {
  it('нет @RequireVerification на хэндлере → пропускает (guard не сконфигурирован)', async () => {
    const { guard, rulesService } = makeGuard({ actionCode: undefined });
    await expect(guard.canActivate(makeContext(undefined, { username: 'ant' }))).resolves.toBe(true);
    expect(rulesService.getRequiredTypes).not.toHaveBeenCalled();
  });

  it('правило без требований (пустой список) → пропускает (нет ограничения)', async () => {
    const { guard, verificationTypesService } = makeGuard({ actionCode: 'council_vote', required: [] });
    await expect(guard.canActivate(makeContext('council_vote', { username: 'ant' }))).resolves.toBe(true);
    expect(verificationTypesService.resolveForUsername).not.toHaveBeenCalled();
  });

  it('у пайщика есть требуемый тип → пропускает', async () => {
    const { guard, verificationTypesService } = makeGuard({
      actionCode: 'council_vote',
      required: [VerificationType.CoopBaseline],
      entries: [BASELINE_ENTRY],
    });
    await expect(guard.canActivate(makeContext('council_vote', { username: 'ant' }))).resolves.toBe(true);
    expect(verificationTypesService.resolveForUsername).toHaveBeenCalledWith('ant');
  });

  it('у пайщика нет требуемого типа → InsufficientVerification', async () => {
    const { guard } = makeGuard({
      actionCode: 'council_vote',
      required: [VerificationType.CoopBaseline],
      entries: [],
    });
    await expect(guard.canActivate(makeContext('council_vote', { username: 'stranger' }))).rejects.toMatchObject({
      code: AuthV2ErrorCode.InsufficientVerification,
    });
    await expect(
      guard.canActivate(makeContext('council_vote', { username: 'stranger' })),
    ).rejects.toBeInstanceOf(AuthV2Error);
  });

  it('правило есть, но запрос без аутентификации (нет req.user) → Unauthorized', async () => {
    const { guard } = makeGuard({ actionCode: 'council_vote', required: [VerificationType.CoopBaseline] });
    await expect(guard.canActivate(makeContext('council_vote', undefined))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
