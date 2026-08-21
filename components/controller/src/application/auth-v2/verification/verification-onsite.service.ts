import { Inject, Injectable, Logger } from '@nestjs/common';
import config from '~/config/config';
import {
  ACCOUNT_BLOCKCHAIN_PORT,
  type AccountBlockchainPort,
} from '~/domain/account/interfaces/account-blockchain.port';
import { VerificationProcedure, type VerificationTypeEntry } from '~/domain/auth-v2/verification/verification.types';
import { VerificationTypesService } from './verification-types.service';
import { VerificationReviewService, type VerificationPhotoUpload } from './verification-review.service';
import type { VerificationActor } from './verification-authority.service';
import { AuditService } from '../audit/audit.service';

/**
 * Верификация личности пайщика при личной явке (уровень `passport_onsite`).
 * Личность сверяет с паспортом либо кооперативный участок (председатель участка
 * или его доверенное лицо — тогда указан участок), либо совет кооператива
 * (председатель совета — тогда участок не указывается). Факт пишется он-чейн
 * действием `registrator::verifyacc`; полномочия проверяет контракт и сервер.
 *
 * Уровень выдаётся сразу, не дожидаясь совета: с ним пайщик забирает заказ на
 * участке. Совет проверяет сверку следом по фотографиям и может её отклонить —
 * тогда уровень отзывается (`registrator::unverifyacc`), и выдача снова закрыта.
 */
@Injectable()
export class VerificationOnsiteService {
  constructor(
    @Inject(ACCOUNT_BLOCKCHAIN_PORT) private readonly accountBlockchainPort: AccountBlockchainPort,
    private readonly verificationTypesService: VerificationTypesService,
    private readonly verificationReviewService: VerificationReviewService,
    private readonly audit: AuditService,
  ) {}

  private readonly logger = new Logger(VerificationOnsiteService.name);

  /**
   * Журнал ведём после записи в цепь, и его сбой не должен ронять действие:
   * оно уже необратимо, а повторить его контракт не даст — на верификацию он
   * ответит «уже проведена», на отзыв «не найдена», и человек упрётся в тупик
   * с ошибкой на экране и сделанной работой в цепи. Сбой громко логируем и
   * пишем в аудит: запись в журнале не появится, и это надо будет разобрать.
   */
  private async keepJournal(username: string, event: string, write: () => Promise<unknown>): Promise<void> {
    try {
      await write();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Не удалось записать в журнал верификаций (${event}, ${username}): ${reason}`);
      await this.audit
        .record({ event, subjectId: username, result: 'degraded', context: { reason } })
        .catch(() => undefined);
    }
  }

  /**
   * Провести верификацию по паспорту; возвращает актуальные уровни пайщика.
   * Пустой `braname` означает, что личность сверил совет кооператива.
   */
  async verifyOnsite(params: {
    actor: VerificationActor;
    username: string;
    braname?: string;
    photos?: VerificationPhotoUpload[];
  }): Promise<VerificationTypeEntry[]> {
    const braname = params.braname ?? '';
    // Снимки проверяем до записи в цепь: узнать о битом файле после `verifyacc`
    // поздно — уровень уже выдан, и его пришлось бы отзывать отдельным действием.
    const photos = this.verificationReviewService.prepareVerification(braname, params.photos ?? []);
    await this.accountBlockchainPort.verifyAccount({
      coopname: config.coopname,
      braname,
      verificator: params.actor.username,
      username: params.username,
      procedure: VerificationProcedure.Passport,
    });
    await this.keepJournal(params.username, 'ParticipantVerificationRecorded', () =>
      this.verificationReviewService.recordVerification({
        actor: params.actor,
        username: params.username,
        braname,
        photos,
      }),
    );
    return this.verificationTypesService.resolveForUsername(params.username);
  }

  /** Отозвать верификацию по паспорту; возвращает актуальные уровни пайщика. */
  async unverify(chairman: string, username: string, reason?: string): Promise<VerificationTypeEntry[]> {
    await this.accountBlockchainPort.unverifyAccount({
      coopname: config.coopname,
      chairman,
      username,
      procedure: VerificationProcedure.Passport,
    });
    await this.keepJournal(username, 'ParticipantVerificationRevoked', () =>
      this.verificationReviewService.recordRevocation(chairman, username, reason ?? null),
    );
    return this.verificationTypesService.resolveForUsername(username);
  }
}
