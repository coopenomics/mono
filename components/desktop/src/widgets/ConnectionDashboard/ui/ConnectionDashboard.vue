<template lang="pug">
div.connection-dashboard
  //- Основная информация
  .row.q-mb-lg
    //- Карточка баланса AXON
    .col-12.col-md-4
      AxonWallet

    //- Карточка домена
    .col-12.col-md-6
      DomainCard

      SubscriptionsManagement



</template>

<script setup lang="ts">
import { AxonWallet, DomainCard } from './index'
import { SubscriptionsManagement } from 'src/widgets/Billing/SubscriptionsManagement'

</script>

<style lang="scss" scoped>
.connection-dashboard {
  max-width: 1200px;
  margin: 0 auto;
}
</style>

