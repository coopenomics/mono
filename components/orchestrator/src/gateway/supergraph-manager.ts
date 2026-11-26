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
  /**
   * Какая часть схемы — ядро: без неё шлюз схему не строит. Остальные части —
   * приложения каталога, недоступное приложение из схемы исключается.
   * По умолчанию ядро — запись с именем `core` или `core-…`.
   */
  isCore?: (subgraph: SubgraphDescriptor) => boolean;
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
  /**
   * Пересобрать схему, даже если состав реестра прежний. Обновление версии
   * приложения меняет его схему, а имя и адрес остаются теми же — отпечаток
   * реестра этого не видит, и шлюз отдавал схему прежней версии (25.11.2026).
   */
  forceRecompose(): Promise<void>;
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
  /** Исключённые при последней сборке приложения — чтобы не повторять предупреждение каждый такт. */
  let lastExcluded = '';

  const fingerprintOf = (subgraphs: ReadonlyArray<SubgraphDescriptor>): string =>
    subgraphs
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => `${s.name}:${s.url}`)
      .join('|');

  const isCore = opts.isCore ?? ((s: SubgraphDescriptor) => s.name === 'core' || s.name.startsWith('core-'));

  /**
   * Собрать схему, пережив недоступное приложение.
   *
   * Приложение каталога — чужой контейнер: он мог не подняться, упасть или
   * быть снят мимо оркестратора. До 26.11.2026 одна такая запись реестра
   * роняла сборку целиком: оркестратор не стартовал, перезапускался по кругу
   * и поэтому не мог ни переустановить это приложение, ни отдавать схему
   * остальных. Теперь приложение, с которым сборщик схему не строит, исключается;
   * в `included` — то, что вошло. Без ядра сборки по-прежнему нет.
   */
  const composeTolerant = async (
    subgraphs: ReadonlyArray<SubgraphDescriptor>,
  ): Promise<{ sdl: string; included: SubgraphDescriptor[] }> => {
    try {
      const sdl = await opts.composer.compose(subgraphs);
      if (lastExcluded) {
        logger.log('все приложения реестра снова в схеме');
        lastExcluded = '';
      }
      return { sdl, included: subgraphs.slice() };
    } catch (first) {
      const core = subgraphs.filter(isCore);
      const apps = subgraphs.filter((s) => !isCore(s));
      if (apps.length === 0) throw first;
      const kept: SubgraphDescriptor[] = [];
      const excluded: string[] = [];
      for (const app of apps) {
        try {
          await opts.composer.compose([...core, app]);
          kept.push(app);
        } catch (e) {
          excluded.push(`${app.name} (${e instanceof Error ? e.message : String(e)})`);
        }
      }
      // Одно сообщение на смену состава: приложение может лежать сутками, а
      // сборка повторяется каждый такт.
      const names = excluded.join('; ');
      if (names !== lastExcluded) {
        lastExcluded = names;
        if (names) logger.warn(`приложения исключены из схемы: ${names}`);
      }
      const included = [...core, ...kept];
      // Сборщик не строит схему и без приложений — виновато ядро, отказ прежний.
      return { sdl: await opts.composer.compose(included), included };
    }
  };

  const composeOnce = async (): Promise<string> => {
    const subgraphs = await opts.registry.listForCompose();
    const { sdl, included } = await composeTolerant(subgraphs);
    lastFingerprint = fingerprintOf(included);
    return sdl;
  };

  const initialSdl = await composeOnce();

  const refreshIfChanged = async (): Promise<boolean> => {
    const subgraphs = await opts.registry.listForCompose();
    // Отпечаток — того, что вошло в схему. Пока приложение исключено, он
    // расходится с реестром, и каждый такт пробует собрать схему с ним снова.
    if (fingerprintOf(subgraphs) === lastFingerprint) return false;
    const { sdl, included } = await composeTolerant(subgraphs);
    const fp = fingerprintOf(included);
    // Состав прежний (исключённое приложение так и не ответило) — схему не трогаем.
    if (fp === lastFingerprint) return false;
    logger.log(`supergraph registry changed (was ${lastFingerprint.split('|').length} subgraphs, now ${fp.split('|').length}) — recompose`);
    // ВАЖНО: fingerprint обновляем только ПОСЛЕ успешного compose.
    // Иначе при exception в composer'е следующий tick посчитает,
    // что состояние уже актуально (fp === lastFingerprint) и пропустит
    // retry — supergraph навсегда останется в устаревшем состоянии.
    lastFingerprint = fp;
    update(sdl);
    return true;
  };

  const forceRecompose = async (): Promise<void> => {
    const subgraphs = await opts.registry.listForCompose();
    const { sdl, included } = await composeTolerant(subgraphs);
    lastFingerprint = fingerprintOf(included);
    update(sdl);
    logger.log(`supergraph пересобран принудительно (${included.length} subgraphs)`);
  };

  const timer = setInterval(() => {
    void refreshIfChanged().catch((e) => {
      logger.error(`recompose tick failed: ${e instanceof Error ? e.message : String(e)}`);
    });
  }, opts.pollIntervalMs);

  return {
    initialSdl,
    forceRefresh: refreshIfChanged,
    forceRecompose,
    cleanup: async () => {
      clearInterval(timer);
    },
  };
}
