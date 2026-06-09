/**
 * @fileoverview Custom SupergraphManager — Story 10.3b.
 *
 * Apollo Gateway по умолчанию через `IntrospectAndCompose` принимает
 * СТАТИЧЕСКИЙ список subgraph'ов на bootstrap'е. Polling-режим
 * подхватывает изменения СХЕМЫ у уже известных subgraph'ов, но НЕ
 * замечает появление НОВЫХ записей в registry — для них требуется
 * рестарт контейнера.
 *
 * Story 10.4 install pipeline пишет новые subgraph'ы в registry без
 * рестарта; чтобы gateway их видел, нужен SupergraphManager, который
 * на каждый tick re-читает registry, и если список (по `(name,url)`)
 * изменился — пересобирает supergraph и вызывает `update(newSdl)`.
 *
 * Apollo Gateway это поддерживает: `gateway: { supergraphSdl: fn }`,
 * где fn возвращает `{ supergraphSdl, cleanup }` и получает callback
 * `update`. См. https://www.apollographql.com/docs/federation/v2/api/apollo-gateway/#supergraphsdl
 *
 * Этот файл — переиспользуемый менеджер, отделённый от Apollo Gateway
 * API (его hook-fn в `gateway.module.ts` собирает менеджер и
 * передаёт в gateway). Сам менеджер не знает про gateway — он
 * работает с двумя портами: regsitry (читать список) и
 * supergraphComposer (собрать SDL из subgraph descriptors).
 */
import { Logger } from '@nestjs/common';
import type { SubgraphDescriptor } from './subgraph-registry.service';

/**
 * Порт композитора supergraph'а. Реальный impl делает introspection
 * subgraph URL'ов и compose через `@apollo/composition`. Тестовый
 * возвращает заранее заданный SDL.
 */
export interface SupergraphComposerPort {
  compose(subgraphs: ReadonlyArray<SubgraphDescriptor>): Promise<string>;
}

/**
 * Минимальный API регистра, который нужен менеджеру.
 * Преднамеренно ужe, чем весь `SubgraphRegistryService` — менеджер
 * вообще не должен знать про писать/изменять записи.
 */
export interface SupergraphRegistryReader {
  listForCompose(): Promise<SubgraphDescriptor[]>;
}

export interface SupergraphManagerOptions {
  composer: SupergraphComposerPort;
  registry: SupergraphRegistryReader;
  /** Интервал опроса registry. Должен совпадать с polling'ом IntrospectAndCompose. */
  pollIntervalMs: number;
}

export interface SupergraphManagerLifecycle {
  /** Начальный SDL для отдачи gateway'ю на bootstrap'е. */
  initialSdl: string;
  /**
   * Немедленный recompose вне расписания (POST /v1/internal/composition/refresh).
   * Возвращает `true`, если registry изменился и supergraph пересобран,
   * `false` — если состояние актуально. Ошибки composer'а пробрасываются.
   */
  forceRefresh(): Promise<boolean>;
  /** Освободить таймер — gateway вызовет при shutdown'е. */
  cleanup(): Promise<void>;
}

/**
 * Создаёт менеджер supergraph'а с динамическим refresh'ем по registry.
 *
 *  1. Делает первый compose(registry.listForCompose()) → возвращает
 *     `initialSdl` и сохраняет «текущее состояние» (отпечаток списка).
 *  2. Запускает setInterval, который на каждый tick читает registry;
 *     если отпечаток списка отличается от текущего — recompose и
 *     вызов `update(newSdl)`.
 *  3. `cleanup()` останавливает таймер.
 *
 * Идемпотентность: если registry вернул тот же список (по name+url) —
 * compose НЕ вызывается, экономим CPU и сеть (introspection).
 */
export async function createDynamicSupergraphManager(
  opts: SupergraphManagerOptions,
  update: (sdl: string) => void,
): Promise<SupergraphManagerLifecycle> {
  const logger = new Logger('DynamicSupergraphManager');
  let lastFingerprint = '';

  const fingerprintOf = (subgraphs: ReadonlyArray<SubgraphDescriptor>): string =>
    subgraphs
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => `${s.name}:${s.url}`)
      .join('|');

  const composeOnce = async (): Promise<string> => {
    const subgraphs = await opts.registry.listForCompose();
    const fp = fingerprintOf(subgraphs);
    lastFingerprint = fp;
    return opts.composer.compose(subgraphs);
  };

  const initialSdl = await composeOnce();

  const refreshIfChanged = async (): Promise<boolean> => {
    const subgraphs = await opts.registry.listForCompose();
    const fp = fingerprintOf(subgraphs);
    if (fp === lastFingerprint) return false;
    logger.log(`supergraph registry changed (was ${lastFingerprint.split('|').length} subgraphs, now ${fp.split('|').length}) — recompose`);
    // ВАЖНО: fingerprint обновляем только ПОСЛЕ успешного compose.
    // Иначе при exception в composer'е следующий tick посчитает,
    // что состояние уже актуально (fp === lastFingerprint) и пропустит
    // retry — supergraph навсегда останется в устаревшем состоянии.
    const sdl = await opts.composer.compose(subgraphs);
    lastFingerprint = fp;
    update(sdl);
    return true;
  };

  const timer = setInterval(() => {
    void refreshIfChanged().catch((e) => {
      logger.error(`recompose tick failed: ${e instanceof Error ? e.message : String(e)}`);
    });
  }, opts.pollIntervalMs);

  return {
    initialSdl,
    forceRefresh: refreshIfChanged,
    cleanup: async () => {
      clearInterval(timer);
    },
  };
}
