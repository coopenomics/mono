<template lang="pug">
#notification-inbox.notification-container
</template>

<script setup lang="ts">
import { useCurrentUser } from 'src/entities/Session';
import { useQuasar } from 'quasar';
import { env } from 'src/shared/config';
import { computed, onMounted, watch } from 'vue';
import { useSystemStore } from 'src/entities/System/model';

const currentUser = useCurrentUser();
const $q = useQuasar();
const isDark = computed(() => $q.dark.isActive);
const { info } = useSystemStore();

let novu: any = null;

async function mountNovu() {
  // Динамический импорт только на клиенте
  const { NovuUI } = await import('@novu/js/ui');
  const { dark } = await import('@novu/js/themes');

  const subscriberId = `${info.coopname}-${currentUser.username}`;
  const el = document.getElementById('notification-inbox');
  console.log('novuOptions, ', {
    applicationIdentifier: env.NOVU_APP_ID,
    subscriberId,
    // Теперь используем наш бэкенд в качестве прокси
    backendUrl: `${env.BACKEND_URL}/notifications`,
    socketUrl: `${env.BACKEND_URL}/notifications`,
  });

  if (el) el.innerHTML = '';
  novu = new NovuUI({
    options: {
      applicationIdentifier: env.NOVU_APP_ID,
      subscriberId,
      // Используем наш бэкенд в качестве прокси
      backendUrl: `${env.BACKEND_URL}/notifications`,
      socketUrl: `${env.BACKEND_URL}/notifications`,
    },
    appearance: {
      baseTheme: isDark.value ? dark : undefined,
    },
    localization: {
      'inbox.filters.dropdownOptions.unread': 'Только непрочитанные',
      'inbox.filters.dropdownOptions.default': 'Все сообщения',
      'inbox.filters.dropdownOptions.archived': 'Архив',
      'inbox.filters.labels.unread': 'Непрочитанные',
      'inbox.filters.labels.default': 'Входящие',
      'inbox.filters.labels.archived': 'Архив',
      'notifications.emptyNotice': 'Здесь пока тихо. Загляните позже.',
      'notifications.actions.readAll': 'Прочитать все',
      'notifications.actions.archiveAll': 'Архивировать все',
      'notifications.actions.archiveRead': 'Архивировать прочитанные',
      'notifications.newNotifications':
        '{{notificationCount}} новое уведомление(ий)',
      'notification.actions.read.tooltip': 'Отметить как прочитанное',
      'notification.actions.unread.tooltip': 'Отметить как непрочитанное',
      'notification.actions.archive.tooltip': 'В архив',
      'notification.actions.unarchive.tooltip': 'Из архива',
      'preferences.title': 'Настройки',
      'preferences.emptyNotice': 'Пока нет настроек уведомлений.',
      'preferences.global': 'Общие настройки',
      'preferences.workflow.disabled.notice':
        'Обратитесь к администратору для управления подпиской на это важное уведомление.',
      'preferences.workflow.disabled.tooltip':
        'Для изменения обратитесь к администратору',
      locale: 'ru-RU',
      dynamic: {
        'comment-on-post': 'Комментарии к записи',
      },
    },
  });
  novu.mountComponent({
    name: 'Inbox',
    props: {},
    element: el as HTMLDivElement,
  });
}

onMounted(() => {
  if (process.env.CLIENT) {
    mountNovu();
  }
});

watch(isDark, () => {
  mountNovu();
});
</script>

<style scoped>
.notification-container {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 10px;
}

:deep(.notification-bell-component) {
  height: 24px;
  width: 24px;
}
</style>
