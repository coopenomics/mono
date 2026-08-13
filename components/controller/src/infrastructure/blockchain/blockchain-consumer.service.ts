// infrastructure/blockchain/blockchain-consumer.service.ts

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ParserClient, type ParserEvent } from '@coopenomics/parser2';
import { IAction, IDelta } from '~/types/common';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { EventsService } from '~/infrastructure/events/events.service';
import { ParserInteractor } from '~/domain/parser/interactors/parser.interactor';
import { ForkRegistryService } from '~/shared/sync/fork';
import { computeActionEventId, computeDeltaEventId, computeForkEventId } from './event-id.util';
import { mapParserActionToIAction, mapParserDeltaToIDelta } from './parser2-event.mapper';
import { isPlatformWideTable } from './platform-wide-tables';
import { config } from '~/config';

// Выносим исключения в конфиг или отдельный файл
const ACTION_EXCEPTIONS = {
  'eosio.token': ['transfer', 'issue'],
};

/**
 * Потребление событий блокчейна из parser2 (@coopenomics/parser2).
 *
 * Транспорт: единственный — ParserClient поверх Redis Stream parser2
 * (`ce:parser2:<chain_id>:events`). Старый самодельный consumer поверх стрима
 * `notifications` (его писал parser1, components/parser) удалён. Никаких флагов и
 * параллельной работы двух движков: либо контроллер работает на parser2, либо нет.
 *
 * ParserClient берёт на себя то, что раньше делала ручная обвязка консьюмера:
 * consumer-group, XREADGROUP/XACK, single-active-lock, recover-own-pending,
 * dead-letter после N провалов, XTRIM. Контроллеру остаётся только обработка.
 *
 * event_id (дедуп, INV-09) вычисляется локально из полей события — формат
 * action/delta (см. event-id.util.ts). parser2 кладёт свой event_id в событие,
 * но контроллер ведёт собственный consumer_dedup в привычном формате.
 *
 * Обработчики processAction/processDelta/processFork не изменились при смене
 * транспорта — маппер переводит ParserEvent → IDelta/IAction (DEC-T09).
 */
@Injectable()
export class BlockchainConsumerService implements OnModuleInit, OnModuleDestroy {
  /** Имя подписки = имя consumer-group parser2. Детерминировано по кооперативу. */
  private readonly subscriptionId = `controller-${config.coopname}`;

  /** Пауза перед переподключением, если поток ParserClient неожиданно упал. */
  private readonly reconnectDelayMs = 5000;

  private client?: ParserClient;
  private running = false;

  constructor(
    private readonly logger: WinstonLoggerService,
    private readonly eventsService: EventsService,
    private readonly parserInteractor: ParserInteractor,
    private readonly forkRegistry: ForkRegistryService
  ) {
    this.logger.setContext(BlockchainConsumerService.name);
  }

  async onModuleInit() {
    this.logger.log('Инициализация потребителя событий parser2');
    this.running = true;
    // Не await: цикл живёт всё время работы приложения.
    void this.runConsumeLoop();
  }

  async onModuleDestroy() {
    this.logger.log('Остановка потребителя событий parser2');
    this.running = false;
    if (this.client) {
      await this.client.close().catch((e) => this.logger.error(`Ошибка close ParserClient: ${e?.message}`, e?.stack));
    }
  }

  /**
   * Внешний цикл: держит подписку живой. Если поток ParserClient завершился с
   * ошибкой (обрыв Redis и т.п.) — пауза и переподключение, пока сервис running.
   */
  private async runConsumeLoop(): Promise<void> {
    while (this.running) {
      try {
        await this.consume();
      } catch (err: any) {
        this.logger.error(`Поток ParserClient прерван: ${err?.message}`, err?.stack);
      }
      if (this.client) {
        await this.client.close().catch(() => undefined);
        this.client = undefined;
      }
      if (this.running) {
        await new Promise((r) => setTimeout(r, this.reconnectDelayMs));
        this.logger.warn('Переподключение к parser2…');
      }
    }
  }

