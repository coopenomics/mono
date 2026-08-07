<script lang="ts" setup>
import { computed } from 'vue';
import { useSessionStore } from 'src/entities/Session';
import { HandoffQr } from 'src/widgets/Marketplace/HandoffQr';
import { EmptyState } from 'src/shared/ui/base';
import { encodeHandoffToken } from 'src/shared/lib/marketplace';
import { HANDOFF_CODE_COPY, type AccountHandoffKind } from './copy';

/**
 * Содержимое экрана account-bound кода передачи — QR-код плюс пояснение. Единый
 * источник на оба стола и три точки показа на каждом:
 *  - заказчик (`kind=receive`): страница меню «Получить заказ» + диалог из шапки
 *    «Моих заказов» и детали заказа;
 *  - поставщик (`kind=pickup`): страница меню «Показать QR» + диалог из
 *    шапки «Подготовки отгрузки».
 *
 * Код привязан к личности (аккаунт из сессии), детерминирован и оффлайн —
 * backend токен не минтит. Тексты — из `HANDOFF_CODE_COPY` по `kind`.
 */

const props = withDefaults(
  defineProps<{
    coopname: string;
    kind: AccountHandoffKind;
    size?: number;
  }>(),
  { size: 320 },
);

const session = useSessionStore();

const copy = computed(() => HANDOFF_CODE_COPY[props.kind]);

const code = computed(() =>
  session.username
    ? encodeHandoffToken({
        kind: props.kind,
        coopname: props.coopname,
        account: session.username,
      })
    : '',
);
</script>

<template lang="pug">
.handoff-code(v-if="code")
  HandoffQr(:value="code", :size="size", :caption="copy.caption")
EmptyState(
  v-else,
  title="Код недоступен",
  :body="copy.emptyBody"
)
  template(#icon)
    q-icon(name="qr_code_2", size="48px")
</template>

<style scoped lang="scss">
.handoff-code {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--p-4, 16px);
  max-width: 480px;
  margin: 0 auto;
  text-align: center;
}
</style>
