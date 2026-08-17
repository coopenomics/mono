import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { isForkAware, type IForkAwareSyncer } from '@coopenomics/extension-kit/sync';

/**
 * Реестр syncer'ов, откатывающих свои сущности на форке (ADR-005, Story 4.1).
 *
 * Заменяет старый `@OnEvent('fork::*')` broadcast: тот вызывал handler'ы параллельно через
 * `EventEmitter2.emitAsync` + Promise.all, ломая per-aggregate ordering (NFR10) и оставляя
 * гонку «fork-vs-следующая-delta». ForkRegistry обходит syncer'ы строго sequential
 * (for-of await), что в сочетании с single-active XREADGROUP даёт натуральный барьер форка.
 *
 * Сбор syncer'ов — pull-модель через DiscoveryService на onApplicationBootstrap: проходим
 * по всем providers Nest, отбираем по FORK_AWARE_MARKER. Не требует super.onModuleInit() в
 * наследниках (которые свободно переопределяют onModuleInit для собственных подписок).
 *
 * INV-T03: rollback всех syncer'ов завершён до того, как BlockchainConsumerService двинется
 * к следующему событию того же stream'а. Любая ошибка в handleFork пробрасывается наверх —
 * parser2 не ACK'ает форк-событие и повторит доставку; уже отработавшие syncer'ы будут no-op
 * (versions уже подняты), сбойный — переиграет.
 */
@Injectable()
export class ForkRegistryService implements OnApplicationBootstrap {
  private readonly registered = new Set<IForkAwareSyncer>();

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(ForkRegistryService.name);
  }

  async onApplicationBootstrap(): Promise<void> {
    const providers = this.discoveryService.getProviders();
    let scanned = 0;
    for (const wrapper of providers) {
      const instance = wrapper.instance;
      if (isForkAware(instance)) {
        this.register(instance);
        scanned += 1;
      }
    }
    this.logger.log(`ForkRegistry: bootstrap discovered ${scanned} fork-aware syncer(s)`);
  }

  /**
   * Зарегистрировать syncer вручную. Идемпотентно: повторная регистрация — no-op.
   * В рантайме обычно не вызывается напрямую — bootstrap-сканер сам всё подберёт;
   * метод оставлен публичным для тестов и динамических расширений.
   */
  register(syncer: IForkAwareSyncer): void {
    if (this.registered.has(syncer)) return;
    this.registered.add(syncer);
    this.logger.debug(
      `ForkRegistry: registered ${syncer.constructor?.name ?? '<anonymous>'} (total=${this.registered.size})`
    );
  }

  /**
   * Снять syncer с регистрации (для тестов / hot-reload).
   */
  unregister(syncer: IForkAwareSyncer): void {
    if (this.registered.delete(syncer)) {
      this.logger.debug(
        `ForkRegistry: unregistered ${syncer.constructor?.name ?? '<anonymous>'} (total=${this.registered.size})`
      );
    }
  }

  /**
   * Очистить реестр (для тестов). В рантайме не вызывается.
   */
  clear(): void {
    this.registered.clear();
  }

  /**
   * Текущее число зарегистрированных syncer'ов. Для логов / health-check'ов / тестов.
   */
  size(): number {
    return this.registered.size;
  }

  /**
   * Sequential rollback всех зарегистрированных syncer'ов. Re-throw первой ошибки —
   * BlockchainConsumerService прервёт processFork, parser2 не ACK'нет, форк переиграется.
   *
   * Порядок: сначала syncer'ы с заданным `forkRollbackPriority` (по возрастанию),
   * затем — без приоритета (в порядке обхода Discovery, что обычно соответствует DI-графу).
   *
   * Story 4.4: `forkEventId` пробрасывается в каждый syncer.handleFork — syncer кладёт
   * его в архив invalidated_entities для группировки по форкам.
   */
  async runAll(forkBlockNum: number, forkEventId?: string | null): Promise<void> {
    const ordered = this.orderedForRollback();
    this.logger.debug(
      `ForkRegistry: runAll(blockNum=${forkBlockNum}, eventId=${forkEventId ?? 'n/a'}) — ${ordered.length} syncer(s)`
    );
    for (const syncer of ordered) {
      await syncer.handleFork(forkBlockNum, forkEventId);
    }
  }

  private orderedForRollback(): IForkAwareSyncer[] {
    const withPriority: IForkAwareSyncer[] = [];
    const withoutPriority: IForkAwareSyncer[] = [];
    for (const syncer of this.registered) {
      if (typeof syncer.forkRollbackPriority === 'number') withPriority.push(syncer);
      else withoutPriority.push(syncer);
    }
    withPriority.sort((a, b) => (a.forkRollbackPriority as number) - (b.forkRollbackPriority as number));
    return [...withPriority, ...withoutPriority];
  }
}
