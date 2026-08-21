import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import config from '~/config/config';
import { ACCOUNT_DOMAIN_SERVICE } from '~/domain/account/services/account-domain.service';
import type { AccountDomainService } from '~/domain/account/services/account-domain.service';
import { InnerAccountType } from '@coopenomics/innercoop';
import { VerificationType } from '~/domain/auth-v2/verification/verification.types';
import { AuditService } from '../audit/audit.service';
import { VerificationTypesService } from './verification-types.service';
import { VerificationAuthorityService, type VerificationActor } from './verification-authority.service';
import type { ParticipantIdentityForVerificationDTO } from './dto/verification.dto';

/** ФИО одной строкой; отсутствующие части просто пропускаем. */
function fullName(data: { last_name?: string; first_name?: string; middle_name?: string }): string {
  return [data.last_name, data.first_name, data.middle_name].filter(Boolean).join(' ');
}

/**
 * Персональные данные пайщика для сверки с документом.
 *
 * Данные отдаются ровно на время сверки: человек стоит перед проверяющим и
 * показывает паспорт, а сверить по двум цифрам нельзя — нужен весь документ.
 * Как только личность подтверждена, повод отпадает, и запрос отказывает: у
 * оператора кооперативного участка постоянного доступа к персональным данным
 * пайщиков нет. Каждая выдача пишется в аудит.
 */
@Injectable()
export class VerificationIdentityService {
  constructor(
    @Inject(ACCOUNT_DOMAIN_SERVICE) private readonly accountDomainService: AccountDomainService,
    private readonly verificationTypesService: VerificationTypesService,
    private readonly verificationAuthorityService: VerificationAuthorityService,
    private readonly audit: AuditService,
  ) {}

  async getForVerification(actor: VerificationActor, username: string): Promise<ParticipantIdentityForVerificationDTO> {
    await this.verificationAuthorityService.assertMayVerify(actor);

    const participant = await this.accountDomainService.getParticipantAccount(config.coopname, username);
    if (!participant) throw new NotFoundException('Пайщик не найден в кооперативе');

    const levels = await this.verificationTypesService.resolveForUsername(username);
    if (levels.some((level) => level.type === VerificationType.PassportOnsite)) {
      throw new ForbiddenException('Личность пайщика уже подтверждена — данные для сверки не выдаются');
    }

    const account = await this.accountDomainService.getAccount(username);
    const identity = this.buildIdentity(username, account.private_account);

    await this.audit.record({
      event: 'ParticipantIdentityDisclosedForVerification',
      subjectId: username,
      actor: actor.username,
      result: 'success',
      context: { braname: actor.braname ?? '', actor_role: actor.role },
    });

    return identity;
  }

  /**
   * Плоский набор полей для экрана сверки: у физлица — весь паспорт и адрес
   * регистрации, у ИП и организации паспорта в кооперативе нет, поэтому отдаём
   * то, по чему сверяют личность и полномочия.
   */
  private buildIdentity(username: string, privateAccount: any): ParticipantIdentityForVerificationDTO {
    const type = privateAccount?.type as InnerAccountType | undefined;

    if (type === InnerAccountType.individual) {
      return this.buildIndividual(username, privateAccount.individual_data ?? {});
    }
    if (type === InnerAccountType.entrepreneur) {
      return this.buildEntrepreneur(username, privateAccount.entrepreneur_data ?? {});
    }
    if (type === InnerAccountType.organization) {
      return this.buildOrganization(username, privateAccount.organization_data ?? {});
    }
    throw new NotFoundException('У пайщика не заполнены данные для сверки личности');
  }

  private buildIndividual(username: string, data: any): ParticipantIdentityForVerificationDTO {
    const passport = data.passport ?? {};
    return {
      username,
      type: InnerAccountType.individual,
      full_name: fullName(data),
      birthdate: data.birthdate ?? null,
      passport_series: passport.series != null ? String(passport.series) : null,
      passport_number: passport.number != null ? String(passport.number) : null,
      passport_issued_by: passport.issued_by ?? null,
      passport_issued_at: passport.issued_at ?? null,
      passport_code: passport.code ?? null,
      full_address: data.full_address ?? null,
    };
  }

  private buildEntrepreneur(username: string, data: any): ParticipantIdentityForVerificationDTO {
    return {
      username,
      type: InnerAccountType.entrepreneur,
      full_name: fullName(data),
      birthdate: data.birthdate ?? null,
      full_address: data.full_address ?? null,
      inn: data.details?.inn ?? null,
      ogrn: data.details?.ogrn ?? null,
    };
  }

  private buildOrganization(username: string, data: any): ParticipantIdentityForVerificationDTO {
    const rep = data.represented_by ?? {};
    return {
      username,
      type: InnerAccountType.organization,
      full_name: data.short_name || data.full_name || username,
      full_address: data.full_address ?? null,
      inn: data.details?.inn ?? null,
      ogrn: data.details?.ogrn ?? null,
      representative_name: fullName(rep) || null,
      representative_position: rep.position ?? null,
      representative_based_on: rep.based_on ?? null,
    };
  }
}
