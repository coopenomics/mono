import { Inject, Injectable } from '@nestjs/common';
import config from '~/config/config';
import {
  ACCOUNT_BLOCKCHAIN_PORT,
  type AccountBlockchainPort,
} from '~/domain/account/interfaces/account-blockchain.port';
import { VerificationProcedure, type VerificationTypeEntry } from '~/domain/auth-v2/verification/verification.types';
import { VerificationTypesService } from './verification-types.service';

/**
 * Верификация личности пайщика при личной явке (уровень `passport_onsite`).
 * Личность сверяет с паспортом либо кооперативный участок (председатель участка
 * или его доверенное лицо — тогда указан участок), либо совет кооператива
 * (председатель совета — тогда участок не указывается). Факт пишется он-чейн
 * действием `registrator::verifyacc` от имени верификатора; полномочия проверяет
 * контракт. Отзыв (`registrator::unverifyacc`) — председатель кооператива.
 */
@Injectable()
export class VerificationOnsiteService {
  constructor(
    @Inject(ACCOUNT_BLOCKCHAIN_PORT) private readonly accountBlockchainPort: AccountBlockchainPort,
    private readonly verificationTypesService: VerificationTypesService,
  ) {}

  /**
   * Провести верификацию по паспорту; возвращает актуальные уровни пайщика.
   * Пустой `braname` означает, что личность сверил совет кооператива.
   */
  async verifyOnsite(verificator: string, username: string, braname = ''): Promise<VerificationTypeEntry[]> {
    await this.accountBlockchainPort.verifyAccount({
      coopname: config.coopname,
      braname,
      verificator,
      username,
      procedure: VerificationProcedure.Passport,
    });
    return this.verificationTypesService.resolveForUsername(username);
  }

  /** Отозвать верификацию по паспорту; возвращает актуальные уровни пайщика. */
  async unverify(chairman: string, username: string): Promise<VerificationTypeEntry[]> {
    await this.accountBlockchainPort.unverifyAccount({
      coopname: config.coopname,
      chairman,
      username,
      procedure: VerificationProcedure.Passport,
    });
    return this.verificationTypesService.resolveForUsername(username);
  }
}
