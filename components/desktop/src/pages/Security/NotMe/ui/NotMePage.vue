<template lang="pug">
.not-me-page
  AuthSplit(
    :eyebrow='coopTitle',
    :title='$t("security.notMePage.title")',
    :lead='$t("security.notMePage.lead")',
    :quote='$t("security.notMePage.quote")',
    :step-eyebrow='$t("security.notMePage.title")',
    :heading='$t("security.notMePage.heading")'
  )
    template(#actions)
      AuthActions
    .not-me__body
      template(v-if='state === "pending"')
        q-spinner(size='28px', color='primary')
        p.not-me__text {{ $t('security.notMePage.progress') }}

      template(v-else-if='state === "done"')
        q-icon.not-me__icon.not-me__icon--ok(name='verified_user', size='36px')
        p.not-me__text
          | {{ $t('security.notMePage.done', { revokedSuffix: revoked ? ` (${revoked})` : '' }) }}
          | {{ $t('security.notMePage.strangerNote') }}
        p.not-me__hint {{ $t('security.notMePage.nextStep') }}

      template(v-else)
        q-icon.not-me__icon.not-me__icon--warn(name='error_outline', size='36px')
        p.not-me__text {{ errorMessage }}
        p.not-me__hint {{ $t('security.notMePage.expiredNote') }}

    BaseButton(v-if='state !== "pending"', variant='primary', block, @click='goToSignIn') {{ $t('security.notMePage.login') }}
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { AuthSplit } from 'src/shared/ui/layout/AuthSplit';
import { AuthActions } from 'src/widgets/Registrator/AuthActions';
import { useSystemStore } from 'src/entities/System/model';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { env } from 'src/shared/config';
import { t } from 'src/shared/i18n';

/**
 * Landing one-click ссылки «Это не я» из письма о входе с нового устройства
 * (Story 3.10). Открывается БЕЗ входа: своя сессия могла быть скомпрометирована,
 * авторизация — одноразовый токен из ссылки. Страница сама дёргает REST-отзыв
 * всех сессий и показывает исход.
 */

const route = useRoute();
const router = useRouter();
const systemStore = useSystemStore();
const coopTitle = computed(() => systemStore.cooperativeDisplayName);

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
      errorMessage.value = body?.error_description ?? t('security.notMePage.linkInvalidError');
      state.value = 'error';
      return;
    }
    const body = (await res.json().catch(() => null)) as { revoked?: number } | null;
    revoked.value = body?.revoked ?? 0;
    state.value = 'done';
  } catch {
    errorMessage.value = t('security.notMePage.connectionError');
    state.value = 'error';
  }
});

function goToSignIn(): void {
  void router.push({ name: 'signin', params: { coopname: route.params.coopname } });
}
</script>

<style scoped>
.not-me-page {
  min-height: inherit;
}
.not-me__body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--p-3);
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
