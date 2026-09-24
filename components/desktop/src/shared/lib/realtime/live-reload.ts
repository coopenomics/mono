import { onMounted, onUnmounted } from 'vue';

/**
 * Живое обновление экрана по ленте изменений цепи (`chainChanges`).
 *
 * Экран, который загружает данные при открытии, объявляет, из каких таблиц
 * цепи они собраны, — и перечитывает их, когда узел сообщает, что там
 * изменилась строка. Сигнал приходит, когда изменение уже в базе узла, поэтому
 * запрос по нему читает новое. Подписка на всё приложение одна
 * (`core:chain-changes`), экраны лишь подключаются к ней на время открытия.
 *
 * Двойное обновление после мутации — норма: ответ мутации приходит после
 * разбора блока, а сигнал того же блока — около того же момента. Перечитывание
 * одно в полёте, повторы за время полёта сливаются в одно хвостовое, а
 * соседние сигналы одного блока собираются короткой задержкой.
 */

/** Таблица цепи: контракт и имя таблицы. */
export interface ChainTableRef {
  code: string;
  table: string;
}

/** Сигнал ленты — где и в каком блоке изменилась строка. */
export interface ChainChangeSignal {
  code: string;
  table: string;
  scope: string;
  primary_key: string;
  /** Блок изменения; 0 — данные узла вне цепи. */
  block_num: number;
}

/**
 * Ссылка на таблицу цепи по описанию контракта из cooptypes:
 * `liveTable(Ledger2Contract, Ledger2Contract.Tables.UserWallets)`.
 * Таблица базы узла — `{ code: <расширение>, table: <имя из @Entity> }`.
 */
export function liveTable(
  contract: { contractName: { production: string } },
  table: { tableName: string },
): ChainTableRef {
  return { code: contract.contractName.production, table: table.tableName };
}

export interface LiveReloadOptions {
  /** Сколько собирать соседние сигналы перед перечитыванием, мс. */
  debounceMs?: number;
}

export interface LiveReloadHandle {
  /**
   * Перечитать сейчас — через тот же одиночный полёт. Экран зовёт его после
   * своей мутации вместо прямого вызова загрузки: если сигнал уже запустил
   * перечитывание, второе к нему присоединится, а не пойдёт параллельно.
   */
  refresh(): Promise<void>;
}

interface LiveConsumer {
  keys: Set<string>;
  onChange(signal: ChainChangeSignal): void;
  onResync(reason: string, channelAlive: boolean): void;
}

const DEFAULT_DEBOUNCE_MS = 150;
/** Страховочная дочитка канала: при живом канале экранам она не нужна. */
// i18n-ignore: служебная метка причины дочитки, сравнивается в коде (includes), до пайщика не доходит
const SAFETY_REASON = 'страховка';

const consumers = new Set<LiveConsumer>();

const keyOf = (code: string, table: string) => `${code}::${table}`;

/** Подписка ядра кладёт сюда каждый сигнал ленты. */
export function dispatchChainChange(signal: ChainChangeSignal): void {
  const key = keyOf(signal.code, signal.table);
  for (const consumer of consumers) {
    if (consumer.keys.has(key)) consumer.onChange(signal);
  }
}

/**
 * Дочитка после переподключения, возврата вкладки или по страховке канала.
 * Страховка при живом канале экраны не трогает — иначе это был бы опрос раз в
 * минуту на каждом открытом экране.
 */
export function resyncLiveConsumers(reason: string, channelAlive: boolean): void {
  for (const consumer of consumers) consumer.onResync(reason, channelAlive);
}

/** Таблицы, которые сейчас слушает хоть один экран, — для наблюдения. */
export function liveTablesInUse(): string[] {
  const keys = new Set<string>();
  consumers.forEach((c) => c.keys.forEach((k) => keys.add(k)));
  return [...keys];
}

/**
 * Перечитывание одним полётом: вызов во время полёта не запускает второй
 * запрос, а заказывает одно хвостовое перечитывание после текущего.
 * `covers` — блок, который покроет запрос, стартовавший сейчас.
 */
function singleFlight(reload: () => unknown, covers: () => number, onDone: (block: number) => void) {
  let inFlight: Promise<void> | null = null;
  let again = false;

  const run = (): Promise<void> => {
    if (inFlight) {
      again = true;
      return inFlight;
    }
    const block = covers();
    inFlight = (async () => {
      try {
        await reload();
        onDone(block);
      } catch (error) {
        console.warn('[live-reload] перечитывание не удалось — повторит следующий сигнал', error);
      } finally {
        inFlight = null;
        if (again) {
          again = false;
          void run();
        }
      }
    })();
    return inFlight;
  };
  return run;
}

/**
 * Подключить потребителя вне компонента (стор, процесс). Возвращает функцию
 * снятия. В компонентах — `useLiveReload`.
 */
export function registerLiveReload(
  tables: ChainTableRef[],
  reload: () => unknown,
  options?: LiveReloadOptions,
): LiveReloadHandle & { dispose: () => void } {
  const debounceMs = options?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;
  // Блок, данные которого уже прочитаны завершённым перечитыванием.
  let freshThrough = 0;
  // Самый поздний блок из сигналов, на которые уже запланировано перечитывание.
  let signalled = 0;

  const run = singleFlight(
    reload,
    () => signalled,
    (block) => {
      if (block > freshThrough) freshThrough = block;
    },
  );

  const schedule = () => {
    if (timer) return;
    // timing: debounce — соседние сигналы одного блока перечитываются одним запросом.
    timer = setTimeout(() => {
      timer = null;
      void run();
    }, debounceMs);
  };

  const consumer: LiveConsumer = {
    keys: new Set(tables.map((t) => keyOf(t.code, t.table))),
    onChange(signal) {
      // Сигнал блока, который уже прочитан, нового не принесёт. Изменения
      // базы узла вне цепи блока не имеют (0) и сравнению не подлежат.
      if (signal.block_num > 0 && signal.block_num < freshThrough) return;
      if (signal.block_num > signalled) signalled = signal.block_num;
      schedule();
    },
    onResync(reason, channelAlive) {
      if (channelAlive && reason.includes(SAFETY_REASON)) return;
      schedule();
    },
  };
  consumers.add(consumer);

  return {
    refresh: run,
    dispose() {
      consumers.delete(consumer);
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

/**
 * Живое обновление экрана: пока компонент открыт, изменения в `tables`
 * перечитываются через `reload`. Загрузку при открытии экран делает сам, как
 * раньше, — здесь только реакция на изменения.
 *
 * ```ts
 * const live = useLiveReload(
 *   [liveTable(Ledger2Contract, Ledger2Contract.Tables.UserWallets)],
 *   () => walletStore.loadUserWallet({ coopname, username }),
 * );
 * // после своей мутации: await live.refresh()
 * ```
 */
export function useLiveReload(
  tables: ChainTableRef[],
  reload: () => unknown,
  options?: LiveReloadOptions,
): LiveReloadHandle {
  let handle: (LiveReloadHandle & { dispose: () => void }) | null = null;
  onMounted(() => {
    handle = registerLiveReload(tables, reload, options);
  });
  onUnmounted(() => {
    handle?.dispose();
    handle = null;
  });
  return {
    refresh: () => (handle ? handle.refresh() : Promise.resolve(reload()).then(() => undefined)),
  };
}
