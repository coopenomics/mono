import { Injectable, Inject } from '@nestjs/common';
import { APPENDIX_REPOSITORY, AppendixRepository } from '../../domain/repositories/appendix.repository';
import { AppendixStatus } from '../../domain/enums/appendix-status.enum';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';
import { CapitalContract } from 'cooptypes';

/**
 * Интерактор для управления одобрением/отклонением приложений
 */
@Injectable()
export class ClearanceManagementInteractor {
  constructor(
    @Inject(APPENDIX_REPOSITORY)
    private readonly appendixRepository: AppendixRepository,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(ClearanceManagementInteractor.name);
  }

  /**
   * Обработать одобрение приложения
   */
  async handleConfirmClearance(actionData: ActionDomainInterface): Promise<void> {
    try {
      const { data, block_num } = actionData;
      const actionPayload = data as CapitalContract.Actions.ConfirmClearance.IConfirmClearance;

      this.logger.debug(`Обработка одобрения приложения ${actionPayload.appendix_hash} в блоке ${block_num}`);

      // Найти приложение по appendix_hash
      const appendix = await this.appendixRepository.findByAppendixHash(actionPayload.appendix_hash);

      if (!appendix) {
        this.logger.warn(`Приложение ${actionPayload.appendix_hash} не найдено для одобрения`);
        return;
      }

      // Обновить статус и блок
      appendix.status = AppendixStatus.CONFIRMED;
      appendix.block_num = block_num;

      // Сохранить изменения
      await this.appendixRepository.save(appendix);

      this.logger.debug(`Приложение ${actionPayload.appendix_hash} одобрено`);
    } catch (error: any) {
      this.logger.error(`Ошибка при обработке одобрения приложения: ${error?.message}`, error?.stack);
    }
  }

  /**
   * Обработать отклонение приложения
   */
  async handleDeclineClearance(actionData: ActionDomainInterface): Promise<void> {
    try {
      const { data, block_num } = actionData;
      const actionPayload = data as CapitalContract.Actions.DeclineClearance.IDeclineClearance;

      this.logger.debug(`Обработка отклонения приложения ${actionPayload.appendix_hash} в блоке ${block_num}`);

      // Найти приложение по appendix_hash
      const appendix = await this.appendixRepository.findByAppendixHash(actionPayload.appendix_hash);

      if (!appendix) {
        this.logger.warn(`Приложение ${actionPayload.appendix_hash} не найдено для отклонения`);
        return;
      }

      // Обновить статус и блок
      appendix.status = AppendixStatus.DECLINED;
      appendix.block_num = block_num;

      // Сохранить изменения
      await this.appendixRepository.save(appendix);

      this.logger.debug(`Приложение ${actionPayload.appendix_hash} отклонено`);
    } catch (error: any) {
      this.logger.error(`Ошибка при обработке отклонения приложения: ${error?.message}`, error?.stack);
      throw error;
    }
  }
}
