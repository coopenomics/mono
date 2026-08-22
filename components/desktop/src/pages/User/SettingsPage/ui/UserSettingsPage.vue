<template lang="pug">
.settings-page
  //- Переход «ключ → пароль» в активной сессии (Story 11.6, in-session).
  PasswordCard

  //- Подтверждение входа (2FA): код из приложения и/или на почту.
  LoginSecurityCard

  //- Безопасность входа: активные сессии и устройства (Story 3.7).
  SessionsCard

  //- PIN-код устройства (уточнённая модель Эпика 7).
  PinCard

  //- Опасная зона — в самом конце, за чертой: необратимое действие не должно
  //- стоять в одном ряду с бытовыми настройками (паттерн «danger zone»).
  q-separator.settings-page__danger-line

  ExitDangerCard
</template>

<script lang="ts" setup>
import { SessionsCard } from 'src/features/Security/ManageSessions';
import { LoginSecurityCard } from 'src/features/Security/LoginFactors';
import { ExitDangerCard } from 'src/features/Membership/ExitFromCoop';
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

/* Черта перед опасной зоной — заметный отступ сверху и снизу, сама линия каноном. */
.settings-page__danger-line {
  margin: var(--p-4) 0;
}

@media (max-width: 768px) {
  .settings-page {
    padding: var(--p-4, 16px);
  }
}
</style>