  /**
   * Один проход подписки. Управляем генератором вручную: it.next() подтверждает
   * (XACK внутри ParserClient) успешно обработанное событие, it.throw(err) при
   * ошибке обработчика запускает учёт провалов parser2 (PEL-retry / dead-letter
   * после порога) — событие НЕ ACK'ается молча. Наивный `for await` тут неверен:
   * проброс из тела вызывает iterator.return(), catch вокруг yield не срабатывает,
   * и одна ошибка убила бы консьюмер.
   */
  private async consume(): Promise<void> {
    this.client = new ParserClient({
      subscriptionId: this.subscriptionId,
      // Без фильтров: получаем все события, фильтрация по coopname — в processDelta/processAction.
      //
      // Точка старта — начало стрима, а не его конец ('last_known' = '$').
      // Индексер читает цепь быстрее, чем поднимается приложение, поэтому к
      // моменту первой подписки в стриме уже лежат события первых блоков:
      // с '$' они не были бы прочитаны никогда, и состояние из них (участники,
      // совет, кошельки) в базу бы не попало. Прежний консьюмер создавал группу
      // ровно с '0' по той же причине. Повторной обработки это не вызывает:
      // точка чтения группы живёт в Redis, а каждое событие проходит dedup-gate
      // по event_id.
      startFrom: 0,
      redis: {
        url: `redis://${config.redis.host}:${config.redis.port}`,
        password: config.redis.password || undefined,
      },
      chain: { id: config.blockchain.id },
      // Жизненным циклом управляет NestJS (onModuleDestroy), не SIGTERM-хуки parser2.
      noSignalHandlers: true,
    });

    this.logger.log(`Подписка parser2 "${this.subscriptionId}" на цепь ${config.blockchain.id}`);

    const iterator = this.client.stream();
    let result = await iterator.next();
    while (!result.done && this.running) {
      try {
        await this.handleEvent(result.value);
        result = await iterator.next(); // успех → XACK внутри ParserClient
      } catch (err: any) {
        this.logger.error(`Ошибка обработки события parser2: ${err?.message}`, err?.stack);
        result = await iterator.throw(err); // провал → FailureTracker / dead-letter parser2
      }
    }
  }

  /**
   * Диспетчеризация события parser2 на обработчики контроллера.
   * native-delta контроллер не потребляет (нет легаси-пути) — пропускаем.
   *
   * fork-event (Story 4.1, AC INV-09): dedup-gate в handleEvent — повторно
   * доставленный fork с уже отмеченным event_id делает ранний return. Иначе
   * runAll/deleteAfterBlock/saveFork выполнятся повторно, что для ForkEntity
   * без UNIQUE-constraint породит дубль и нагрузку на репозитории syncer'ов.
   * markApplied идёт ПОСЛЕ успешного processFork (порядок симметричен dispatch'у
   * action/delta: save → mark, иначе сбой между save и mark = silent loss).
   */
  private async handleEvent(event: ParserEvent): Promise<void> {
    switch (event.kind) {
      case 'action':
        return this.processAction(mapParserActionToIAction(event));
      case 'delta':
        return this.processDelta(mapParserDeltaToIDelta(event));
      case 'fork': {
        // event_id вычисляем локально в controller-формате (chain:fork:...), а НЕ
        // берём event.event_id из parser2 (его формат chain:f:...) — иначе в
        // consumer_dedup смешаются две формулы, и дедуп между controller и
        // транспортом расползётся. См. event-id.util.ts.
        const eventId = computeForkEventId(event.chain_id, event.forked_from_block, event.new_head_block_id);
        if (await this.parserInteractor.isEventApplied(eventId)) {
          this.logger.debug(`Fork-дубликат пропущен (no-op): ${eventId}`);
          return;
        }
        await this.processFork(event.forked_from_block, eventId);
        await this.parserInteractor.markEventApplied(eventId, event.forked_from_block);
        return;
      }
      case 'native-delta':
        return;
      default:
        this.logger.warn(`Неизвестный тип события parser2: ${JSON.stringify(event)}`);
    }
  }

