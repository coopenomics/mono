<template lang="pug">
#notification-inbox.notification-container
</template>

<script setup lang="ts">
import { useCurrentUser } from 'src/entities/Session';
import { useQuasar } from 'quasar';
import { env } from 'src/shared/config';
import { computed, onMounted, watch } from 'vue';

const currentUser = useCurrentUser();
const $q = useQuasar();
const isDark = computed(() => $q.dark.isActive);

let novu: any = null;

async function mountNovu() {
  try {
    // Динамический импорт только на клиенте
    const { NovuUI } = await import('@novu/js/ui');
    const { dark } = await import('@novu/js/themes');

    // Получаем данные подписчика из providerAccount
    const providerAccount = currentUser.providerAccount.value;
    console.log('providerAccount: ', providerAccount);
    if (!providerAccount?.subscriber_id || !providerAccount?.subscriber_hash) {
      console.error(
        'Не удалось получить данные подписчика NOVU из providerAccount. Повторите попытку.',
      );
      return;
    }

    const { subscriber_id, subscriber_hash } = providerAccount;
    const el = document.getElementById('notification-inbox');

    console.log('novuOptions:', {
      applicationIdentifier: env.NOVU_APP_ID,
      subscriberId: subscriber_id,
      subscriberHash: subscriber_hash,
      backendUrl: env.NOVU_BACKEND_URL,
      socketUrl: env.NOVU_SOCKET_URL,
    });

    if (el) el.innerHTML = '';
    novu = new NovuUI({
      options: {
        applicationIdentifier: env.NOVU_APP_ID,
        subscriberId: subscriber_id,
        subscriberHash: subscriber_hash,
        backendUrl: env.NOVU_BACKEND_URL,
        socketUrl: env.NOVU_SOCKET_URL,
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
  } catch (error) {
    console.error('Ошибка при монтировании NOVU:', error);
  }
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
