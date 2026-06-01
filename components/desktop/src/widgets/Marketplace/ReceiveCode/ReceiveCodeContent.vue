<script lang="ts" setup>
import { computed } from 'vue';
import { useSessionStore } from 'src/entities/Session';
import { HandoffQr } from 'src/widgets/Marketplace/HandoffQr';
import { EmptyState } from 'src/shared/ui/base';
import { encodeHandoffToken, HandoffTokenKind } from 'src/shared/lib/marketplace';

/**
 * Содержимое экрана «Получить заказ» — account-bound QR-код заказчика плюс
 * пояснение. Единый источник на три точки показа: отдельная страница меню
 * (`OrdererReceiveCode`), диалог из шапки «Моих заказов» и диалог из шапки
 * детали заказа. Раньше QR верстали отдельно в каждой — нарушение DRY; теперь
 * один компонент, которому передают `coopname` (аккаунт берётся из сессии).
 */

const props = withDefaults(
  defineProps<{
    coopname: string;
    size?: number;
  }>(),
  { size: 320 },
);

const session = useSessionStore();

const receiveCode = computed(() =>
  session.username
    ? encodeHandoffToken({
        kind: HandoffTokenKind.Receive,
        coopname: props.coopname,
        account: session.username,
      })
    : '',
);
</script>

<template lang="pug">
.receive-code(v-if="receiveCode")
  HandoffQr(
    :value="receiveCode",
    :size="size",
    caption="Покажите этот код оператору на том пункте выдачи, куда пришёл ваш заказ — он выдаст по нему всё, что готово к получению. Код можно показать с экрана телефона или с распечатки."
  )
EmptyState(
  v-else,
  title="Код недоступен",
  body="Войдите в кооператив, чтобы получить персональный код выдачи."
)
  template(#icon)
    q-icon(name="qr_code_2", size="48px")
</template>

<style scoped lang="scss">
.receive-code {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--p-4, 16px);
  max-width: 480px;
  margin: 0 auto;
  text-align: center;
}
</style>
