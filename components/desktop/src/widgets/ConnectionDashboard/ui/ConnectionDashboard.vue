<template lang="pug">
.conn-dash
  //- Одна подсказка на страницу (канон): здесь объясняется вся денежная
  //- механика подключения, поэтому внутри карточек пояснительных баннеров
  //- больше нет.
  PageHint(storage-key="connection:dashboard:banner-dismissed")
    | Подписки оплачиваются членскими взносами: пайщик переводит в них свой
    | паевой взнос. AXON для документооборота оператор докупает сам — по факту
    | работы, но не меньше 5 AXON в день; напрямую паевым взносом он не
    | пополняется.

  DomainCard

  .conn-dash__wallets.row.q-col-gutter-md
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
/* Кошельки — одной высоты: у членских есть строка действия, у AXON её нет,
   и без растяжения плитки стояли бы ступенькой. */
.conn-dash__wallets > [class^='col'] {
  display: flex;
}
.conn-dash__wallets :deep(.wallet) {
  flex: 1;
}
</style>
