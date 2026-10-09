<template lang="pug">
q-page.payments-page
  //- Опциональный параметр маршрута :username? фильтрует реестр по владельцу
  //- платежа (приходим так из детали расхода — «Открыть в реестре платежей»).
  ListOfPaymentsWidget(:username='routeUsername', :read-only='!canConfirm')
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { ListOfPaymentsWidget } from 'src/widgets/Cooperative/Payments';
import { useDesktopStore } from 'src/entities/Desktop';

const route = useRoute();
const routeUsername = computed(() => (route.params.username as string) || undefined);

// Подтверждают оплату председатель и кассир; совет реестр читает.
const desktop = useDesktopStore();
const canConfirm = computed(() => desktop.hasGrant('soviet', 'Payment:confirm'));
</script>

<style lang="scss" scoped>
/* Поля страницы как в реестре пайщиков — таблица сама обрамлена (.table-wrap) */
.payments-page {
  padding: var(--p-6, 24px);
}

@media (max-width: 768px) {
  .payments-page {
    padding: var(--p-4, 16px);
  }
}
</style>
