// domain/account/services/participant-status-sync.service.ts

import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SovietContract } from 'cooptypes';
import config from '~/config/config';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { USER_REPOSITORY, UserRepository } from '~/domain/user/repositories/user.repository';
import { userStatus } from '~/types/user.types';
import type { IAction } from '~/types';
import { ACCOUNT_BLOCKCHAIN_PORT, type AccountBlockchainPort } from '~/domain/account/interfaces/account-blockchain.port';

/** Время цепи приходит без часового пояса (`2026-09-17T11:30:09`) и означает UTC. */
export function chainTimeToDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Поднимает `users.status` до `active` после того, как совет принял пайщика
 * (blockchain action `soviet::addpartcpnt`, который инлайн-action из
 * `registrator::confirmreg`).
 *
 * Без этого транзишена `ActiveUserStatusGuard` отбрасывает свежепринятых
 * пайщиков на write-операциях (createDepositPayment и т.п.) — в моно-аккаунте
 * статус так и остаётся `4_Registered`.
 */
@Injectable()
export class ParticipantStatusSyncService implements OnApplicationBootstrap {
  constructor(
    private readonly logger: WinstonLoggerService,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(ACCOUNT_BLOCKCHAIN_PORT) private readonly accountBlockchainPort: AccountBlockchainPort,
  ) {
    this.logger.setContext(ParticipantStatusSyncService.name);
  }

  /**
   * Дата вступления хранится у пользователя, чтобы реестр пайщиков сортировался
   * на сервере. Новым пайщикам её пишет приёмник решения ниже, принятым раньше —
   * эта дочитка из цепи. Идёт в фоне: старт узла не ждёт, при недоступной цепи
   * повторится на следующем старте (дочитываются только пустые даты).
   */
  onApplicationBootstrap(): void {
    void this.backfillJoinedAt();
  }

  async backfillJoinedAt(): Promise<number> {
    let filled = 0;
    try {
      const usernames = await this.userRepository.findUsernamesWithoutJoinedAt();
      const BATCH = 8;
      for (let i = 0; i < usernames.length; i += BATCH) {
        const batch = usernames.slice(i, i + BATCH);
        const results = await Promise.all(
          batch.map(async (username) => {
            const participant = await this.accountBlockchainPort.getParticipantAccount(config.coopname, username);
            const joinedAt = chainTimeToDate(participant?.created_at);
            if (!joinedAt) return false;
            await this.userRepository.setJoinedAt(username, joinedAt);
            return true;
          })
        );
        filled += results.filter(Boolean).length;
      }
      if (filled > 0) this.logger.info(`Дата вступления дочитана из цепи для ${filled} пайщиков`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Дочитка дат вступления из цепи не удалась, повторится на следующем старте: ${message}`);
    }
    return filled;
  }

  @OnEvent(`action::${SovietContract.contractName.production}::addpartcpnt`)
  async handleAddParticipant(event: IAction): Promise<void> {
    try {
      const data = event.data as { coopname?: string; username?: string };

      if (data.coopname !== config.coopname) {
        return;
      }

      const username = data.username;
      if (!username) {
        this.logger.warn('addpartcpnt без username в data — пропуск');
        return;
      }

      const user = await this.userRepository.findByUsername(username);
      if (!user) {
        this.logger.warn(`addpartcpnt(${username}): моно-аккаунт не найден — пропуск`);
        return;
      }

      // Дата вступления — время блока с решением совета.
      const joinedAt = chainTimeToDate(event.block_time) ?? new Date();
      await this.userRepository.setJoinedAt(username, joinedAt);

      if (user.status === userStatus['5_Active']) {
        return;
      }

      await this.userRepository.updateByUsername(username, {
        status: userStatus['5_Active'],
      });

      this.logger.info(`addpartcpnt(${username}): users.status → ${userStatus['5_Active']}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Ошибка обработки addpartcpnt: ${message}`, stack);
    }
  }
}
