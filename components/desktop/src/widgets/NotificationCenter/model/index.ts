import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { NotificationItem } from 'src/shared/ui/domain/NotificationCenter';
import { useSystemStore } from 'src/entities/System/model';
import { NotifyAlert } from 'src/shared/api';
import { api } from '../api';
import { categoryFromWorkflowId, type IInboxNotification } from './types';

export * from './types';

const namespace = 'notification-inbox';
const PAGE_LIMIT = 20;
/** Интервал поллинга непрочитанных. Live-подписки в репо нет — обновляем опросом. */
const POLL_INTERVAL_MS = 30_000;

/**
 * Тело уведомления шарится с email/push-шаблонами и несёт HTML (`<br>`, теги).
 * In-app панель рендерит описание как ТЕКСТ (без v-html — payload содержит
 * ФИО/заголовки = XSS-вектор), а перенос строки ждёт как `\n`
 * (CSS `white-space: pre-line`). Поэтому приводим HTML к плоскому тексту.
 */
function plainText(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

/**
 * Deep-link уведомления — внутренний маршрут, куда ведёт нажатие. Уведомления
 * безопасности («вход с нового устройства») несут в payload `securityUrl` — по
 * этому маркеру ведём на страницу настроек: там карточка активных сессий с
 * кнопками завершения. Абсолютный URL из payload не используем — навигация
 * внутри приложения идёт роутером, а не перезагрузкой.
 */
function linkFromNotification(n: IInboxNotification, coopname: string): string | undefined {
  const p = (n.payload ?? null) as Record<string, unknown> | null;
  if (p && typeof p.securityUrl === 'string' && p.securityUrl) return `/${coopname}/user/settings`;
  return undefined;
}

function toItem(n: IInboxNotification, coopname: string): NotificationItem {
  return {
    id: n.id,
    category: categoryFromWorkflowId(n.workflowId),
    title: plainText(n.title),
    description: plainText(n.body),
    date: n.createdAt as string,
    read: n.isRead,
    link: linkFromNotification(n, coopname),
  };
}

export const useNotificationInboxStore = defineStore(namespace, () => {
  const notifications = ref<IInboxNotification[]>([]);
  const unreadCount = ref(0);
  const loading = ref(false);
  const currentPage = ref(1);
  const totalPages = ref(1);

  let pollTimer: ReturnType<typeof setInterval> | null = null;
  /**
   * Первый опрос после загрузки страницы задаёт БАЗУ счётчика, а не «прирост».
   * Без этого флага любое накопленное непрочитанное выглядело как «пришло
   * только что» (0 → N) и всплывало тостом при каждом открытии приложения.
   * Тостим только то, что реально пришло за время этой сессии.
   */
  let primed = false;

  const items = computed<NotificationItem[]>(() =>
    notifications.value.map((n) => toItem(n, coopname())),
  );
  const hasMore = computed(() => currentPage.value < totalPages.value);

  function coopname(): string {
    return useSystemStore().info.coopname;
  }

  async function loadInbox(reset = true): Promise<void> {
    const page = reset ? 1 : currentPage.value + 1;
    loading.value = true;
    try {
      const result = await api.loadInbox({
        coopname: coopname(),
        pagination: { page, limit: PAGE_LIMIT, sortOrder: 'DESC' },
      });
      notifications.value = reset ? result.items : [...notifications.value, ...result.items];
      currentPage.value = result.currentPage;
      totalPages.value = result.totalPages;
    } finally {
      loading.value = false;
    }
  }

  async function loadMore(): Promise<void> {
    if (hasMore.value && !loading.value) await loadInbox(false);
  }

  async function refreshUnreadCount(): Promise<void> {
    const next = await api.loadUnreadCount(coopname());
    // Прирост непрочитанных между опросами = пришло новое: тостим и подтягиваем ленту.
    // На ПЕРВОМ опросе прироста нет по определению — только фиксируем базу.
    const grew = primed && next > unreadCount.value;
    unreadCount.value = next;
    primed = true;
    if (!grew) return;

    await loadInbox(true);
    const newest = notifications.value.find((n) => !n.isRead);
    // Тело шарится с email-шаблонами и несёт HTML — тост рендерит текстом,
    // поэтому прогоняем через тот же plainText, что и лента (см. toItem).
    if (newest) {
      const link = linkFromNotification(newest, coopname());
      NotifyAlert(
        plainText(newest.title),
        plainText(newest.body),
        undefined,
        // Тост должен не только сообщать, но и вести к действию: у уведомлений
        // безопасности — сразу к активным сессиям. Роутер в сторе недоступен,
        // а маршрутизация hash-режимная — переходим сменой hash.
        link ? { label: 'Открыть', handler: () => { window.location.hash = `#${link}`; } } : undefined,
      );
    }
  }

  async function markRead(id: string): Promise<void> {
    const target = notifications.value.find((n) => n.id === id);
    if (!target || target.isRead) return;
    target.isRead = true;
    unreadCount.value = Math.max(0, unreadCount.value - 1);
    try {
      await api.markRead(id);
    } catch (e) {
      // Откат оптимистичной отметки при ошибке.
      target.isRead = false;
      unreadCount.value += 1;
      throw e;
    }
  }

  async function markAllRead(): Promise<void> {
    const previous = notifications.value.map((n) => n.isRead);
    notifications.value.forEach((n) => (n.isRead = true));
    unreadCount.value = 0;
    try {
      await api.markAllRead(coopname());
    } catch (e) {
      notifications.value.forEach((n, i) => (n.isRead = previous[i]));
      await refreshUnreadCount();
      throw e;
    }
  }

  function startPolling(): void {
    if (pollTimer) return;
    void refreshUnreadCount();
    pollTimer = setInterval(() => void refreshUnreadCount(), POLL_INTERVAL_MS);
  }

  function stopPolling(): void {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  return {
    notifications,
    unreadCount,
    loading,
    items,
    hasMore,
    loadInbox,
    loadMore,
    refreshUnreadCount,
    markRead,
    markAllRead,
    startPolling,
    stopPolling,
  };
});
