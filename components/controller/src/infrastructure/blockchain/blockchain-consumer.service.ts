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
  /**
   * Стабильное имя consumer'а. Раньше было `consumer-${random}`, и каждый
   * рестарт coopback создавал нового consumer'а, а прежний оставался в
   * группе со своими pending-сообщениями — зомби-consumer. Со стабильным
   * именем мы всегда возвращаемся к «своему» pending-списку после рестарта
   * и можем его доиграть (readOwnPending на старте).
   *
   * Если понадобится horizontal-scaling (несколько реплик coopback'а) —
   * имя можно расширить до `coopback-${HOSTNAME}` через env.
   */
  private readonly consumerName = 'coopback-main';

  /** Как долго pending другого consumer'а должен висеть, прежде чем его можно забрать. */
  private readonly staleClaimIdleMs = 5 * 60 * 1000; // 5 минут
  /** Период XAUTOCLAIM поиска stale pending. */
  private readonly claimIntervalMs = 60 * 1000; // 1 минута
  /** Период XTRIM MINID для освобождения памяти Redis от consumed сообщений. */
  private readonly trimIntervalMs = 30 * 1000; // 30 секунд

  private claimTimer?: NodeJS.Timeout;
  private trimTimer?: NodeJS.Timeout;

  constructor(
    private readonly redisStreamService: RedisStreamService,
    private readonly logger: WinstonLoggerService,
    private readonly eventsService: EventsService,
    private readonly parserInteractor: ParserInteractor
  ) {
    this.logger.setContext(BlockchainConsumerService.name);
  }

  async onModuleInit() {
    this.logger.log('Инициализация сервиса потребителя блокчейна');
    await this.redisStreamService.createConsumerGroup(this.streamName, this.consumerGroup);

    // 1) Сначала доиграть свои pending (могли остаться после crash'а между
    //    handleMessage и xack). Если их нет — мгновенно пройдёт.
    await this.recoverOwnPending();

    // 2) Забрать pending у зомби-consumer'ов предыдущих рестартов,
    //    чтобы они не висели вечно. XAUTOCLAIM idempotent.
    await this.reclaimStalePending();

    // 3) Запустить основной consumer loop (на новые сообщения, `>`).
    this.startConsuming();

    // 4) Фоновые задачи: периодический XAUTOCLAIM + XTRIM MINID.
    this.claimTimer = setInterval(
      () => this.reclaimStalePending().catch((e) => this.logger.error(`claim tick: ${e?.message}`, e?.stack)),
      this.claimIntervalMs,
    );
    this.trimTimer = setInterval(
      () => this.trimConsumed().catch((e) => this.logger.error(`trim tick: ${e?.message}`, e?.stack)),
      this.trimIntervalMs,
    );
  }

  onModuleDestroy() {
    this.logger.log('Остановка сервиса потребителя блокчейна');
    if (this.claimTimer) clearInterval(this.claimTimer);
    if (this.trimTimer) clearInterval(this.trimTimer);
    this.redisStreamService.stopConsumer(this.streamName, this.consumerGroup, this.consumerName);
  }

  /**
   * После рестарта контроллера читаем pending, адресованные нашему consumer'у.
   * Это сообщения, которые Redis считает выданными нам, но ещё не ACK'нутыми —
   * например, процесс упал после handleMessage, до xack. Доигрываем в том же
   * порядке, ACK'аем — и дальше работает `>`-поток.
   */
  private async recoverOwnPending(): Promise<void> {
    let total = 0;
    // Читаем порциями до тех пор, пока pending не закончится.
    while (true) {
      const messages = await this.redisStreamService.readOwnPending(
        this.streamName,
        this.consumerGroup,
        this.consumerName,
        100,
      );
      if (messages.length === 0) break;
      for (const msg of messages) {
        try {
          await this.handleMessage(msg);
          await this.redisStreamService.acknowledgeMessage(this.streamName, this.consumerGroup, msg.messageId);
          total += 1;
        } catch (err: any) {
          this.logger.error(
            `recoverOwnPending: не удалось переобработать ${msg.messageId}: ${err?.message}`,
            err?.stack,
          );
          // Оставляем pending — claim retry по idle разберёт.
        }
      }
    }
    if (total > 0) this.logger.log(`recoverOwnPending: доиграно ${total} сообщений`);
  }

  /**
   * Забрать pending другого consumer'а, который idle > staleClaimIdleMs.
   * Обычный кейс: зомби-consumer из прошлой сессии (если в БД Redis остались
   * следы старого случайного имени `consumer-${random}` до этого фикса).
   * Также защита от split-brain, если когда-нибудь появится несколько реплик.
   */
  private async reclaimStalePending(): Promise<void> {
    let claimed = 0;
    try {
      const messages = await this.redisStreamService.autoClaimStale(
        this.streamName,
        this.consumerGroup,
        this.consumerName,
        this.staleClaimIdleMs,
        100,
      );
      for (const msg of messages) {
        try {
          await this.handleMessage(msg);
          await this.redisStreamService.acknowledgeMessage(this.streamName, this.consumerGroup, msg.messageId);
          claimed += 1;
        } catch (err: any) {
          this.logger.error(
            `reclaimStalePending: ошибка ${msg.messageId}: ${err?.message}`,
            err?.stack,
          );
        }
      }
      if (claimed > 0) this.logger.warn(`reclaimStalePending: перехвачено и обработано ${claimed} stale-сообщений`);
    } catch (err: any) {
      this.logger.error(`reclaimStalePending: ${err?.message}`, err?.stack);
    }
  }

  /**
   * XTRIM MINID: освобождаем Redis от ACK-нутых сообщений.
   * Parser больше не делает XTRIM MAXLEN (burst'ы удаляли не-consumed), так что
   * обрезка — обязанность consumer'а, который _точно знает_ границу.
   *
   * Граница = first-pending-id (если pending не пусто) ИЛИ last-generated-id
   * (если ВСЕ сообщения consumed — тогда stream можно почистить полностью).
   * Всё что ≤ first-pending, уже ACK'нуто кем-то в группе — безопасно.
   */
  private async trimConsumed(): Promise<void> {
    try {
      const firstPending = await this.redisStreamService.getFirstPendingId(this.streamName, this.consumerGroup);
      const trimId = firstPending ?? (await this.redisStreamService.getStreamLastId(this.streamName));
      if (!trimId || trimId === '0-0') return;
      await this.redisStreamService.trimUpTo(this.streamName, trimId);
    } catch (err: any) {
      this.logger.error(`trimConsumed: ${err?.message}`, err?.stack);
    }
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
   * Выполняет минимальную предварительную фильтрацию, сохраняет в базу и
   * с задержкой публикует событие во внутреннюю шину.
   *
   * Порядок writes: сохранение → ACK (по возврату из handleMessage) →
   * отложенный emit события через ACTION_EMIT_DELAY_MS. Задержка нужна
   * чтобы дельты, попавшие в стрим из того же блока что и action, успели
   * пройти обработчики и прописаться в БД ДО того, как обработчики action
   * полезут читать состояние (например, ClearanceManagementInteractor по
   * apprvappndx ищет appendix в capital_appendixes — без задержки гонится
   * с дельтой capital::appendixes того же блока). См. задачу #53.
   *
   * Ошибка saveAction бросается наверх в handleMessage → сообщение НЕ
   * подтверждается и остаётся pending (consumer перечитает его через
   * XCLAIM/re-delivery). Emit'ится только то, что успешно сохранено.
   */
  private async processAction(action: IAction): Promise<void> {
    if (action.receiver != action.account) {
      return;
    }
    this.logger.debug(`Обработка действия: ${action.name} от ${action.account}: ${JSON.stringify(action.data)}`);
    await this.processActionDelayed(action);
  }

  /**
   * Задержка emit'а action-события — даёт время дельтам того же блока
   * (capital_appendixes, capital_projects, ...) сохраниться раньше, чем
   * обработчики action полезут их читать. Подобрана опытно: при <1.5с
   * на быстрой машине race ещё происходит, при ~3с гонок не наблюдаем.
   */
  private static readonly ACTION_EMIT_DELAY_MS = 3000;

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

    // Публикуем событие с задержкой — пусть сначала прокатятся дельты этого же блока.
    // saveAction уже выполнен, так что данные не потеряем; задерживаем только emit.
    const eventName = `action::${action.account}::${action.name}`;
    const delayMs = BlockchainConsumerService.ACTION_EMIT_DELAY_MS;
    setTimeout(() => {
      this.eventsService.emit(eventName, action);
      this.logger.debug(
        `Действие опубликовано в событийную шину: ${eventName} с sequence ${action.global_sequence} (delay ${delayMs}ms)`
      );
    }, delayMs);
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
   * Выполняет минимальную предварительную фильтрацию, сохраняет в базу и публикует событие во внутреннюю шину.
   *
   * Ошибка saveDelta поднимается наверх в handleMessage → сообщение остаётся
   * pending в consumer group. См. processAction — тот же контракт.
   * Раньше здесь был try/catch, который глотал ошибки и log-only'ил их: это
   * приводило к silent data loss (ACK шёл, дельта в PG не попадала).
   */
  private async processDelta(delta: IDelta): Promise<void> {
    this.logger.debug(`Обработка дельты: ${delta.table} от ${delta.code}`);
    await this.processDeltaDelayed(delta);
  }

  private async processDeltaDelayed(delta: IDelta): Promise<void> {
    // Пропускаем дельту, если она не относится к нашему кооперативу.
    // coopname может быть в value (таблицы с value.coopname: candidates2,
    // deposits, withdraws, debts, contributors, ...) ИЛИ в scope (ончейн-
    // таблицы с scope=coopname: ledger2 accounts/wallets, capital results/
    // segments/pgproperties, marketplace requests, ...).
    //
    // Строгая проверка непустой строки: если value.coopname = "" (битый
    // ABI) — `?? scope` НЕ сработает, и пустая строка пройдёт `!= config.coopname`,
    // но саму дельту мы потеряем. Поэтому пустой value.coopname — тоже fallback на scope.
    const valueCoop = (delta.value as any)?.coopname;
    const valueCoopValid = typeof valueCoop === 'string' && valueCoop.length > 0;
    const deltaCoop = valueCoopValid ? valueCoop : delta.scope;
    if (deltaCoop !== config.coopname) {
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
