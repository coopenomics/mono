import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import cron from 'node-cron';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { NOTIFICATION_PORT, type NotificationPort } from '~/domain/notification/interfaces/notify.port';
import { ACCOUNT_DATA_PORT, AccountDataPort } from '~/domain/account/ports/account-data.port';
import { VARS_REPOSITORY, VarsRepository } from '~/domain/common/repositories/vars.repository';
import {
  EXTENSION_REPOSITORY,
  type ExtensionDomainRepository,
} from '~/domain/extension/repositories/extension-domain.repository';
import { LOG_EXTENSION_REPOSITORY, LogExtensionDomainRepository } from '~/domain/extension/repositories/log-extension-domain.repository';
import { SovietBlockchainPort, SOVIET_BLOCKCHAIN_PORT } from '~/domain/common/ports/soviet-blockchain.port';
import { SovietContract } from 'cooptypes';
import config from '~/config/config';
import type { ExtensionDomainEntity } from '~/domain/extension/entities/extension-domain.entity';
import { Workflows } from '@coopenomics/notifications';

/**
 * Сервис для отправки уведомлений об отмене решений по истечению срока
 */
@Injectable()
export class DecisionExpiredNotificationService implements OnModuleInit, OnModuleDestroy {
  private cronJob: cron.ScheduledTask | null = null;
  constructor(
    @Inject(NOTIFICATION_PORT)
    private readonly notificationPort: NotificationPort,
    @Inject(ACCOUNT_DATA_PORT)
    private readonly accountPort: AccountDataPort,
    @Inject(VARS_REPOSITORY)
    private readonly varsRepository: VarsRepository,
    @Inject(EXTENSION_REPOSITORY)
    private readonly extensionRepository: ExtensionDomainRepository,
    @Inject(LOG_EXTENSION_REPOSITORY)
    private readonly logExtensionRepository: LogExtensionDomainRepository,
    @Inject(SOVIET_BLOCKCHAIN_PORT)
    private readonly sovietBlockchainPort: SovietBlockchainPort,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(DecisionExpiredNotificationService.name);
  }

  async onModuleInit() {
    this.logger.debug('DecisionExpiredNotificationService инициализирован');
  }

