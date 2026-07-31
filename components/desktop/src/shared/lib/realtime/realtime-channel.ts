import { watch } from 'vue';
import { useGlobalStore } from 'src/shared/store';

/**
 * Универсальный realtime-канал ядра (фабрика, как реестр глобальных оверлеев).
 *
 * Ядро НЕ знает про конкретные расширения: оно лишь управляет жизненным циклом
 * подписок (открыть при авторизации, закрыть при выходе) и триггерит дочитку
 * состояния (catch-up) при возврате приложения в активность и по страховочному
 * таймеру. Расширение в своём install.ts регистрирует собственную подписку
 * через `registerRealtimeSubscription` — так же, как оверлеи и роуты.
 *
 * Принцип додоставки: подписка эфемерна (свернул приложение → ws рвётся,
 * события НЕ копятся). Источник правды — авторитетный query (`resync`), который
 * дёргается при (ре)коннекте, возврате вкладки и по страховке. Поэтому
 * пропущенные сигналы не теряются: при возврате к активности перечитываем
 * текущее состояние из БД, а не реплеим события.
 */

export interface RealtimeHandle {
  close: () => void;
}

export interface RealtimeSubscription {
  /** Уникальный id подписки (идемпотентность реестра). */
  id: string;
  /**
   * Открыть ws-подписку. Внутри расширение само разбирает входящие события и
   * вешает catch-up на (ре)коннект (через `open`-колбэк Zeus). Возвращает
   * хэндл с `close()`.
   */
  open: () => RealtimeHandle;
  /**
   * Дочитать авторитетное состояние (catch-up): на возврат активности/страховку.
   * `reason` — человекочитаемый источник дочитки для лога (страховка/возврат вкладки).
   */
  resync: (reason?: string) => void | Promise<void>;
}

const subscriptions = new Map<string, RealtimeSubscription>();
const handles = new Map<string, RealtimeHandle>();
let installed = false;

const SAFETY_RESYNC_MS = 60_000;
/** Схлопывает visibility + страховку + чужие вызовы в один catch-up. */
const RESYNC_DEBOUNCE_MS = 1_500;
let resyncTimer: ReturnType<typeof setTimeout> | null = null;

function isAuthed(): boolean {
  return Boolean(useGlobalStore().wif);
}

function isForeground(): boolean {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden';
}

function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function openSub(sub: RealtimeSubscription): void {
  if (handles.has(sub.id)) return;
  try {
    handles.set(sub.id, sub.open());
  } catch (e) {
    console.error('[realtime] не удалось открыть подписку', sub.id, e);
  }
}

function closeSub(id: string): void {
  const handle = handles.get(id);
  if (!handle) return;
  try {
    handle.close();
  } catch {
    /* закрытие уже разорванного сокета — не критично */
  }
  handles.delete(id);
}

function openAll(): void {
  subscriptions.forEach(openSub);
}

function closeAll(): void {
  if (resyncTimer) {
    clearTimeout(resyncTimer);
    resyncTimer = null;
  }
  [...handles.keys()].forEach(closeSub);
}

function resyncActive(reason: string): void {
  if (!isAuthed() || !isForeground()) return;
  // Мёртвая сеть / рестарт бэкенда без сети — не плодим HTTP catch-up.
  if (isBrowserOffline()) return;

  if (resyncTimer) clearTimeout(resyncTimer);
  resyncTimer = setTimeout(() => {
    resyncTimer = null;
    if (!isAuthed() || !isForeground() || isBrowserOffline()) return;
    subscriptions.forEach((sub) => {
      if (handles.has(sub.id)) void sub.resync(reason);
    });
  }, RESYNC_DEBOUNCE_MS);
}

/**
 * Зарегистрировать подписку расширения. Если канал уже запущен и пайщик
 * авторизован — подписка поднимается немедленно (порядок init расширений и
 * старта канала не важен).
 */
export function registerRealtimeSubscription(sub: RealtimeSubscription): void {
  if (subscriptions.has(sub.id)) return;
  subscriptions.set(sub.id, sub);
  if (installed && isAuthed()) openSub(sub);
}

/**
 * Запустить канал (идемпотентно). Вызывается один раз из App-уровня. Открывает
 * подписки по факту авторизации и навешивает catch-up на возврат активности +
 * страховочный таймер от «зомби-сокета».
 */
export function startRealtimeChannel(): void {
  // Канал чисто клиентский (ws + таймеры). На сервере SSR App.setup тоже
  // исполняется — там стартовать нечего.
  if (typeof window === 'undefined') return;
  if (installed) return;
  installed = true;

  // Авто-открытие/закрытие по состоянию авторизации.
  watch(
    () => isAuthed(),
    (authed) => {
      if (authed) openAll();
      else closeAll();
    },
    { immediate: true },
  );

  // Возврат вкладки/приложения в активность → немедленная дочитка состояния.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') resyncActive('POLL (возврат вкладки)');
    });
  }

  // Страховка от зомби-сокета (ws «жив», но публикацию пропустил). Это НЕ
  // возврат к частому поллингу — при здоровом канале дочитка ничего не меняет.
  setInterval(() => resyncActive('POLL (страховка 60с)'), SAFETY_RESYNC_MS);
}
