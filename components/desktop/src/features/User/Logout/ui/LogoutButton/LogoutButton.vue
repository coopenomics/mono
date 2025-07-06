<template lang="pug">
q-item.logout-button(v-if='loggedIn', flat, clickable, @click='logout')
  q-item-section
    q-item-label
      q-icon.q-mr-sm(name='logout')
      span.logout-text ВЫЙТИ
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useLogoutUser } from '../../model';
import { FailAlert } from 'src/shared/api';
import { useCurrentUser } from 'src/entities/Session';
import { useSessionStore } from 'src/entities/Session';

const router = useRouter();
const session = useSessionStore();
const currentUser = useCurrentUser();

const loggedIn = computed(
  () => currentUser.isRegistrationComplete.value && session.isAuth,
);

const logout = async () => {
  const { logout } = useLogoutUser();

  try {
    await logout();
    router.push({ name: 'signin' });
  } catch (e: any) {
    FailAlert('Ошибка при выходе: ' + e.message);
  }
};
</script>

<style scoped>
.logout-button {
  min-height: 48px;
  background-color: rgba(255, 0, 0, 0.05);
  border-radius: 4px;
}

.logout-button:hover {
  background-color: rgba(255, 0, 0, 0.1);
}

.logout-text {
  font-size: 12px;
  font-weight: 500;
  color: #d32f2f;
}

body.body--dark .logout-button {
  background-color: rgba(244, 67, 54, 0.1);
}

body.body--dark .logout-button:hover {
  background-color: rgba(244, 67, 54, 0.2);
}
</style>
