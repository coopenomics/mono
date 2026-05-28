<template lang="pug">
.payments-page
  ListOfPaymentsWidget(:username="username" :hideActions="true")
</template>

<script lang="ts" setup>
import { ListOfPaymentsWidget } from 'src/widgets/Cooperative/Payments';
import { useSessionStore } from 'src/entities/Session';

const session = useSessionStore();
const username = session.username;
</script>

<style lang="scss" scoped>
.payments-page {
  padding: var(--p-6, 24px);
}

@media (max-width: 768px) {
  .payments-page {
    padding: var(--p-4, 16px);
  }
}
</style>
