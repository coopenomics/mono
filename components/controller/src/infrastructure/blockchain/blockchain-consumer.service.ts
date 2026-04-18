// infrastructure/blockchain/blockchain-consumer.service.ts

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { IAction, IDelta } from '~/types/common';
import { RedisStreamService, StreamMessage } from '~/infrastructure/redis/redis-stream.service';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { EventsService } from '~/infrastructure/events/events.service';
import { ParserInteractor } from '~/domain/parser/interactors/parser.interactor';
import { config } from '~/config';

export interface BlockchainEventData {
  type: string;
  event?: IAction;
  delta?: IDelta;
  block_num?: number;
}

// Выносим исключения в конфиг или отдельный файл
const ACTION_EXCEPTIONS = {
  'eosio.token': ['transfer', 'issue'],
};

/**
 * Инфраструктурный сервис потребления событий блокчейна из Redis
 * Читает события из Redis стрима и публикует их во внутреннюю шину событий
 * Не содержит бизнес-логики, только предварительную фильтрацию
 */
@Injectable()
export class BlockchainConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly streamName = 'notifications';
  private readonly consumerGroup = 'blockchain-consumer';
  private readonly consumerName: string;

  constructor(
    private readonly redisStreamService: RedisStreamService,
    private readonly logger: WinstonLoggerService,
    private readonly eventsService: EventsService,
    private readonly parserInteractor: ParserInteractor
  ) {
    this.logger.setContext(BlockchainConsumerService.name);
    this.consumerName = `consumer-${Math.random().toString(36).substr(2, 9)}`;
  }

  async onModuleInit() {
    this.logger.log('Инициализация сервиса потребителя блокчейна');

    // Создаем consumer group
    await this.redisStreamService.createConsumerGroup(this.streamName, this.consumerGroup);

    // Запускаем потребление сообщений
    this.startConsuming();
  }

  onModuleDestroy() {
    this.logger.log('Остановка сервиса потребителя блокчейна');
    this.redisStreamService.stopConsumer(this.streamName, this.consumerGroup, this.consumerName);
  }

  /**
   * Запуск потребления сообщений из Redis стрима
   */
  private async startConsuming(): Promise<void> {
    this.logger.log(`Starting consumer ${this.consumerName} for stream ${this.streamName}`);

    await this.redisStreamService.startConsumer(
      {
        stream: this.streamName,
        group: this.consumerGroup,
        consumer: this.consumerName,
        count: 1,
        block: 1000,
      },
      this.handleMessage.bind(this)
    );
  }

  /**
   * Обработка входящего сообщения из стрима
   */
  private async handleMessage(message: StreamMessage): Promise<void> {
    try {
      const eventData: BlockchainEventData = JSON.parse(
        message.fields.event || message.fields.delta || message.fields.fork || '{}'
      );

      if (eventData.event) {
        await this.processAction(eventData.event);
      } else if (eventData.delta) {
        await this.processDelta(eventData.delta);
      } else if (eventData.block_num !== undefined) {
        await this.processFork(eventData.block_num);
      } else {
        this.logger.warn(`Unknown message format: ${JSON.stringify(message.fields)}`);
      }
    } catch (error: any) {
      this.logger.error(`Ошибка обработки сообщения ${message.messageId}: ${error.message}`, error.stack);
      throw error; // Перебрасываем ошибку чтобы сообщение не было подтверждено
    }
  }

  /**
   * Обработка действия (action) из блокчейна
   * Выполняет минимальную предварительную фильтрацию, сохраняет в базу и публикует событие во внутреннюю шину
   */
  private async processAction(action: IAction): Promise<void> {
    if (action.receiver != action.account) {
      return;
    }
    this.logger.debug(`Обработка действия: ${action.name} от ${action.account}: ${JSON.stringify(action.data)}`);

    // Откладываем обработку на 3 секунды асинхронно
    setTimeout(async () => {
      try {
        await this.processActionDelayed(action);
      } catch (error: any) {
        this.logger.error(
          `Ошибка асинхронной обработки действия ${action.account}::${action.name}: ${error.message}`,
          error.stack
        );
        // Ошибка логируется, но не перебрасывается, чтобы не падало приложение
      }
    }, 3000); //небольшая задержка чтобы дельты имели приоритет перед действиями
  }

  private async processActionDelayed(action: IAction): Promise<void> {
    // Проверяем, является ли действие исключением
    const isException = this.isActionException(action.account, action.name);

    // Если не исключение и нет coopname - пропускаем
    if (!isException && action.data?.coopname !== config.coopname) {
      this.logger.debug(`Skipping action: ${action.account}::${action.name} - wrong coopname`);
      return;
    }

    try {
      // Сохраняем действие в базу данных через интерактор
      await this.parserInteractor.saveAction(action);
      this.logger.debug(
        `Action saved to database: ${action.account}::${action.name} with sequence ${action.global_sequence}`
      );
    } catch (error: any) {
      this.logger.error(`Не удалось сохранить действие ${action.account}::${action.name}: ${error.message}`, error.stack);
      throw error; // Перебрасываем ошибку чтобы сообщение не было подтверждено
    }

    // Публикуем событие
    const eventName = `action::${action.account}::${action.name}`;
    this.eventsService.emit(eventName, action);

    this.logger.debug(`Действие опубликовано в событийную шину: ${eventName} с sequence ${action.global_sequence}`);
  }

  private isActionException(account: string, actionName: string): boolean {
    const accountExceptions = ACTION_EXCEPTIONS[account];
    if (!accountExceptions) return false;

    // Если есть звездочка - все действия исключение
    if (accountExceptions.includes('*')) return true;

    // Проверяем конкретное действие
    return accountExceptions.includes(actionName);
  }

  /**
   * Обработка дельты (delta) из блокчейна
   * Выполняет минимальную предварительную фильтрацию, сохраняет в базу и публикует событие во внутреннюю шину
   */
  private async processDelta(delta: IDelta): Promise<void> {
    this.logger.debug(`Обработка дельты: ${delta.table} от ${delta.code}`);

    // Откладываем обработку на 3 секунды асинхронно
    // setTimeout(async () => {
    try {
      await this.processDeltaDelayed(delta);
    } catch (error: any) {
      this.logger.error(`Ошибка асинхронной обработки дельты ${delta.code}::${delta.table}: ${error.message}`, error.stack);
      // Ошибка логируется, но не перебрасывается, чтобы не падало приложение
    }
    // }, 3000);
  }

  private async processDeltaDelayed(delta: IDelta): Promise<void> {
    // Пропускаем дельту, если она не относится к нашему кооперативу.
    // coopname может быть в value (большинство таблиц контроллируемых таблиц)
    // ИЛИ в scope (ончейн-таблицы с scope=coopname: ledger2 wjournal/journal/
    // wallets/accounts, wallet deposits/withdraws, capital debts/results/...).
    const deltaCoop = (delta.value as any)?.coopname ?? delta.scope;
    if (deltaCoop != config.coopname) {
      return;
    }

    try {
      // Сохраняем дельту в базу данных через интерактор
      await this.parserInteractor.saveDelta(delta);
      this.logger.log(`Дельта сохранена в базу: ${delta.code}::${delta.table} с primary_key ${delta.primary_key}`);
    } catch (error: any) {
      this.logger.error(`Не удалось сохранить дельту ${delta.code}::${delta.table}: ${error.message}`, error.stack);
      throw error; // Перебрасываем ошибку чтобы сообщение не было подтверждено
    }

    // Публикуем событие во внутреннюю шину с типизированным именем
    const eventName = `delta::${delta.code}::${delta.table}`;
    this.eventsService.emit(eventName, delta);

    this.logger.debug(`Дельта опубликована в событийную шину: ${eventName} с primary_key ${delta.primary_key}`);
  }

  /**
   * Обработка форка (fork) из блокчейна
   * Сохраняет форк в базу и публикует событие форка во внутреннюю шину
   */
  private async processFork(block_num: number): Promise<void> {
    this.logger.debug(`Обработка форка на блоке: ${block_num}`);

    try {
      // Сохраняем форк в базу данных через интерактор
      await this.parserInteractor.saveFork({
        chain_id: config.blockchain.id, // Используем chain id из конфига
        block_num: block_num,
      });
      this.logger.debug(`Форк сохранен в базу данных на блоке: ${block_num}`);
    } catch (error: any) {
      this.logger.error(`Не удалось сохранить форк на блоке ${block_num}: ${error.message}`, error.stack);
      throw error; // Перебрасываем ошибку чтобы сообщение не было подтверждено
    }

    // Публикуем событие во внутреннюю шину с типизированным именем
    const eventName = `fork::${block_num}`;
    this.eventsService.emit(eventName, { block_num });

    this.logger.debug(`Форк опубликован в событийную шину: ${eventName}`);
  }
}
