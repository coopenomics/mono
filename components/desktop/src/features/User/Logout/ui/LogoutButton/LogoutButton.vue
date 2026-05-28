<template>
  <button
    v-if="loggedIn"
    type="button"
    class="logout-btn"
    @click="logout"
  >
    <q-icon name="logout" class="logout-btn__ico" />
    <span class="logout-btn__label">Выйти</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useLogoutUser } from '../../model';
import { FailAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';

const router = useRouter();
const session = useSessionStore();

const loggedIn = computed(
  () => session.isRegistrationComplete && session.isAuth,
);

async function logout(): Promise<void> {
  const { logout: doLogout } = useLogoutUser();
  try {
    await doLogout();
    void router.push({ name: 'signin' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    FailAlert('Ошибка при выходе: ' + msg);
  }
}
</script>

<style scoped>
/* Ghost-кнопка в стиле rail-пунктов AppDrawer: без фоновой плашки в покое,
   на hover — soft-фон того же цвета. Размер выровнен с rail__item. */
.logout-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: 0;
  border-radius: var(--p-r-sm, 8px);
  color: var(--p-ink-2);
  font-family: var(--p-sans, inherit);
  font-size: var(--p-fs-body-sm, 14px);
  text-align: left;
  cursor: pointer;
  transition: background var(--p-dur-fast, 120ms) ease,
    color var(--p-dur-fast, 120ms) ease;
}
.logout-btn:hover {
  background: var(--p-neg-soft);
  color: var(--p-neg);
}
.logout-btn:focus-visible {
  outline: none;
  box-shadow: var(--p-focus-ring);
}
.logout-btn__ico {
  font-size: 16px;
  color: var(--p-ink-3);
  flex-shrink: 0;
}
.logout-btn:hover .logout-btn__ico {
  color: var(--p-neg);
}
.logout-btn__label {
  font-weight: 450;
}
</style>
