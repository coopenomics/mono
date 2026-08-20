import { Inject, Injectable } from '@nestjs/common';
import { ACCOUNT_DOMAIN_SERVICE } from '~/domain/account/services/account-domain.service';
import type { AccountDomainService } from '~/domain/account/services/account-domain.service';
import type { IVerificationSourceResolver } from '~/domain/auth-v2/ports/verification-source.port';
import {
  CHAIN_PROCEDURE_TO_TYPE,
  VerificationSource,
  VerificationStatus,
  type VerificationProcedure,
  type VerificationTypeEntry,
} from '~/domain/auth-v2/verification/verification.types';
import { chainTimeToUtcIso } from '../chain-time.util';

/**
 * Уровни, подтверждённые он-чейн записями верификации
 * (`registrator::accounts.verifications`). Записи появляются действием
 * `registrator::verifyacc` — председатель кооперативного участка или его
 * доверенное лицо лично сверяет личность пайщика с паспортом. Процедура
 * записи отображается в тип верификации по реестру `CHAIN_PROCEDURE_TO_TYPE`;
 * незнакомые процедуры (например, legacy `online`) уровня не дают.
 */
@Injectable()
export class ChainVerificationResolver implements IVerificationSourceResolver {
  constructor(
    @Inject(ACCOUNT_DOMAIN_SERVICE) private readonly accountDomainService: AccountDomainService,
  ) {}

  async resolve(username: string, _coopname: string): Promise<VerificationTypeEntry[]> {
    const account = await this.accountDomainService.getUserAccount(username);
    if (!account?.verifications?.length) return [];

    const entries: VerificationTypeEntry[] = [];
    for (const verification of account.verifications) {
      if (!verification.is_verified) continue;
      const type = CHAIN_PROCEDURE_TO_TYPE[verification.procedure as VerificationProcedure];
      if (!type) continue;

      entries.push({
        type,
        status: VerificationStatus.Verified,
        source: VerificationSource.BranchAttestation,
        verified_at: chainTimeToUtcIso(verification.created_at),
        attested_by: verification.verificator,
      });
    }
    return entries;
  }
}
