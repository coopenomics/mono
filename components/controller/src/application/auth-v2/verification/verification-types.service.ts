import { Inject, Injectable } from '@nestjs/common';
import config from '~/config/config';
import { ACCOUNT_DOMAIN_SERVICE } from '~/domain/account/services/account-domain.service';
import type { AccountDomainService } from '~/domain/account/services/account-domain.service';
import {
  VerificationSource,
  VerificationStatus,
  VerificationType,
  type VerificationTypeEntry,
} from '~/domain/auth-v2/verification/verification.types';

/** Статус принятого члена в on-chain таблице участников (soviet `participants`). */
const PARTICIPANT_STATUS_ACCEPTED = 'accepted';

/** Chain `time_point_sec` — UTC по определению; добавляем `Z`, если таймзоны в строке нет. */
function toUtcIso(chainTime: string): string {
  const hasTz = /(?:Z|[+-]\d{2}:?\d{2})$/.test(chainTime);
  return new Date(hasTz ? chainTime : `${chainTime}Z`).toISOString();
}

/**
 * Резолвер типов верификации пайщика (CoopID, Story 4.1). Источник истины —
 * on-chain таблица участников кооператива (`soviet::participants`): сама запись
 * = решение кооператива о приёме (`addmember`). Базовый тип `coop_baseline`
 * выдаётся принятому пайщику (`status === 'accepted'`) со статусом `verified`,
 * источником `cooperative_decision` и `verified_at` = `created_at` записи участника.
 *
 * Дрейф AC↔код (прав код): AC описывает добавление `coop_baseline` как обработку
 * события `addmember`; реализуем как вывод при выпуске (derive-at-issuance) из той
 * же on-chain записи — нет окна рассинхрона, не нужен backfill членов, единственный
 * источник истины. Структурная запись готова к выдаче в userinfo и сертификате
 * (Story 4.3); Story 4.1 кладёт в сертификат лишь плоский список типов.
 */
@Injectable()
export class VerificationTypesService {
  constructor(
    @Inject(ACCOUNT_DOMAIN_SERVICE) private readonly accountDomainService: AccountDomainService,
  ) {}

  /**
   * Типы верификации пайщика по имени блокчейн-аккаунта. Пустой массив, если пайщик
   * не является принятым членом кооператива (нет записи участника или `status` не `accepted`).
   */
  async resolveForUsername(username: string, coopname: string = config.coopname): Promise<VerificationTypeEntry[]> {
    const participant = await this.accountDomainService.getParticipantAccount(coopname, username);
    if (!participant || participant.status !== PARTICIPANT_STATUS_ACCEPTED) return [];

    return [
      {
        type: VerificationType.CoopBaseline,
        status: VerificationStatus.Verified,
        source: VerificationSource.CooperativeDecision,
        verified_at: toUtcIso(participant.created_at),
      },
    ];
  }
}
