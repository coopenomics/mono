// domain/account/services/participant-status-sync.service.ts

import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SovietContract } from 'cooptypes';
import config from '~/config/config';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { USER_REPOSITORY, UserRepository } from '~/domain/user/repositories/user.repository';
import { userStatus } from '~/types/user.types';
import type { IAction } from '~/types';

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
export class ParticipantStatusSyncService {
  constructor(
    private readonly logger: WinstonLoggerService,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
  ) {
    this.logger.setContext(ParticipantStatusSyncService.name);
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
