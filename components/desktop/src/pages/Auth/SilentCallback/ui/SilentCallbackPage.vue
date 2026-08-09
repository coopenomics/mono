<template lang="pug">
//- Страница живёт в скрытом кадре и пользователю не показывается: её задача —
//- отдать результат тихой переавторизации родительскому окну. Разметка нужна
//- лишь на случай, если её случайно открыли напрямую.
.silent-callback
  span.silent-callback__text Завершаем вход…
</template>

<script lang="ts" setup>
import { onMounted } from 'vue';
import { completeSilentSignin } from '@coopenomics/auth';
import { env } from 'src/shared/config';

/**
 * Адрес возврата контура CoopID.
 *
 * `signinSilent` грузит этот адрес в скрытом кадре и ждёт от него ответа —
 * отвечает `completeSilentSignin`, разбирая параметры из адресной строки.
 * Без такой страницы вход по паролю виснет до таймаута: authentik всё сделал
 * правильно, но результат некому забрать.
 */
onMounted(async () => {
  if (!env.COOPID_ISSUER) return;
  try {
    await completeSilentSignin(env.COOPID_ISSUER);
  } catch (e) {
    // Родительское окно само покажет ошибку входа — здесь только след в консоли:
    // страница невидима, показывать сообщение на ней некому.
    console.error('[coopid] не удалось завершить тихую переавторизацию', e);
  }
});
</script>

<style scoped>
.silent-callback {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}
.silent-callback__text {
  color: var(--p-ink-3);
  font-size: var(--p-fs-sm);
}
</style>
