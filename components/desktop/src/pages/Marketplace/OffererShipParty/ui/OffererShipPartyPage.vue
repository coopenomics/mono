<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { HandoffCodeContent } from 'src/widgets/Marketplace/HandoffCode';
import { HandoffTokenKind } from 'src/shared/lib/marketplace';

/**
 * Стол поставщика, страница «Показать QR».
 *
 * Один account-bound Pickup-QR на всю страницу и больше ничего. Поставщик
 * показывает его оператору приёмки — тот сканирует, резолвит аккаунт против
 * ленты своего КУ и принимает разом всё привезённое (сформированные партии и
 * самовывоз по факту).
 *
 * Зеркало заказчикова «Получить заказ»: тот же код, что в действии шапки
 * «Подготовки отгрузки», вынесен отдельным пунктом меню — чтобы поставщик не
 * пропустил, где взять код на приёмке. Общий `HandoffCodeContent`.
 */

const route = useRoute();
const coopname = computed(() => String(route.params.coopname ?? ''));
</script>

<template lang="pug">
q-page.ship-party(role="region", aria-label="Код для приёмки партии")
  HandoffCodeContent(:coopname="coopname", :kind="HandoffTokenKind.Pickup")
</template>

<style scoped lang="scss">
.ship-party {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--p-6, 24px);
}
</style>