  /**
   * Обработка действия (action) из блокчейна
   * Выполняет минимальную предварительную фильтрацию, сохраняет в базу и
   * с задержкой публикует событие во внутреннюю шину.
   *
   * Порядок writes: сохранение → ACK (по возврату из handleEvent) →
   * отложенный emit события через ACTION_EMIT_DELAY_MS. Задержка нужна
   * чтобы дельты, попавшие в стрим из того же блока что и action, успели
   * пройти обработчики и прописаться в БД ДО того, как обработчики action
   * полезут читать состояние (например, ClearanceManagementInteractor по
   * apprvappndx ищет appendix в capital_appendixes — без задержки гонится
   * с дельтой capital::appendixes того же блока). См. задачу #53.
   *
   * Ошибка saveAction бросается наверх в consume → событие НЕ подтверждается
   * (iterator.throw → parser2 учитывает провал). Emit'ится только сохранённое.
   */
  private async processAction(action: IAction): Promise<void> {
    if (action.receiver != action.account) {
      return;
    }
    this.logger.debug(`Обработка действия: ${action.name} от ${action.account}: ${JSON.stringify(action.data)}`);
    await this.processActionDelayed(action);
  }

  private async processActionDelayed(action: IAction): Promise<void> {
    // Проверяем, является ли действие исключением
    const isException = this.isActionException(action.account, action.name);

    // Если не исключение и нет coopname - пропускаем
    if (!isException && action.data?.coopname !== config.coopname) {
      this.logger.debug(`Skipping action: ${action.account}::${action.name} - wrong coopname`);
      return;
    }

    // Idempotency: признак уникальности события (INV-09). Повторно доставленное
    // событие с уже отмеченным event_id игнорируется как no-op.
    const eventId = computeActionEventId(action);
    if (await this.parserInteractor.isEventApplied(eventId)) {
      this.logger.debug(`Action-дубликат пропущен (no-op): ${eventId}`);
      return;
    }

    try {
      // Сохраняем действие в базу данных через интерактор
      await this.parserInteractor.saveAction(action);
      // Уровень log, а не debug: это единственная строка, по которой на проде
      // видно, что транспорт живой и что именно поймано. Шума не создаёт —
      // сюда доходят только действия, прошедшие фильтры receiver == account
      // (иначе одно действие логировалось бы по разу на каждого нотифицируемого)
      // и coopname == нашего кооператива.
      this.logger.log(
        `Действие поймано: ${action.account}::${action.name} (блок ${action.block_num}, seq ${action.global_sequence})`
      );
    } catch (error: any) {
      this.logger.error(`Не удалось сохранить действие ${action.account}::${action.name}: ${error.message}`, error.stack);
      throw error; // Перебрасываем ошибку чтобы событие не было подтверждено
    }

    // Метка в consumer_dedup ПОСЛЕ save, ДО отложенного emit.
    // block_num пишем для последующего deleteAfterBlock на форке (Story 4.1).
    await this.parserInteractor.markEventApplied(eventId, action.block_num);

    // Публикуем событие с задержкой — пусть сначала прокатятся дельты этого же блока
    // (capital_appendixes, capital_projects, ...), чтобы обработчики action видели
    // уже персистентное состояние. saveAction уже выполнен, так что данные не
    // потеряем; задерживаем только emit. Задержка вынесена в конфиг (DEC-007).
    const eventName = `action::${action.account}::${action.name}`;
    const delayMs = config.blockchain.action_emit_delay_ms;
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
   * Ошибка saveDelta поднимается наверх в consume → событие остаётся pending в
   * consumer-group parser2 (iterator.throw). См. processAction — тот же контракт.
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
    //
    // Исключение — общеплатформенные таблицы: реестр шаблонов документов и их
    // переводы принадлежат не кооперативу, а платформе, и лежат в скоупе самого
    // контракта. По имени кооператива они не проходят никогда, поэтому узел о
    // них не узнал бы вовсе — а без шаблонов не собрать ни один документ.
    if (!isPlatformWideTable(delta.code, delta.table)) {
      const valueCoop = (delta.value as any)?.coopname;
      const valueCoopValid = typeof valueCoop === 'string' && valueCoop.length > 0;
      const deltaCoop = valueCoopValid ? valueCoop : delta.scope;
      if (deltaCoop !== config.coopname) {
        return;
      }
    }

    // Idempotency: признак уникальности события (INV-09).
    const eventId = computeDeltaEventId(delta);
    if (await this.parserInteractor.isEventApplied(eventId)) {
      this.logger.debug(`Дельта-дубликат пропущена (no-op): ${eventId}`);
      return;
    }

    try {
      // Сохраняем дельту в базу данных через интерактор
      await this.parserInteractor.saveDelta(delta);
      // present=false — запись стёрта из он-чейн таблицы (терминальный переход),
      // это стоит видеть отдельно: по логу иначе не отличить правку от удаления.
      this.logger.log(
        `Дельта сохранена: ${delta.code}::${delta.table}#${delta.primary_key} ` +
          `(блок ${delta.block_num}${delta.present === false ? ', удаление' : ''})`
      );
    } catch (error: any) {
      this.logger.error(`Не удалось сохранить дельту ${delta.code}::${delta.table}: ${error.message}`, error.stack);
      throw error; // Перебрасываем ошибку чтобы событие не было подтверждено
    }

    // Метка в consumer_dedup ПОСЛЕ save. Если markApplied упадёт — consume
    // пробросит ошибку, событие останется pending и переиграется (saveDelta
    // идемпотентен через block_num-guard, mark — через ON CONFLICT DO NOTHING).
    // block_num пишем для последующего deleteAfterBlock на форке (Story 4.1).
    await this.parserInteractor.markEventApplied(eventId, delta.block_num);

    // Публикуем событие во внутреннюю шину с типизированным именем
    const eventName = `delta::${delta.code}::${delta.table}`;
    this.eventsService.emit(eventName, delta);

    this.logger.debug(`Дельта опубликована в событийную шину: ${eventName} с primary_key ${delta.primary_key}`);
  }

