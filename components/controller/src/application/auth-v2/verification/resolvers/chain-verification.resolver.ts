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
 * `registrator::verifyacc` — личность сверяет с паспортом председатель
 * кооперативного участка (или его доверенное лицо) либо совет кооператива.
 * Процедура
 * записи отображается в тип верификации по реестру `CHAIN_PROCEDURE_TO_TYPE`;
 * незнакомые процедуры (например, legacy `online`) уровня не дают.
 */
/**
 * Контекст проведения записан контрактом в `notice` как `coopname/braname`:
 * участок — когда braname указан, совет кооператива — когда пусто.
 */
function branchFromNotice(notice?: string): string {
  const separator = (notice ?? '').indexOf('/');
  return separator === -1 ? '' : notice!.slice(separator + 1);
}

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

      const branch = branchFromNotice(verification.notice);
      entries.push({
        type,
        status: VerificationStatus.Verified,
        source: branch ? VerificationSource.BranchAttestation : VerificationSource.CouncilAttestation,
        verified_at: chainTimeToUtcIso(verification.created_at),
        attested_by: verification.verificator,
        ...(branch ? { attested_in: branch } : {}),
      });
    }
    return entries;
  }
}
