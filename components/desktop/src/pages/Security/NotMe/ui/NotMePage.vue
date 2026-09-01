<template lang="pug">
.not-me-page
  AuthCard(title='Это не я', subtitle='Защита аккаунта')
    .not-me__body
      template(v-if='state === "pending"')
        q-spinner(size='28px', color='primary')
        p.not-me__text Завершаем все сессии вашего аккаунта…

      template(v-else-if='state === "done"')
        q-icon.not-me__icon.not-me__icon--ok(name='verified_user', size='36px')
        p.not-me__text
          | Готово: все сессии завершены{{ revoked ? ` (${revoked})` : '' }}.
          | Тот, кто вошёл с чужого устройства, больше не в аккаунте.
        p.not-me__hint Теперь войдите и смените пароль в настройках безопасности.

      template(v-else)
        q-icon.not-me__icon.not-me__icon--warn(name='error_outline', size='36px')
        p.not-me__text {{ errorMessage }}
        p.not-me__hint Ссылка одноразовая и живёт ограниченное время. Если сессии не завершились — войдите и завершите их на странице настроек.

    template(#footer)
      BaseButton(variant='primary', @click='goToSignIn') Войти
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { AuthCard } from 'src/shared/ui/domain/AuthCard';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { env } from 'src/shared/config';

/**
 * Landing one-click ссылки «Это не я» из письма о входе с нового устройства
 * (Story 3.10). Открывается БЕЗ входа: своя сессия могла быть скомпрометирована,
 * авторизация — одноразовый токен из ссылки. Страница сама дёргает REST-отзыв
 * всех сессий и показывает исход.
 */

const route = useRoute();
const router = useRouter();

const state = ref<'pending' | 'done' | 'error'>('pending');
const revoked = ref(0);
const errorMessage = ref('');

onMounted(async () => {
  const token = String(route.params.token ?? '');
  try {
    const res = await fetch(`${env.BACKEND_URL}/coop/security/not-me/${encodeURIComponent(token)}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error_description?: string } | null;
      errorMessage.value = body?.error_description ?? 'Ссылка недействительна или уже использована.';
      state.value = 'error';
      return;
    }
    const body = (await res.json().catch(() => null)) as { revoked?: number } | null;
    revoked.value = body?.revoked ?? 0;
    state.value = 'done';
  } catch {
    errorMessage.value = 'Не удалось связаться с кооперативом. Проверьте интернет и обновите страницу.';
    state.value = 'error';
  }
});

function goToSignIn(): void {
  void router.push({ name: 'signin', params: { coopname: route.params.coopname } });
}
</script>

<style scoped>
.not-me-page {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--p-6);
  min-height: 100%;
}
.not-me__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--p-3);
  text-align: center;
  padding: var(--p-4) 0;
}
.not-me__text {
  margin: 0;
  color: var(--p-ink);
}
.not-me__hint {
  margin: 0;
  color: var(--p-ink-3);
  font-size: var(--p-fs-body-sm);
}
.not-me__icon--ok {
  color: var(--p-pos);
}
.not-me__icon--warn {
  color: var(--p-warn);
}
</style>
