import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { VerificationType, VerificationSource, VerificationStatus } from '~/domain/auth-v2/verification/verification.types';
import { VerificationIdentityService } from './verification-identity.service';

/**
 * Персональные данные выдаются ровно на время сверки: человек стоит перед
 * проверяющим с паспортом. Личность подтверждена — повод исчерпан, и запрос
 * отказывает: постоянного доступа к данным пайщиков у оператора участка нет.
 */
describe('VerificationIdentityService', () => {
  const OPERATOR = { username: 'kuchair', role: 'user', braname: 'bra1' };
  const INDIVIDUAL = {
    private_account: {
      type: 'individual',
      individual_data: {
        first_name: 'Иван',
        last_name: 'Иванов',
        middle_name: 'Иванович',
        birthdate: '1990-04-01',
        full_address: 'г. Москва, ул. Ленина, д. 1',
        passport: { series: 7122, number: 112233, issued_by: 'ГУ МВД', issued_at: '2015-05-20', code: '770-001' },
      },
    },
  };

  let accounts: { getParticipantAccount: jest.Mock; getAccount: jest.Mock };
  let types: { resolveForUsername: jest.Mock };
  let authority: { assertMayVerify: jest.Mock };
  let audit: { record: jest.Mock };
  let service: VerificationIdentityService;

  beforeEach(() => {
    accounts = {
      getParticipantAccount: jest.fn().mockResolvedValue({ username: 'zoe', status: 'accepted' }),
      getAccount: jest.fn().mockResolvedValue(INDIVIDUAL),
    };
    types = { resolveForUsername: jest.fn().mockResolvedValue([]) };
    authority = { assertMayVerify: jest.fn().mockResolvedValue(undefined) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new VerificationIdentityService(
      accounts as any,
      types as any,
      authority as any,
      audit as any,
    );
  });

  it('отдаёт паспорт целиком тому, кто вправе сверять', async () => {
    const identity = await service.getForVerification(OPERATOR, 'zoe');

    expect(authority.assertMayVerify).toHaveBeenCalledWith(OPERATOR);
    expect(identity).toMatchObject({
      full_name: 'Иванов Иван Иванович',
      birthdate: '1990-04-01',
      passport_series: '7122',
      passport_number: '112233',
      passport_issued_by: 'ГУ МВД',
      passport_issued_at: '2015-05-20',
      passport_code: '770-001',
      full_address: 'г. Москва, ул. Ленина, д. 1',
    });
  });

  it('после подтверждения личности данные больше не выдаются', async () => {
    types.resolveForUsername.mockResolvedValue([
      {
        type: VerificationType.PassportOnsite,
        status: VerificationStatus.Verified,
        source: VerificationSource.BranchAttestation,
        verified_at: '2026-08-21T00:00:00.000Z',
      },
    ]);

    await expect(service.getForVerification(OPERATOR, 'zoe')).rejects.toBeInstanceOf(ForbiddenException);
    expect(accounts.getAccount).not.toHaveBeenCalled();
  });

  it('без полномочий данные не читаются вовсе', async () => {
    authority.assertMayVerify.mockRejectedValue(new ForbiddenException('нет прав'));

    await expect(service.getForVerification(OPERATOR, 'zoe')).rejects.toBeInstanceOf(ForbiddenException);
    expect(accounts.getParticipantAccount).not.toHaveBeenCalled();
    expect(accounts.getAccount).not.toHaveBeenCalled();
  });

  it('чужому кооперативу отказ — пайщик не найден', async () => {
    accounts.getParticipantAccount.mockResolvedValue(null);

    await expect(service.getForVerification(OPERATOR, 'zoe')).rejects.toBeInstanceOf(NotFoundException);
    expect(accounts.getAccount).not.toHaveBeenCalled();
  });

  it('каждая выдача данных пишется в аудит', async () => {
    await service.getForVerification(OPERATOR, 'zoe');

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'ParticipantIdentityDisclosedForVerification',
        subjectId: 'zoe',
        actor: 'kuchair',
        result: 'success',
      }),
    );
  });

  it('у организации показываются представитель и реквизиты, а не паспорт', async () => {
    accounts.getAccount.mockResolvedValue({
      private_account: {
        type: 'organization',
        organization_data: {
          short_name: 'ООО «Ромашка»',
          full_address: 'г. Москва, ул. Мира, 2',
          details: { inn: '7701234567', ogrn: '1157746000000' },
          represented_by: { last_name: 'Петров', first_name: 'Пётр', middle_name: 'Петрович', position: 'Директор', based_on: 'Устава' },
        },
      },
    });

    const identity = await service.getForVerification(OPERATOR, 'romashka');

    expect(identity).toMatchObject({
      full_name: 'ООО «Ромашка»',
      representative_name: 'Петров Пётр Петрович',
      representative_position: 'Директор',
      representative_based_on: 'Устава',
      inn: '7701234567',
      ogrn: '1157746000000',
    });
    expect(identity.passport_series).toBeUndefined();
  });
});
