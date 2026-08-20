import { Inject, Injectable } from '@nestjs/common';
import { ACCOUNT_DOMAIN_SERVICE } from '~/domain/account/services/account-domain.service';
import type { AccountDomainService } from '~/domain/account/services/account-domain.service';
import type { IVerificationSourceResolver } from '~/domain/auth-v2/ports/verification-source.port';
import {
  VerificationSource,
  VerificationStatus,
  VerificationType,
  type VerificationTypeEntry,
} from '~/domain/auth-v2/verification/verification.types';
import { chainTimeToUtcIso } from '../chain-time.util';

/** Статус принятого члена в on-chain таблице участников (soviet `participants`). */
const PARTICIPANT_STATUS_ACCEPTED = 'accepted';

/**
 * Начальный уровень (`coop_baseline`, Story 4.1). Источник истины — on-chain
 * таблица участников кооператива (`soviet::participants`): сама запись = решение
 * кооператива о приёме (`addmember`). Тип выдаётся принятому пайщику
 * (`status === 'accepted'`) со статусом `verified`, источником
 * `cooperative_decision` и `verified_at` = `created_at` записи участника.
 *
 * Дрейф AC↔код (прав код): AC описывает добавление `coop_baseline` как обработку
 * события `addmember`; реализуем как вывод при выпуске (derive-at-issuance) из той
 * же on-chain записи — нет окна рассинхрона, не нужен backfill членов, единственный
 * источник истины.
 */
@Injectable()
export class BaselineVerificationResolver implements IVerificationSourceResolver {
  constructor(
    @Inject(ACCOUNT_DOMAIN_SERVICE) private readonly accountDomainService: AccountDomainService,
  ) {}

  async resolve(username: string, coopname: string): Promise<VerificationTypeEntry[]> {
    const participant = await this.accountDomainService.getParticipantAccount(coopname, username);
    if (!participant || participant.status !== PARTICIPANT_STATUS_ACCEPTED) return [];

    return [
      {
        type: VerificationType.CoopBaseline,
        status: VerificationStatus.Verified,
        source: VerificationSource.CooperativeDecision,
        verified_at: chainTimeToUtcIso(participant.created_at),
      },
    ];
  }
}
