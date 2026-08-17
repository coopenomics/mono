// infrastructure/blockchain/services/blockchain-repeat.service.ts

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import cron from 'node-cron';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { EventsService } from '~/infrastructure/events/events.service';
import { ParserInteractor } from '~/domain/parser/interactors/parser.interactor';

/**
 * Сервис для повторной отправки событий дельт и действий блокчейна
 * Мониторит записи в БД с флагом repeat=true и отправляет события повторно
 * в внутреннюю шину событий, после чего сбрасывает флаг
 */
@Injectable()
export class BlockchainRepeatService implements OnModuleInit, OnModuleDestroy {
  private cronJob: cron.ScheduledTask | null = null;

  constructor(
    private readonly logger: WinstonLoggerService,
    private readonly eventsService: EventsService,
    private readonly parserInteractor: ParserInteractor
  ) {
    this.logger.setContext(BlockchainRepeatService.name);
  }

  async onModuleInit() {
    this.logger.log('Инициализация сервиса повторной отправки событий блокчейна');

    // Запуск задачи проверки каждую минуту
    this.cronJob = cron.schedule('* * * * *', async () => {
      await this.processRepeatableEvents();
    });

    this.logger.log('node-cron задача повторной отправки событий запущена (каждую минуту)');
  }

  onModuleDestroy() {
    this.logger.log('Остановка сервиса повторной отправки событий блокчейна');

    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      this.logger.log('node-cron задача повторной отправки событий остановлена');
    }
  }

  /**
   * Периодическая проверка и повторная отправка событий (каждую минуту)
   * Использует cron для автоматизации процесса
   */
  private async processRepeatableEvents(): Promise<void> {
    try {
      await this.processRepeatableDeltas();
      await this.processRepeatableActions();
    } catch (error: any) {
      this.logger.error(`Ошибка при обработке повторяемых событий: ${error.message}`, error.stack);
    }
  }

  /**
   * Обработка дельт с флагом repeat = true
   */
  private async processRepeatableDeltas(): Promise<void> {
    // Получаем все дельты с флагом repeat = true
    const repeatableDeltas = await this.parserInteractor.getDeltas(
      { repeat: true },
      1,
      1000 // Ограничиваем количество для предотвращения перегрузки
    );

    if (repeatableDeltas.results.length === 0) {
      return;
    }

    this.logger.debug(`Найдено ${repeatableDeltas.results.length} дельт для повторной отправки`);

    for (const delta of repeatableDeltas.results) {
      try {
        // Отправляем событие в шину
        const eventName = `delta::${delta.code}::${delta.table}`;
        this.eventsService.emit(eventName, delta);

        this.logger.debug(`Повторно отправлена дельта: ${eventName} с primary_key ${delta.primary_key}`);

        // Сбрасываем флаг repeat после успешной отправки
        // Для этого нужно получить доступ к репозиторию напрямую
        // или добавить метод в ParserInteractor
        await this.resetDeltaRepeatFlag(delta.id);
      } catch (error: any) {
        this.logger.error(
          `Ошибка при повторной отправке дельты ${delta.code}::${delta.table}: ${error.message}`,
          error.stack
        );
        // Продолжаем обработку следующих дельт даже при ошибке
      }
    }
  }

  /**
   * Обработка действий с флагом repeat = true
   */
  private async processRepeatableActions(): Promise<void> {
    // Получаем все действия с флагом repeat = true
    const repeatableActions = await this.parserInteractor.getActions(
      { repeat: true },
      1,
      1000 // Ограничиваем количество для предотвращения перегрузки
    );

    if (repeatableActions.results.length === 0) {
      return;
    }

    this.logger.debug(`Найдено ${repeatableActions.results.length} действий для повторной отправки`);

    for (const action of repeatableActions.results) {
      try {
        // Отправляем событие в шину
        const eventName = `action::${action.account}::${action.name}`;
        this.eventsService.emit(eventName, action);

        this.logger.debug(`Повторно отправлено действие: ${eventName} с sequence ${action.global_sequence}`);

        // Сбрасываем флаг repeat после успешной отправки. Идентификатор есть
        // всегда: сюда попадают действия, прочитанные из журнала, — но в общей
        // форме он необязателен (у события из шины его ещё нет), поэтому
        // проверяем явно, а не приводим тип.
        if (action.id) {
          await this.resetActionRepeatFlag(action.id);
        }
      } catch (error: any) {
        this.logger.error(
          `Ошибка при повторной отправке действия ${action.account}::${action.name}: ${error.message}`,
          error.stack
        );
        // Продолжаем обработку следующих действий даже при ошибке
      }
    }
  }

  /**
   * Сброс флага repeat для дельты
   */
  private async resetDeltaRepeatFlag(deltaId: string): Promise<void> {
    await this.parserInteractor.resetDeltaRepeatFlag(deltaId);
  }

  /**
   * Сброс флага repeat для действия
   */
  private async resetActionRepeatFlag(actionId: string): Promise<void> {
    await this.parserInteractor.resetActionRepeatFlag(actionId);
  }
}
