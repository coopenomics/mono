import { Inject, Injectable } from '@nestjs/common';
import config from '~/config/config';
import {
  ACCOUNT_BLOCKCHAIN_PORT,
  type AccountBlockchainPort,
} from '~/domain/account/interfaces/account-blockchain.port';
import { VerificationProcedure, type VerificationTypeEntry } from '~/domain/auth-v2/verification/verification.types';
import { VerificationTypesService } from './verification-types.service';

/**
 * Верификация личности пайщика на кооперативном участке (уровень `passport_onsite`).
 * Верификатор — председатель участка или его доверенное лицо — лично сверяет
 * личность пайщика с паспортом; факт пишется он-чейн действием `registrator::verifyacc`
 * от имени верификатора (контракт сам проверяет полномочия по таблице участка).
 * Отзыв (`registrator::unverifyacc`) — председатель кооператива.
 */
@Injectable()
export class VerificationOnsiteService {
  constructor(
    @Inject(ACCOUNT_BLOCKCHAIN_PORT) private readonly accountBlockchainPort: AccountBlockchainPort,
    private readonly verificationTypesService: VerificationTypesService,
  ) {}

  /** Провести верификацию по паспорту; возвращает актуальные уровни пайщика. */
  async verifyOnsite(verificator: string, username: string, braname: string): Promise<VerificationTypeEntry[]> {
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
