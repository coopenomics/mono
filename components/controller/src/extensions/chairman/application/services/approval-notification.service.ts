import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { NOTIFICATION_PORT, type NotificationPort } from '~/domain/notification/interfaces/notify.port';
import { ACCOUNT_DATA_PORT, AccountDataPort } from '~/domain/account/ports/account-data.port';
import type { IDelta } from '~/types/common';
import config from '~/config/config';
import { Workflows } from '@coopenomics/notifications';
import { SovietContract } from 'cooptypes';
import { ApprovalInfo, APPROVAL_TYPE_MAP } from '../../domain/approval-types';

/**
 * Сервис для отправки уведомлений по одобрениям председателя
 *
 * Подписывается на дельты таблицы approvals и отправляет уведомления председателю
 * когда создается новый запрос на одобрение
 */
@Injectable()
export class ApprovalNotificationService implements OnModuleInit {
  constructor(
    @Inject(NOTIFICATION_PORT)
    private readonly notificationPort: NotificationPort,
    @Inject(ACCOUNT_DATA_PORT)
    private readonly accountPort: AccountDataPort,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(ApprovalNotificationService.name);
  }

  async onModuleInit() {
    this.logger.log('ApprovalNotificationService инициализирован');
  }

  /**
   * Обработчик дельт таблицы approvals
   * Отправляет уведомление председателю о новом запросе на одобрение
   */
  @OnEvent(`delta::${SovietContract.contractName.production}::${SovietContract.Tables.Approvals.tableName}`)
  async handleApprovalDelta(delta: IDelta): Promise<void> {
    try {
      // Проверяем что это новая запись (present = true и это не обновление)
      if (!delta.present) {
        return;
      }

      const approvalData = delta.value as SovietContract.Tables.Approvals.IApproval;

      // Проверяем что это наш кооператив
      if (approvalData.coopname !== config.coopname) {
        return;
      }

      this.logger.debug(`Обработка нового одобрения: ${approvalData.approval_hash}`);

      // Получаем председателя через порт
      const chairmen = await this.accountPort.getAccounts({ role: 'chairman' }, { page: 1, limit: 1, sortOrder: 'ASC' });
      if (!chairmen.items || chairmen.items.length === 0) {
        this.logger.warn('Председатель не найден, пропускаем отправку уведомления');
        return;
      }

      const chairman = chairmen.items[0];
      const chairmanEmail = chairman.provider_account?.email;
      const chairmanSubscriberId = chairman.provider_account?.subscriber_id?.trim();
      if (!chairmanSubscriberId) {
        this.logger.warn(`subscriber_id председателя ${chairman.username} не найден`);
        return;
      }
      if (!chairmanEmail) {
        this.logger.warn(`Email председателя ${chairman.username} не найден`);
        return;
      }

      // Получаем отображаемое имя председателя
      const chairmanName = await this.accountPort.getDisplayName(chairman.username);

      // Получаем отображаемое имя автора запроса
      const authorName = await this.accountPort.getDisplayName(approvalData.username);

      // Получаем заголовок и описание на основе типа одобрения
      const approvalInfo: ApprovalInfo | undefined = APPROVAL_TYPE_MAP[approvalData.type as keyof typeof APPROVAL_TYPE_MAP];
      const requestTitle = approvalInfo?.title || 'Новый запрос на одобрение';
      const requestDescription = approvalInfo?.description || 'Требуется одобрение действия';

      // Формируем данные для workflow (без приватных данных)
      const payload: Workflows.ApprovalRequest.IPayload = {
        chairmanName,
        requestTitle,
        requestDescription,
        authorName,
        coopname: approvalData.coopname,
        approval_hash: approvalData.approval_hash,
        approvalUrl: `${config.frontend_url}/${approvalData.coopname}/chairman/approvals`,
      };

      // Отправляем уведомление через Центр уведомлений
      await this.notificationPort.notify({
        coopname: approvalData.coopname,
        workflowId: Workflows.ApprovalRequest.id,
        to: {
          subscriberId: chairmanSubscriberId,
          email: chairmanEmail,
          username: chairman.username,
        },
        payload,
      });
      this.logger.log(
        `Уведомление отправлено председателю ${chairman.username} о новом одобрении ${approvalData.approval_hash}`
      );
    } catch (error: any) {
      this.logger.error(`Ошибка при обработке дельты одобрения: ${error.message}`, error.stack);
    }
  }
}
