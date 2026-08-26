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

  //- Журнал списаний за подписки: тот же виджет, что видит совет в карточке
  //- кооператива — здесь он отвечает на вопрос «за что и когда списали».
  PaymentsHistory(
    v-if="coopname"
    :coopname="coopname"
    title="История списаний"
    subtitle="Оплаты подписок членскими взносами кооператива"
    :limit="20"
  )
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { PageHint } from 'src/shared/ui/domain'
import { PaymentsHistory } from 'src/widgets/Billing/PaymentsHistory'
import { useSystemStore } from 'src/entities/System/model'
import { AxonWallet, MembershipWallet, DomainCard, SubscriptionsCard } from './index'

const { info } = useSystemStore()
const coopname = computed(() => info.coopname || '')
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
