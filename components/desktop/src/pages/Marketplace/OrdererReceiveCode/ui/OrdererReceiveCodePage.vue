<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { HandoffCodeContent } from 'src/widgets/Marketplace/HandoffCode';
import { KUHeaderBar } from 'src/widgets/Marketplace/KUHeaderBar';
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
 *
 * Сверху — плашка пункта выдачи с адресом и режимом работы, как на остальных
 * страницах заказчика (решение владельца 19.11.2026): человек видит, куда и
 * когда приходить с кодом. Код один на все участки — оператор выдаёт по нему
 * только заказы своего участка.
 */

const route = useRoute();
const coopname = computed(() => String(route.params.coopname ?? ''));
</script>

<template lang="pug">
q-page.receive(role="region", :aria-label="$t('marketplace.ordererReceiveCodePage.pageAriaLabel')")
  KUHeaderBar.receive__ku(:coopname="coopname")
  .receive__code
    HandoffCodeContent(:coopname="coopname", :kind="HandoffTokenKind.Receive")
</template>

<style scoped lang="scss">
.receive {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
  padding: var(--p-6, 24px);

  // Плашка — во всю ширину страницы, как в каталоге и «Моих заказах».
  &__ku {
    align-self: stretch;
  }

  // Код — по центру оставшейся высоты.
  &__code {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
