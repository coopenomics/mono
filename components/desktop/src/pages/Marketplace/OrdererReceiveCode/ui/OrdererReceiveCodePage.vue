<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { ReceiveCodeContent } from 'src/widgets/Marketplace/ReceiveCode';

/**
 * Стол заказчика, страница «Получить заказ».
 *
 * Один account-bound QR-код на всю страницу и больше ничего. Заказчик
 * показывает его оператору на пункте выдачи — тот сканирует, резолвит аккаунт
 * против ленты своего КУ и выдаёт разом все готовые заказы этого заказчика.
 *
 * Сделано отдельным пунктом меню (а не действием в шапке), чтобы код был
 * очевидно findable: пайщику не нужно объяснять, где его искать — пункт
 * «Получить заказ» всегда виден в меню стола. Тот же QR доступен диалогом из
 * шапки «Моих заказов» и детали заказа (общий `ReceiveCodeContent`).
 */

const route = useRoute();
const coopname = computed(() => String(route.params.coopname ?? ''));
</script>

<template lang="pug">
q-page.receive(role="region", aria-label="Получить заказ")
  ReceiveCodeContent(:coopname="coopname")
</template>

<style scoped lang="scss">
.receive {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--p-6, 24px);
}
</style>
