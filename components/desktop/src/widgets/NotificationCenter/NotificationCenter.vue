<template lang="pug">
.notification-bell
  button.icon-btn(type='button', aria-label='Уведомления')
    q-icon(name='notifications')
    BaseBadge.notification-bell__count(
      v-if='store.unreadCount',
      variant='accent'
    ) {{ badgeLabel }}
    q-menu(
      class='notification-center-menu',
      anchor='bottom right',
      self='top right',
      :offset='[0, 8]',
      @show='onOpen'
    )
      .notification-bell__menu
        NotificationPanel(
          :notifications='store.items',
          :loading='store.loading',
          :show-view-all='false',
          @open='onOpenNotification',
          @mark-all-read='onMarkAllRead'
        )
        //- Управление push-подпиской ЭТОГО устройства. Колокольчик —
        //- единственное место, куда это логично встаёт (отдельной страницы
        //- управления устройствами пока нет). Strip показываем ТОЛЬКО когда
        //- SW реально активен (hasServiceWorker) — иначе кнопка кликалась бы
        //- вхолостую («Service Worker не активен»). В dev/без-PWA не рисуем
        //- ничего (не путать с «браузер не поддерживает»).
        .push-strip(v-if='session.isAuth && pushSupport.isSupported && hasServiceWorker')
          .push-strip__status
            q-icon.push-strip__icon(
              :name='pushStatusIcon',
              :class='pushStatusClass',
              size='18px'
            )
            span.push-strip__text {{ pushStatusText }}
          BaseButton.push-strip__action(
            v-if='pushSupport.permission !== "denied"',
            :variant='isThisDeviceSubscribed ? "ghost" : "primary"',
            size='sm',
            :loading='isProcessing',
            @click='onPushAction'
          ) {{ isThisDeviceSubscribed ? 'Переподписать' : 'Включить на устройстве' }}
        .push-strip(v-else-if='session.isAuth && !pushSupport.isSupported')
          .push-strip__status
            q-icon.push-strip__icon(name='notifications_off', size='18px')
            span.push-strip__text Браузер не поддерживает push-уведомления
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue';
import { BaseBadge } from 'src/shared/ui/base/BaseBadge';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { NotificationCenter as NotificationPanel } from 'src/shared/ui/domain/NotificationCenter';
import { useWebPushNotifications } from 'src/features/WebPushNotifications';
import { useSessionStore } from 'src/entities/Session';
import { useNotificationInboxStore } from './model';

const store = useNotificationInboxStore();
const session = useSessionStore();
const push = useWebPushNotifications();

// Локальные алиасы: вложенные под push.* ref'ы в шаблоне не авто-разворачиваются.
const pushSupport = computed(() => push.support.value);
const hasServiceWorker = computed(() => push.hasActiveServiceWorker.value);
const isThisDeviceSubscribed = computed(() => push.isThisDeviceSubscribed.value);
const isProcessing = computed(() => push.isProcessing.value);

const badgeLabel = computed(() => (store.unreadCount > 99 ? '99+' : String(store.unreadCount)));

const pushStatusText = computed(() => {
  if (pushSupport.value.permission === 'denied') {
    return 'Уведомления заблокированы в браузере';
  }
  return isThisDeviceSubscribed.value
    ? 'Push включён на этом устройстве'
    : 'Push не включён на этом устройстве';
});

const pushStatusIcon = computed(() => {
  if (pushSupport.value.permission === 'denied') return 'notifications_off';
  return isThisDeviceSubscribed.value ? 'notifications_active' : 'notifications_none';
});

const pushStatusClass = computed(() => ({
  'push-strip__icon--ok': isThisDeviceSubscribed.value && pushSupport.value.permission !== 'denied',
  'push-strip__icon--warn': pushSupport.value.permission === 'denied',
}));

function onOpen(): void {
  void store.loadInbox(true);
  // Освежаем состояние подписки этого устройства при каждом открытии.
  void push.loadUserSubscriptions().then(() => push.refreshDeviceState());
}

function onOpenNotification(id: string): void {
  void store.markRead(id);
}

function onMarkAllRead(): void {
  void store.markAllRead();
}

async function onPushAction(): Promise<void> {
  if (isThisDeviceSubscribed.value) {
    await push.resubscribe();
  } else {
    await push.subscribe();
  }
  await push.refreshDeviceState();
}

onMounted(() => {
  if (process.env.CLIENT) store.startPolling();
});

onBeforeUnmount(() => {
  store.stopPolling();
});
</script>

<style scoped>
.notification-bell {
  position: relative;
  display: inline-flex;
  align-items: center;
}

/* Бейдж вытолкнут за верхне-правый угол кнопки (translate), чтобы не
   «наезжал» на глиф колокола (.icon-btn 32px, глиф 16px по центру). */
.notification-bell__count {
  position: absolute;
  top: 0;
  right: 0;
  transform: translate(45%, -45%);
  pointer-events: none;
}

.notification-bell__menu {
  display: flex;
  flex-direction: column;
}

/* Полоса управления push-подпиской под списком уведомлений. */
.push-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap;
  gap: var(--p-2, 8px);
  padding: var(--p-3, 12px) var(--p-4, 16px);
  border-top: 1px solid var(--p-line);
  background: var(--p-surface);
}

.push-strip__status {
  display: inline-flex;
  align-items: center;
  gap: var(--p-2, 8px);
  min-width: 0;
  flex: 1 1 auto;
}

/* Кнопка не сжимается и не переносит подпись (на узких экранах «Включить на
   устройстве» ломалось на 2 строки и распирало полосу). */
.push-strip__action {
  flex: 0 0 auto;
  white-space: nowrap;
}

.push-strip__icon {
  flex: 0 0 auto;
  color: var(--p-ink-3);
}
.push-strip__icon--ok {
  color: var(--p-pos, var(--p-primary));
}
.push-strip__icon--warn {
  color: var(--p-warn, var(--p-neg));
}

.push-strip__text {
  font-size: var(--p-fs-caption, 12px);
  line-height: var(--p-lh-body-sm, 1.4);
  color: var(--p-ink-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

<!-- q-menu рендерится порталом в body → стиль не может быть scoped. На мобиле
     панель раскрываем во всю ширину вьюпорта (минус мелкий зазор), а не прижатым
     справа обрубком 360px, у которого резало правый край. -->
<style>
@media (max-width: 600px) {
  .notification-center-menu.q-menu {
    left: 8px !important;
    right: 8px !important;
    width: auto !important;
    max-width: none !important;
  }
}
</style>