  /**
   * Обработка форка (fork) из блокчейна (ADR-005).
   *
   * Порядок шагов (контрактный):
   *   1) ForkRegistry.runAll(blockNum) — sequential откат сущностей всех syncer'ов.
   *      Любая ошибка re-throw, parser2 не ACK'нет, повторная доставка пересыграет.
   *   2) consumer_dedup.deleteAfterBlock(blockNum) — очистка дедупа отрезанной ветки.
   *      Делается ПОСЛЕ успешного rollback (иначе при сбое syncer'ов мы потеряем
   *      возможность повторить весь форк по тому же event_id).
   *   3) saveFork(blockNum) — фиксация форка для аудита и future-pool re-submit (Epic 5).
   *
   * INV-T03: к моменту, когда handleEvent resolves и parser2 берёт следующее событие,
   * вся цепочка rollback завершена (sequential XREADGROUP = natural barrier).
   */
  private async processFork(block_num: number, forkEventId?: string | null): Promise<void> {
    this.logger.log(`Обработка форка на блоке ${block_num} (eventId=${forkEventId ?? 'n/a'}): запуск ForkRegistry rollback`);

    // 1. Sequential rollback всех зарегистрированных syncer'ов.
    //    Story 4.4: forkEventId пробрасывается syncer'ам — они кладут его в архив
    //    invalidated_entities для forensic-группировки.
    await this.forkRegistry.runAll(block_num, forkEventId);
    this.logger.debug(`ForkRegistry: rollback завершён для ${this.forkRegistry.size()} syncer(s)`);

    // 2. Очистка consumer_dedup для блоков отрезанной ветки.
    const purged = await this.parserInteractor.deleteDedupAfterBlock(block_num);
    this.logger.debug(`consumer_dedup: удалено ${purged} записей с block_num > ${block_num}`);

    // 3. Фиксация форка для аудита.
    await this.parserInteractor.saveFork({
      chain_id: config.blockchain.id,
      block_num: block_num,
    });
    this.logger.debug(`Форк сохранён в БД на блоке ${block_num}`);

    this.logger.log(`Форк обработан на блоке ${block_num}`);
  }
}
