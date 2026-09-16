const mockConfig = {
  coopname: 'voskhod',
  authV2: { webhookToken: 'internal-token' },
};
jest.mock('~/config/config', () => ({ __esModule: true, default: mockConfig }));

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import {
  VerificationSource,
  VerificationStatus,
  VerificationType,
  type VerificationTypeEntry,
} from '~/domain/auth-v2/verification/verification.types';
import { buildParticipantClaims, ParticipantClaimsController } from './participant-claims.controller';
import type { VerificationTypesService } from '../verification/verification-types.service';
import type { UserDomainService } from '~/domain/user/services/user-domain.service';

const account = { email: 'ivanov@example.com', is_email_verified: true };

const baseline: VerificationTypeEntry = {
  type: VerificationType.CoopBaseline,
  status: VerificationStatus.Verified,
  source: VerificationSource.CooperativeDecision,
  verified_at: '2026-03-01T10:00:00.000Z',
};

const passport: VerificationTypeEntry = {
  type: VerificationType.PassportOnsite,
  status: VerificationStatus.Verified,
  source: VerificationSource.BranchAttestation,
  verified_at: '2026-04-02T11:00:00.000Z',
  attested_by: 'chairman',
  attested_in: 'branch1',
};

describe('buildParticipantClaims (Story 7.0 карты кооператора, FR-E1)', () => {
  it('принятый пайщик: member=true, дата приёма — verified_at начального уровня', () => {
    expect(buildParticipantClaims('voskhod', 'ant', [baseline, passport], account)).toEqual({
      coopname: 'voskhod',
      username: 'ant',
      email: 'ivanov@example.com',
      email_verified: true,
      member: true,
      member_since: '2026-03-01T10:00:00.000Z',
      verification_types: [baseline, passport],
    });
  });

  it('не член: уровней нет ⇒ member=false, дата приёма пуста', () => {
    expect(buildParticipantClaims('voskhod', 'stranger', [], null)).toEqual({
      coopname: 'voskhod',
      username: 'stranger',
      email: null,
      email_verified: false,
      member: false,
      member_since: null,
      verification_types: [],
    });
  });

  it('уровень личной сверки без членства не делает человека пайщиком', () => {
    // Паспорт сверен, но записи участника в цепи нет: членство даёт только
    // решение кооператива, а не факт проверки документов.
    const claims = buildParticipantClaims('voskhod', 'candidate', [passport], account);
    expect(claims.member).toBe(false);
    expect(claims.member_since).toBeNull();
    expect(claims.verification_types).toEqual([passport]);
  });
});

describe('почта в claims (FR-A2а: card.coop решает по ней, слать ли письмо)', () => {
  it('неподтверждённая почта отдаётся с email_verified=false, а не скрывается', () => {
    const claims = buildParticipantClaims('voskhod', 'ant', [baseline], {
      email: 'ivanov@example.com',
      is_email_verified: false,
    });
    expect(claims.email).toBe('ivanov@example.com');
    expect(claims.email_verified).toBe(false);
  });

  it('пустая почта не может считаться подтверждённой', () => {
    const claims = buildParticipantClaims('voskhod', 'ant', [baseline], {
      email: '',
      is_email_verified: true,
    });
    expect(claims.email).toBeNull();
    expect(claims.email_verified).toBe(false);
  });
});

describe('ParticipantClaimsController (Story 7.0)', () => {
  const resolved = jest.fn();
  const service = { resolveForUsername: resolved } as unknown as VerificationTypesService;
  const getUser = jest.fn();
  const users = { getUserByUsername: getUser } as unknown as UserDomainService;
  const controller = new ParticipantClaimsController(service, users);

  beforeEach(() => {
    resolved.mockReset();
    resolved.mockResolvedValue([baseline]);
    getUser.mockReset();
    getUser.mockResolvedValue({ email: 'ivanov@example.com', is_email_verified: true });
  });

  it('с верным токеном отдаёт claims кооператива из конфигурации', async () => {
    await expect(controller.getClaims('internal-token', 'ant')).resolves.toEqual({
      coopname: 'voskhod',
      username: 'ant',
      email: 'ivanov@example.com',
      email_verified: true,
      member: true,
      member_since: '2026-03-01T10:00:00.000Z',
      verification_types: [baseline],
    });
    expect(resolved).toHaveBeenCalledWith('ant', 'voskhod');
  });

  it('без токена — отказ, резолвер не дёргается', async () => {
    await expect(controller.getClaims(undefined, 'ant')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(resolved).not.toHaveBeenCalled();
  });

  it('с чужим токеном — отказ', async () => {
    await expect(controller.getClaims('wrong-token', 'ant')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(resolved).not.toHaveBeenCalled();
  });

  it('токен той же длины, но другой — отказ (сверка постоянного времени, не префиксом)', async () => {
    await expect(controller.getClaims('internal-tokeN', 'ant')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(resolved).not.toHaveBeenCalled();
  });

  it('контур не настроен (токен в конфигурации пуст) — не проходит никакой запрос', async () => {
    mockConfig.authV2.webhookToken = '';
    try {
      await expect(controller.getClaims('', 'ant')).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(controller.getClaims('internal-token', 'ant')).rejects.toBeInstanceOf(UnauthorizedException);
    } finally {
      mockConfig.authV2.webhookToken = 'internal-token';
    }
    expect(resolved).not.toHaveBeenCalled();
  });

  it('учётной записи в кооперативе нет — claims без почты, а не ошибка', async () => {
    getUser.mockRejectedValue(new Error('Пользователь не найден'));
    const claims = await controller.getClaims('internal-token', 'ant');
    expect(claims.email).toBeNull();
    expect(claims.email_verified).toBe(false);
    expect(claims.member).toBe(true);
  });

  it('без имени аккаунта — 400, а не пустые claims', async () => {
    await expect(controller.getClaims('internal-token', undefined)).rejects.toBeInstanceOf(BadRequestException);
    expect(resolved).not.toHaveBeenCalled();
  });
});
