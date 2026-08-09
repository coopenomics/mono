<template lang="pug">
.settings-page
  //- Переход «ключ → пароль» в активной сессии (Story 11.6, in-session).
  PasswordCard

  //- Безопасность входа: активные сессии и устройства (Story 3.7).
  SessionsCard

  //- PIN-код устройства (уточнённая модель Эпика 7).
  PinCard
</template>

<script lang="ts" setup>
import { SessionsCard } from 'src/features/Security/ManageSessions';
import { PinCard } from 'src/features/Security/SetupPin';
import { PasswordCard } from 'src/features/Security/SetPassword';
</script>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  /* Ширину не ограничиваем и отступы берём как на остальных страницах стола
     (см. ProfilePage, PaymentsPage, PersonnelPage) — иначе экран выглядит
     зажатым в колонку слева, а справа остаётся пустое поле. */
  padding: var(--p-6, 24px);
}

@media (max-width: 768px) {
  .settings-page {
    padding: var(--p-4, 16px);
  }
}
</style>
