<template lang="pug">
q-page.permission-denied
  .permission-denied__inner
    EmptyState(
      title='Недостаточно прав доступа',
      body='У вас нет доступа к этой странице. Если это ошибка — обратитесь к председателю или вернитесь в личный кабинет.'
    )
      template(#icon)
        q-icon(name='lock_outline', size='48px')
      template(#action)
        BaseButton(variant='primary', @click='goBack')
          template(#icon-left)
            q-icon(name='arrow_back')
          | Вернуться
</template>

<script lang="ts" setup>
import { useRouter } from 'vue-router';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSessionStore } from 'src/entities/Session';
import EmptyState from 'src/shared/ui/base/EmptyState/EmptyState.vue';
import BaseButton from 'src/shared/ui/base/BaseButton/BaseButton.vue';

const router = useRouter();
const desktops = useDesktopStore();
const session = useSessionStore();

function goBack(): void {
  if (session.isAuth && session.isRegistrationComplete) {
    const hasParticipantWorkspace = desktops.currentDesktop?.workspaces.some(
      (ws) => ws.name === 'participant',
    );

    if (hasParticipantWorkspace) {
      desktops.selectWorkspace('participant');
      desktops.goToDefaultPage(router);
      return;
    }
  }

  desktops.goToDefaultPage(router);
}
</script>

<style scoped>
.permission-denied {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--p-6, 24px);
}
.permission-denied__inner {
  width: 100%;
  max-width: 520px;
}
</style>
