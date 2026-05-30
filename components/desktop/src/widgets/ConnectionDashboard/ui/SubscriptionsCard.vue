<template lang="pug">
.subs-card
  BaseCard(title="Подписки" subtitle="Услуги провайдера, оплачиваемые членскими взносами")
    Loader(v-if="isLoading" :text="'Загрузка подписок...'")

    template(v-else-if="error")
      BaseBanner(variant="neg") Ошибка загрузки подписок: {{ error }}

    template(v-else-if="subscriptions.length")
      .subs-card__list
        .subs-card__row(
          v-for="sub in subscriptions"
          :key="sub.id"
        )
          .subs-card__icon
            q-icon(
              :name="getSubscriptionIcon(sub)"
              size="20px"
              :class="iconColorClass(sub)"
            )
          .subs-card__body
            .subs-card__title {{ sub.subscription_type_name }}
            .subs-card__sub {{ sub.subscription_type_description }}
          // — Epic 13 v5.1: пакетная подписка показывает «пакеты RUB/мес»
          .subs-card__price(v-if="isPackage(sub)")
            .subs-card__price-value.t-mono
              | {{ formatPriceLine(sub.packages_current_period_amount || 0) }}
              | /
              | {{ formatPriceLine(sub.monthly_quota_rub || 0) }}
            .subs-card__price-period пакеты {{ currencySymbol }}/мес
          // — обычная time-подписка: руб/месяц
          .subs-card__price(v-else)
            .subs-card__price-value.t-mono {{ formatPrice(sub.price) }}
            .subs-card__price-period {{ currencySymbol }}/месяц

    EmptyState(
      v-else
      title="Нет активных подписок"
      body="Подписки появятся после подключения услуг платформы"
    )
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useProviderSubscriptions } from 'src/features/Provider/model'
import { useSystemStore } from 'src/entities/System/model'
import { BaseBanner, BaseCard, EmptyState } from 'src/shared/ui/base'
import Loader from 'src/shared/ui/Loader/Loader.vue'
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits'

const { subscriptions, isLoading, error, loadSubscriptions } = useProviderSubscriptions()
const { info } = useSystemStore()

onMounted(async () => {
  await loadSubscriptions()
})

const formatPrice = (price: number | string) => {
  const priceStr = typeof price === 'number' ? price.toString() : price
  const sym = info.symbols?.root_govern_symbol || 'AXON'
  return formatAsset2Digits(`${priceStr} ${sym}`)
}

const currencySymbol = computed(() => info.symbols?.root_govern_symbol || 'AXON')

// Epic 13 v5.1: распознавание пакетных подписок и форматирование пакетной строки.
const isPackage = (sub: any): boolean => sub?.kind === 'package'

const formatPriceLine = (rub: number): string => {
  const sym = info.symbols?.root_govern_symbol || 'AXON'
  return formatAsset2Digits(`${Number(rub).toString()} ${sym}`)
}

const getSubscriptionIcon = (subscription: any) => {
  if (subscription.is_trial) return 'local_offer'
  if (subscription.subscription_type_id === 1) {
    const sd = subscription.specific_data
    if (sd?.is_valid && sd?.is_delegated) return 'check_circle'
    if (sd?.progress > 0 && sd?.progress < 100) return 'hourglass_top'
    return 'schedule'
  }
  switch (subscription.instance_status) {
    case 'active': return 'check_circle'
    case 'pending': return 'schedule'
    case 'installing': return 'hourglass_top'
    case 'error': return 'error'
    case 'inactive': return 'pause_circle'
    default: return 'help'
  }
}

const iconColorClass = (subscription: any): string => {
  if (subscription.is_trial) return 'subs-card__icon--info'
  if (subscription.subscription_type_id === 1) {
    const sd = subscription.specific_data
    if (sd?.is_valid && sd?.is_delegated) return 'subs-card__icon--pos'
    if (sd?.progress > 0 && sd?.progress < 100) return 'subs-card__icon--warn'
    return 'subs-card__icon--mute'
  }
  switch (subscription.instance_status) {
    case 'active': return 'subs-card__icon--pos'
    case 'installing': return 'subs-card__icon--warn'
    case 'error': return 'subs-card__icon--neg'
    default: return 'subs-card__icon--mute'
  }
}
</script>

<style scoped>
.subs-card__list {
  display: flex;
  flex-direction: column;
}
.subs-card__row {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  align-items: center;
  gap: var(--p-3);
  padding: var(--p-3) 0;
  border-bottom: 1px solid var(--p-line);
}
.subs-card__row:last-child {
  border-bottom: 0;
}
.subs-card__icon--pos { color: var(--p-pos); }
.subs-card__icon--neg { color: var(--p-neg); }
.subs-card__icon--warn { color: var(--p-warn); }
.subs-card__icon--info { color: var(--p-primary); }
.subs-card__icon--mute { color: var(--p-ink-2); }
.subs-card__title {
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
}
.subs-card__sub {
  font-size: var(--p-fs-meta);
  color: var(--p-ink-2);
  margin-top: 2px;
}
.subs-card__price {
  text-align: right;
}
.subs-card__price-value {
  font-size: var(--p-fs-body);
  font-weight: 700;
  color: var(--p-ink);
}
.subs-card__price-period {
  font-size: var(--p-fs-meta);
  color: var(--p-ink-2);
}
</style>
