<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useSessionStore } from 'src/entities/Session';
import { HandoffQr } from 'src/widgets/Marketplace/HandoffQr';
import { EmptyState } from 'src/shared/ui/base';
import { encodeHandoffToken, HandoffTokenKind } from 'src/shared/lib/marketplace';

/**
 * Стол заказчика, страница «Получить заказ».
 *
 * Один account-bound QR-код на всю страницу и больше ничего. Заказчик
 * показывает его оператору на пункте выдачи — тот сканирует, резолвит аккаунт
 * против ленты своего КУ и выдаёт разом все готовые заказы этого заказчика.
 *
 * Сделано отдельным пунктом меню (а не действием в шапке), чтобы код был
 * очевидно findable: пайщику не нужно объяснять, где его искать — пункт
 * «Получить заказ» всегда виден в меню стола.
 */

const route = useRoute();
const session = useSessionStore();
const coopname = computed(() => String(route.params.coopname ?? ''));

const receiveCode = computed(() =>
  session.username
    ? encodeHandoffToken({
        kind: HandoffTokenKind.Receive,
        coopname: coopname.value,
        account: session.username,
      })
    : '',
);
</script>

<template lang="pug">
q-page.receive(role="region", aria-label="Получить заказ")
  .receive__inner(v-if="receiveCode")
    HandoffQr(
      :value="receiveCode",
      :size="320",
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
.receive {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--p-6, 24px);

  &__inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--p-4, 16px);
    max-width: 480px;
    text-align: center;
  }
}
</style>
