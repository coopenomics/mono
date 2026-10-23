<template lang="pug">
.conn-dash
  //- Одна подсказка на страницу (канон): здесь объясняется вся денежная
  //- механика подключения, поэтому внутри карточек пояснительных баннеров
  //- больше нет.
  PageHint(storage-key="connection:dashboard:banner-dismissed")
    | {{ $t('connectionDashboard.dashboard.paymentNoteLine1') }}
    | {{ $t('connectionDashboard.dashboard.paymentNoteLine2') }}
    | {{ $t('connectionDashboard.dashboard.paymentNoteLine3') }}
    | {{ $t('connectionDashboard.dashboard.paymentNoteLine4') }}

  //- Просрочка и приостановка — первым экраном: пока долг не закрыт, всё
  //- остальное на этой странице вторично.
  BillingDueCard

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
    :title="$t('connectionDashboard.dashboard.paymentsTitle')"
    :subtitle="$t('connectionDashboard.dashboard.paymentsSubtitle')"
    :limit="20"
  )

  //- Ключ установки — в самом низу (21.10.2026): нужен один раз, при установке,
  //- а первым и крупным мешал панели, которой пользуются каждый день.
  //- Выпуск и перевыпуск — через подтверждение.
  PlatformKeyCard(:site-url="siteUrl")
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { PageHint } from 'src/shared/ui/domain'
import { PaymentsHistory } from 'src/widgets/Billing/PaymentsHistory'
import { useSystemStore } from 'src/entities/System/model'
import { useCooperativeStore } from 'src/entities/Cooperative'
import { AxonWallet, MembershipWallet, DomainCard, SubscriptionsCard, BillingDueCard, PlatformKeyCard } from './index'

const { info } = useSystemStore()
const coopname = computed(() => info.coopname || '')

// Адрес кооператива грузит DomainCard из реестра сети; карточка ключа ведёт туда.
const coop = useCooperativeStore()
const siteUrl = computed(() => {
  const announce = coop.publicCooperativeData?.announce
  return announce ? `https://${announce}` : undefined
})
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
