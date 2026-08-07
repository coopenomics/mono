<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { HandoffCodeContent } from 'src/widgets/Marketplace/HandoffCode';
import { HandoffTokenKind } from 'src/shared/lib/marketplace';

/**
 * Стол заказчика, страница «Показать QR».
 *
 * Один account-bound QR-код на всю страницу и больше ничего. Заказчик
 * показывает его оператору на пункте выдачи — тот сканирует, резолвит аккаунт
 * против ленты своего КУ и выдаёт разом все готовые заказы этого заказчика.
 *
 * Сделано отдельным пунктом меню (а не действием в шапке), чтобы код был
 * очевидно findable: пайщику не нужно объяснять, где его искать — пункт
 * Пункт «Показать QR» всегда виден в меню стола. Тот же QR доступен диалогом из
 * шапки «Моих заказов» и детали заказа (общий `HandoffCodeContent`).
 */

const route = useRoute();
const coopname = computed(() => String(route.params.coopname ?? ''));
</script>

<template lang="pug">
q-page.receive(role="region", aria-label="Код для получения заказа")
  HandoffCodeContent(:coopname="coopname", :kind="HandoffTokenKind.Receive")
</template>

<style scoped lang="scss">
.receive {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--p-6, 24px);
}
</style>
