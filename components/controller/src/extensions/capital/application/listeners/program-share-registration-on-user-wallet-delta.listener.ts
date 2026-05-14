import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Ledger2Contract } from 'cooptypes';
import config from '~/config/config';
import type { IDelta } from '~/types/common';
import { ProgramShareRegistrationService } from '../services/program-share-registration.service';

const BLAGOROST_WALLET_NAME = 'w.cap.blago';

/**
 * Слушатель дельт `ledger2::userwallets`. При изменении баланса пайщика на
 * программном кошельке «Благорост» (`w.cap.blago`) запускает точечную
 * синхронизацию долей по всем pending|active проектам пайщика. Это закрывает
 * окно между поллингом scheduler'а (по умолчанию 1440 мин) и быстрыми
 * пользовательскими сценариями: invest → commit → result.
 *
 * `present=false` (запись стёрта при обнулении баланса, Эпик 3 §6) пока не
 * обрабатываем: scheduler в итоге сверит и обнулит долю; обработка отдельной
 * action regshare с user_shares=0 — отдельная задача.
 */
@Injectable()
export class ProgramShareRegistrationOnUserWalletDeltaListener {
  private readonly logger = new Logger(ProgramShareRegistrationOnUserWalletDeltaListener.name);

  constructor(
    private readonly programShareRegistrationService: ProgramShareRegistrationService
  ) {}

  @OnEvent(`delta::${Ledger2Contract.contractName.production}::${Ledger2Contract.Tables.UserWallets.tableName}`)
  async handleUserWalletDelta(delta: IDelta): Promise<void> {
    if (!delta.present) return;
    if (delta.scope !== config.coopname) return;

    const value = delta.value as Ledger2Contract.Tables.UserWallets.IUserWallet | undefined;
    if (!value) return;
    if (String(value.wallet_name) !== BLAGOROST_WALLET_NAME) return;
    if (!value.username) return;

    const username = String(value.username);
    try {
      await this.programShareRegistrationService.syncProgramSharesForUser(
        delta.scope,
        username
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.warn(
        `regshare event-driven sync не выполнен: coop=${delta.scope} user=${username}: ${message}`,
        stack
      );
    }
  }
}
