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
/* Влево и во всю ширину — как остальные разделы стола. Центрированная колонка
   оставляла поля по краям, и карточки выглядели вставкой посреди холста. */
.connection-dashboard {
  width: 100%;
}
</style>
