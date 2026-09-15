<template lang="pug">
.row.justify-center
  q-card.q-pa-md.q-mt-lg(flat, bordered)
    q-card-section
      .full-width.text-center
        q-badge.q-pa-sm(color='red')
          q-icon(name='fa-regular fa-hand', size='48px')
      .text-h4 Недостаточно прав доступа

    q-card-actions(align='center')
      q-btn(
        label='Вернуться',
        color='primary',
        icon='fa fa-arrow-left',
        @click='goBack'
      )
</template>
<script lang="ts" setup>
import { useRouter } from 'vue-router';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSessionStore } from 'src/entities/Session';
import { setSsrStatus } from 'src/shared/lib/ssr/setSsrStatus';

// Отказ в доступе при серверном рендере уходит честным 403.
setSsrStatus(403);

const router = useRouter();
const desktops = useDesktopStore();
const session = useSessionStore();

function goBack() {
  // Если пользователь авторизован, пытаемся перейти на безопасную страницу
  if (session.isAuth && session.isRegistrationComplete) {
    // Пытаемся перейти на participant workspace как самый безопасный вариант
    const hasParticipantWorkspace = desktops.currentDesktop?.workspaces.some(
      (ws) => ws.name === 'participant',
    );

    if (hasParticipantWorkspace) {
      // Устанавливаем participant workspace и переходим на его главную страницу
      desktops.selectWorkspace('participant');
      desktops.goToDefaultPage(router);
      return;
    }
  }

  // Если ничего не найдено, идем на страницу по умолчанию для неавторизованного пользователя
  desktops.goToDefaultPage(router);
}
</script>
