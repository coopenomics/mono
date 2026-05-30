<template lang="pug">
div.connection-dashboard
  .row.q-col-gutter-md
    .col-12.col-md-4
      AxonWallet
      MembershipWallet.q-mt-md

    .col-12.col-md-8
      DomainCard
      SubscriptionsCard.q-mt-md
</template>

<script setup lang="ts">
import { AxonWallet, MembershipWallet, DomainCard, SubscriptionsCard } from './index'
</script>

<style lang="scss" scoped>
.connection-dashboard {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
