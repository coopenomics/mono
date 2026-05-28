<template lang="pug">
q-page.payments-page
  ListOfPaymentsWidget
</template>

<script lang="ts" setup>
import { ListOfPaymentsWidget } from 'src/widgets/Cooperative/Payments';
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
