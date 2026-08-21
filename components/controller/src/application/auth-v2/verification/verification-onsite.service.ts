import { Inject, Injectable } from '@nestjs/common';
import config from '~/config/config';
import {
  ACCOUNT_BLOCKCHAIN_PORT,
  type AccountBlockchainPort,
} from '~/domain/account/interfaces/account-blockchain.port';
import { VerificationProcedure, type VerificationTypeEntry } from '~/domain/auth-v2/verification/verification.types';
import { VerificationTypesService } from './verification-types.service';
import { VerificationReviewService, type VerificationPhotoUpload } from './verification-review.service';
import type { VerificationActor } from './verification-authority.service';

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
  ) {}

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
    await this.verificationReviewService.recordVerification({
      actor: params.actor,
      username: params.username,
      braname,
      photos,
    });
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
    await this.verificationReviewService.recordRevocation(chairman, username, reason ?? null);
    return this.verificationTypesService.resolveForUsername(username);
  }
}