  onModuleDestroy() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      this.logger.debug('node-cron задача проверки истекших решений остановлена');
    }
  }

  /**
   * Инициализирует cron-задачу для проверки истекших решений
   */
  async initialize(plugin: ExtensionDomainEntity): Promise<void> {

    // Регистрация cron-задачи для проверки истекших решений
    const cronExpression = `*/${plugin.config.checkInterval || 5} * * * *`; // каждые N минут, значение по умолчанию 5
    this.cronJob = cron.schedule(cronExpression, async () => {
      this.logger.debug('Запуск задачи проверки истекших решений');
      try {
        await this.checkExpiredDecisions(plugin);
      } catch (error) {
        const errorObj = error as Error;
        this.logger.error(
          'Ошибка при выполнении задачи проверки истекших решений:',
          errorObj.message || 'Неизвестная ошибка'
        );
      }
    });
  }

  /**
   * Записывает событие в лог расширения
   */
  private async log(data: { type: string; coopname: string; decision_id?: string; result?: string }) {
    await this.logExtensionRepository.push('chairman', {
      type: data.type,
      coopname: data.coopname,
      decision_id: data.decision_id,
      result: data.result,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Отправляет уведомление пайщику об отмене решения по истечению срока
   */
  async sendDecisionExpiredNotification(
    decisionId: string,
    decisionTitle: string,
    username: string,
    coopname: string
  ): Promise<void> {
    try {
      this.logger.debug(`Отправка уведомления об отмене решения ID: ${decisionId} пайщику ${username}`);

      // Получаем аккаунт пайщика
      const userAccount = await this.accountPort.getAccount(username);
      const userEmail = userAccount.provider_account?.email;
      const subscriberId = userAccount.provider_account?.subscriber_id?.trim();

      if (!subscriberId) {
        this.logger.warn(`subscriber_id пайщика ${username} не найден`);
        return;
      }

      if (!userEmail) {
        this.logger.warn(`Email пайщика ${username} не найден`);
        return;
      }

      // Получаем отображаемое имя пайщика
      const userName = await this.accountPort.getDisplayName(username);

      // Получаем данные кооператива из Vars
      const vars = await this.varsRepository.get();
      if (!vars) {
        this.logger.warn(`Vars для кооператива ${coopname} не найдены`);
        return;
      }

      const short_abbr = vars.short_abbr;
      const name = vars.name;

      // Формируем данные для workflow
      const payload: Workflows.DecisionExpired.IPayload = {
        userName,
        decisionTitle,
        coopname,
        decision_id: decisionId,
        short_abbr,
        name,
      };

      // Отправляем уведомление пайщику через Центр уведомлений
      await this.notificationPort.notify({
        coopname,
        workflowId: Workflows.DecisionExpired.id,
        to: {
          subscriberId,
          email: userEmail,
          username,
        },
        payload,
      });
      this.logger.log(
        `Уведомление об отмене решения ${decisionId} отправлено пайщику ${username}`
      );
    } catch (error: any) {
      this.logger.error(`Ошибка при отправке уведомления об отмене решения: ${error.message}`, error.stack);
    }
  }

  /**
   * Проверяет и отменяет истекшие решения
   */
  async checkExpiredDecisions(plugin: ExtensionDomainEntity): Promise<void> {
    try {
      // Получаем coopname из конфигурации
      const coopname = config.coopname;

      this.logger.debug(`Проверка решений для кооператива ${coopname}`);

      // Запись о проверке в лог
      await this.log({
        type: 'check',
        coopname,
      });

      // Получаем все решения для кооператива
      const decisions = await this.sovietBlockchainPort.getDecisions(coopname);

      // Текущая дата для сравнения
      const now = new Date();
      // Находим истекшие решения
      const expiredDecisions = decisions.filter((decision) => {
        // TODO: убрать после первого деплоя т.к. все старые решения отменятся.
        // Если поле expired_at не существует, добавляем
        if (!decision.expired_at) return true;

        // По истечению срока гасим ВСЕ решения (и принятые, и нет). Отрицательно
        // принятые решения отдельно снимает председатель действием declinedec —
        // авто-отмена по сроку и явный отказ по консенсусу теперь развязаны.
        // Конвертируем дату из формата блокчейна в JavaScript Date
        const expiredDate = new Date(decision.expired_at);

        // Проверяем, истек ли срок
        return expiredDate <= now;
      });

      this.logger.debug(`Найдено ${expiredDecisions.length} истекших решений для кооператива ${coopname}`);

      // Отменяем каждое истекшее решение
      for (const decision of expiredDecisions) {
        try {

          this.logger.info(`Отмена истекшего решения ID: ${decision.id} для кооператива ${coopname}`);

          // Создаем объект данных для транзакции отмены
          const cancelData: SovietContract.Actions.Decisions.Cancelexprd.ICancelExpired = {
            coopname,
            decision_id: decision.id,
          };

          // Вызываем метод отмены из порта блокчейна
          const result = await this.sovietBlockchainPort.cancelExpiredDecision(cancelData);

          // Запись об успешной отмене в лог
          await this.log({
            type: 'cancel',
            coopname,
            decision_id: decision.id.toString(),
            result: 'success',
          });

          // Безопасно обращаемся к результату транзакции
          const txId = result.resolved?.transaction?.id ? result.resolved.transaction.id : 'неизвестно';
          this.logger.info(`Решение ID: ${decision.id} успешно отменено`, { transactionId: txId });

          // Отправляем уведомление пайщику об отмене решения
          try {
            const decisionTitle = (() => {
              try {
                const parsedMeta = JSON.parse(decision.meta);
                return parsedMeta.title || '';
              } catch {
                return '';
              }
            })();
            await this.sendDecisionExpiredNotification(
              decision.id.toString(),
              decisionTitle,
              decision.username,
              decision.coopname
            );
          } catch (notificationError: any) {
            this.logger.error(`Ошибка при отправке уведомления об отмене решения ID: ${decision.id}`, notificationError.message);
          }
        } catch (error) {
          // Безопасно обрабатываем ошибку
          const errorObj = error as Error;
          this.logger.error(`Ошибка при отмене решения ID: ${decision.id}`, errorObj.message || 'Неизвестная ошибка');

          // Запись об ошибке в лог
          await this.log({
            type: 'cancel',
            coopname,
            decision_id: decision.id.toString(),
            result: `error: ${errorObj.message || 'Неизвестная ошибка'}`,
          });
        }
      }

      // Обновляем дату последней проверки. ВАЖНО: read-modify-write по СВЕЖЕМУ
      // config из БД, а не по захваченному при initialize() снимку `plugin`.
      // Cron-замыкание держит in-memory снимок с момента boot; за время между
      // boot и тиком онбординг-флаги (`onboarding_*_done/_hash`) и прочие поля
      // могли быть записаны в БД другими сервисами. Перезапись устаревшего
      // снимка стёрла бы их (lost update). Поэтому берём актуальный config и
      // трогаем только lastCheckDate.
      const fresh = await this.extensionRepository.findByName('chairman');
      const baseConfig = fresh?.config ?? plugin.config;
      const updatedConfig = {
        ...baseConfig,
        lastCheckDate: new Date().toISOString(),
      };
      await this.extensionRepository.update({ name: 'chairman', config: updatedConfig });

      this.logger.debug('Проверка истекших решений завершена');
    } catch (error) {
      // Безопасно обрабатываем ошибку
      const errorObj = error as Error;
      this.logger.error('Ошибка при проверке истекших решений:', errorObj.message || 'Неизвестная ошибка');
    }
  }
}
