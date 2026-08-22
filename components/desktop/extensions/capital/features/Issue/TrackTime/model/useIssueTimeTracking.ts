import {
  computed,
  onUnmounted,
  ref,
  toValue,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue';
import { storeToRefs } from 'pinia';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session/model';
import { useTimeEntriesStore } from 'app/extensions/capital/entities/TimeEntries/model';
import type {
  ITimeEntry,
  ITimeEntriesPagination,
  ITimerSession,
} from 'app/extensions/capital/entities/TimeEntries/model/types';

export interface UseIssueTimeTrackingOptions {
  issueHash: MaybeRefOrGetter<string | null | undefined>;
  /** Исполнители задачи (username). `null`/`undefined` — ограничение не проверяем. */
  creators?: MaybeRefOrGetter<string[] | null | undefined>;
  coopname?: MaybeRefOrGetter<string | null | undefined>;
  username?: MaybeRefOrGetter<string | null | undefined>;
  /** Хеш текущего участника — им отделяются «мои» незакоммиченные часы от общих.
   *  Не задан — считаем по всем записям задачи. */
  contributorHash?: MaybeRefOrGetter<string | null | undefined>;
  /** Грузить записи и сессию сразу при инициализации.
   *  Страница задачи — да; чип в строке списка — нет (иначе N запросов на список). */
  immediate?: boolean;
}

type TimeEntriesStore = ReturnType<typeof useTimeEntriesStore>;

function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Живой отсчёт идущей сессии: тикаем раз в секунду, пока таймер не на паузе. */
function useTimerClock(
  session: Ref<ITimerSession | null>,
  activeHere: ComputedRef<boolean>,
  isPaused: ComputedRef<boolean>
) {
  const tickNow = ref(Date.now());
  let tickTimer: ReturnType<typeof setInterval> | null = null;

  const stopTick = () => {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  };

  const syncTick = () => {
    stopTick();
    tickNow.value = Date.now();
    if (!activeHere.value || isPaused.value) return;
    tickTimer = setInterval(() => {
      tickNow.value = Date.now();
    }, 1000);
  };

  const elapsedSeconds = computed(() => {
    if (!activeHere.value || !session.value) return 0;
    const fallback = Math.max(0, Number(session.value.elapsed_seconds) || 0);
    if (session.value.is_paused) return fallback;

    const startedAt = new Date(session.value.started_at || 0).getTime();
    if (!startedAt) return fallback;
    const totalPaused = Number(session.value.total_paused_ms) || 0;
    return Math.max(0, Math.floor((tickNow.value - startedAt - totalPaused) / 1000));
  });

  watch([activeHere, isPaused], () => syncTick());
  onUnmounted(stopTick);

  return {
    elapsedSeconds,
    clockLabel: computed(() => formatClock(elapsedSeconds.value)),
    syncTick,
  };
}

/** Записи учёта времени по одной задаче. */
function useIssueEntries(
  store: TimeEntriesStore,
  issueHash: ComputedRef<string>,
  coopname: ComputedRef<string>
) {
  const entries = ref<ITimeEntriesPagination | null>(null);
  const loading = ref(false);
  const loaded = ref(false);

  const loadEntries = async () => {
    if (!issueHash.value) return;
    loading.value = true;
    try {
      entries.value = await store.loadTimeEntries({
        filter: { coopname: coopname.value, issue_hash: issueHash.value },
        options: { page: 1, limit: 100, sortBy: '_created_at', sortOrder: 'DESC' },
      });
      loaded.value = true;
    } finally {
      loading.value = false;
    }
  };

  const resetEntries = () => {
    entries.value = null;
    loaded.value = false;
  };

  return {
    entries,
    rows: computed<ITimeEntry[]>(() => entries.value?.items ?? []),
    loading,
    loaded,
    loadEntries,
    resetEntries,
  };
}

/** Суммы факта: общая по задаче и «моя» незакоммиченная с живым тиком таймера. */
function useFactTotals(
  rows: ComputedRef<ITimeEntry[]>,
  contributorHash: MaybeRefOrGetter<string | null | undefined>,
  activeHere: ComputedRef<boolean>,
  elapsedSeconds: ComputedRef<number>
) {
  const factHours = computed(() =>
    rows.value.reduce((sum, row) => sum + (Number(row.hours) || 0), 0)
  );

  const pendingFactHours = computed(() => {
    const mine = toValue(contributorHash) || '';
    let sum = 0;
    for (const row of rows.value) {
      if (row.is_committed) continue;
      if (mine && row.contributor_hash && String(row.contributor_hash) !== mine) continue;
      sum += Number(row.hours) || 0;
    }
    if (activeHere.value) sum += elapsedSeconds.value / 3600;
    return sum;
  });

  return {
    factHours,
    pendingFactHours,
    lastEntry: computed<ITimeEntry | null>(() => rows.value[0] ?? null),
  };
}

interface TimerControlsContext {
  store: TimeEntriesStore;
  issueHash: ComputedRef<string>;
  coopname: ComputedRef<string>;
  username: ComputedRef<string>;
  canManage: ComputedRef<boolean>;
  activeHere: ComputedRef<boolean>;
  isPaused: ComputedRef<boolean>;
  syncTick: () => void;
  afterChange: () => Promise<void>;
}

/** Старт / пауза / стоп таймера по этой задаче. */
function useTimerControls(ctx: TimerControlsContext) {
  const timerBusy = ref(false);
  const who = () => ({ coopname: ctx.coopname.value, username: ctx.username.value });

  const run = async (action: () => Promise<unknown>, reloadEntries: boolean) => {
    if (!ctx.canManage.value) return;
    timerBusy.value = true;
    try {
      await action();
      ctx.syncTick();
      if (reloadEntries) await ctx.afterChange();
    } finally {
      timerBusy.value = false;
    }
  };

  const startTimer = () =>
    run(
      () => ctx.store.startTimer({ ...who(), issue_hash: ctx.issueHash.value }),
      true
    );

  const stopTimer = () => run(() => ctx.store.stopTimer(who()), true);

  const toggleTimer = () => (ctx.activeHere.value ? stopTimer() : startTimer());

  const togglePause = () => {
    if (!ctx.activeHere.value) return Promise.resolve();
    return run(
      () =>
        ctx.isPaused.value
          ? ctx.store.resumeTimer(who())
          : ctx.store.pauseTimer(who()),
      false
    );
  };

  return { timerBusy, startTimer, stopTimer, toggleTimer, togglePause };
}

/** Кто мы, к какой задаче относимся и что нам здесь позволено. */
function useIssueTimeContext(
  options: UseIssueTimeTrackingOptions,
  openTimer: Ref<ITimerSession | null>
) {
  const { info } = useSystemStore();
  const session = useSessionStore();

  const issueHash = computed(() => toValue(options.issueHash) || '');
  const coopname = computed(() => toValue(options.coopname) || info.coopname || '');
  const username = computed(() => toValue(options.username) || session.username || '');

  const timerActiveHere = computed(() => {
    const active = openTimer.value?.issue_hash;
    if (!active || !issueHash.value) return false;
    return active.toLowerCase() === issueHash.value.toLowerCase();
  });

  /** Кнопки времени — только исполнителям задачи. Список не задан — не ограничиваем. */
  const canManageTime = computed(() => {
    const creators = toValue(options.creators);
    if (creators == null) return true;
    const me = username.value.toLowerCase();
    if (!me) return false;
    return creators.some((c) => String(c).toLowerCase() === me);
  });

  return {
    issueHash,
    coopname,
    username,
    timerActiveHere,
    /** Таймер участника занят другой задачей — здесь его включить нельзя. */
    timerBusyElsewhere: computed(() => !!openTimer.value && !timerActiveHere.value),
    isPaused: computed(() => !!openTimer.value?.is_paused),
    canManageTime,
  };
}

/** Ручная запись часов по задаче. */
function useWorklogAction(
  store: TimeEntriesStore,
  ctx: {
    issueHash: ComputedRef<string>;
    coopname: ComputedRef<string>;
    username: ComputedRef<string>;
    canManage: ComputedRef<boolean>;
  },
  reloadEntries: () => Promise<void>
) {
  const worklogSaving = ref(false);

  const addWorklog = async (hours: number) => {
    if (!ctx.canManage.value) return;
    worklogSaving.value = true;
    try {
      await store.addWorklog({
        coopname: ctx.coopname.value,
        username: ctx.username.value,
        issue_hash: ctx.issueHash.value,
        hours,
      });
      await reloadEntries();
    } finally {
      worklogSaving.value = false;
    }
  };

  return { worklogSaving, addWorklog };
}

interface LoadersContext {
  issueHash: ComputedRef<string>;
  loaded: Ref<boolean>;
  loadEntries: () => Promise<void>;
  resetEntries: () => void;
  refreshOpenTimer: (force?: boolean) => Promise<void>;
  syncTick: () => void;
  immediate?: boolean;
}

/** Когда именно ходим в сеть: страница — сразу, всплывающий чип — по открытию. */
function useTimeTrackingLoaders(ctx: LoadersContext) {
  /** Ленивое открытие: чип грузит данные только когда его действительно открыли. */
  const ensureLoaded = async () => {
    await Promise.all([
      ctx.loaded.value ? Promise.resolve() : ctx.loadEntries(),
      ctx.refreshOpenTimer(false),
    ]);
  };

  const reload = async () => {
    await Promise.all([ctx.loadEntries(), ctx.refreshOpenTimer(true)]);
  };

  watch(ctx.issueHash, () => {
    ctx.resetEntries();
    if (ctx.immediate) void ctx.loadEntries();
    ctx.syncTick();
  });

  if (ctx.immediate) {
    void ctx.loadEntries();
    void ctx.refreshOpenTimer(false);
  }

  return { ensureLoaded, reload };
}

/** Перечитать общую сессию таймера участника (одну на всё приложение). */
function useOpenTimerRefresher(
  store: TimeEntriesStore,
  coopname: ComputedRef<string>,
  username: ComputedRef<string>,
  syncTick: () => void
) {
  return async (force = true) => {
    if (!username.value || !coopname.value) return;
    try {
      await store.loadOpenTimer(
        { coopname: coopname.value, username: username.value },
        { force }
      );
    } catch {
      // сессия недоступна — считаем, что таймера нет
    }
    syncTick();
  };
}

/**
 * Учёт рабочего времени по одной задаче: список записей, ручное добавление часов
 * и таймер (старт/пауза/стоп) с живым отсчётом.
 *
 * Одна и та же логика нужна и блоку «История рабочего времени» на странице
 * задачи, и всплывающему чипу времени в строке списка — держим её здесь, чтобы
 * состояние таймера не разъезжалось между местами показа.
 */
export function useIssueTimeTracking(options: UseIssueTimeTrackingOptions) {
  const store = useTimeEntriesStore();
  const { openTimer } = storeToRefs(store);

  const ctx = useIssueTimeContext(options, openTimer);
  const { issueHash, coopname, username, timerActiveHere, isPaused, canManageTime } = ctx;

  const clock = useTimerClock(openTimer, timerActiveHere, isPaused);
  const entries = useIssueEntries(store, issueHash, coopname);
  const totals = useFactTotals(
    entries.rows,
    options.contributorHash,
    timerActiveHere,
    clock.elapsedSeconds
  );

  const refreshOpenTimer = useOpenTimerRefresher(
    store,
    coopname,
    username,
    clock.syncTick
  );

  const controls = useTimerControls({
    store,
    issueHash,
    coopname,
    username,
    canManage: canManageTime,
    activeHere: timerActiveHere,
    isPaused,
    syncTick: clock.syncTick,
    afterChange: entries.loadEntries,
  });

  const worklog = useWorklogAction(
    store,
    { issueHash, coopname, username, canManage: canManageTime },
    entries.loadEntries
  );

  const loaders = useTimeTrackingLoaders({
    issueHash,
    loaded: entries.loaded,
    loadEntries: entries.loadEntries,
    resetEntries: entries.resetEntries,
    refreshOpenTimer,
    syncTick: clock.syncTick,
    immediate: options.immediate,
  });

  return {
    ...entries,
    ...clock,
    ...totals,
    ...controls,
    ...worklog,
    ...loaders,
    openTimer,
    timerActiveHere,
    timerBusyElsewhere: ctx.timerBusyElsewhere,
    isPaused,
    canManageTime,
    refreshOpenTimer,
  };
}
