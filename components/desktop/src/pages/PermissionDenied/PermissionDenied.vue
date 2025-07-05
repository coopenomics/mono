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
import { useCurrentUser } from 'src/entities/Session';

const router = useRouter();
const desktops = useDesktopStore();
const session = useSessionStore();
const currentUser = useCurrentUser();

function goBack() {
  // Если пользователь авторизован, пытаемся перейти на безопасную страницу
  if (session.isAuth && currentUser.isRegistrationComplete.value) {
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

  // Если ничего не найдено, идем на главную страницу неавторизованного пользователя
  const homePage = desktops.currentDesktop?.nonAuthorizedHome;
  if (homePage) {
    router.push({ name: homePage });
  } else {
    // В крайнем случае, просто перезагружаем страницу
    window.location.reload();
  }
}
</script>
