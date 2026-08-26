<template lang="pug">
.conn-dash
  //- Одна подсказка на страницу (канон): здесь объясняется вся денежная
  //- механика подключения, поэтому внутри карточек пояснительных баннеров
  //- больше нет.
  PageHint(storage-key="connection:dashboard:banner-dismissed")
    | Подписки кооператива оплачиваются членскими взносами: пайщик переводит
    | свой паевой взнос в членский, а оператор платформы сам докупает на него
    | AXON — ресурс, которым оплачивается документооборот (расход по факту
    | работы, но не меньше 5 AXON в день). Прямое пополнение AXON паевым
    | взносом не предусмотрено.

  DomainCard

  .row.q-col-gutter-md
    .col-12.col-md-6
      MembershipWallet
    .col-12.col-md-6
      AxonWallet

  SubscriptionsCard
</template>

<script setup lang="ts">
import { PageHint } from 'src/shared/ui/domain'
import { AxonWallet, MembershipWallet, DomainCard, SubscriptionsCard } from './index'
</script>

<style scoped>
/* Влево и во всю ширину — как остальные разделы стола. Центрированная колонка
   оставляла поля по краям, и карточки выглядели вставкой посреди холста.
   Вертикальный ритм задаётся одним gap'ом, а не q-mt-* на каждом блоке. */
.conn-dash {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
}
</style>
