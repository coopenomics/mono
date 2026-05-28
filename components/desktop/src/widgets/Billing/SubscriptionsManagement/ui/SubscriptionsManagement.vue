<template lang="pug">
.subscriptions-card
  ColorCard(color='orange', @click.stop)
    // Заголовок
    .subscriptions-header
      .subscriptions-title
        q-icon(name="subscriptions" size="20px").q-mr-sm
        | Подписки

    // Список подписок
    .subscriptions-list
      template(v-if="isLoading")
        .text-center.q-pa-md
          q-spinner(color="orange" size="24px")
          .text-caption.text-grey-7.q-mt-sm Загрузка подписок...

      template(v-else-if="subscriptions.length > 0")
        q-list(separator)
          q-item(
            v-for="subscription in subscriptions"
            :key="subscription.id"
          )
            q-item-section(avatar)
              q-icon(
                :name="getSubscriptionIcon(subscription)"
                :color="getSubscriptionColor(subscription)"
                size="20px"
              )

            q-item-section
              q-item-label {{ subscription.subscription_type_name }}
              q-item-label.caption.text-grey-7 {{ subscription.subscription_type_description }}

            q-item-section(side)
              .text-weight-medium {{ formatPrice(subscription.price) }}
              .text-caption.text-grey-7 {{ currencySymbol }}/месяц

      template(v-else-if="error")
        .text-center.q-pa-md
          .text-negative Ошибка загрузки подписок
          .text-caption.text-grey-7.q-mt-sm {{ error }}

      template(v-else)
        .text-center.q-pa-md
          .text-grey-6 Нет активных подписок
          .text-caption.text-grey-7.q-mt-sm Подписки появятся после подключения услуг платформы
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useProviderSubscriptions } from 'src/features/Provider/model'
import { useSystemStore } from 'src/entities/System/model'
import { ColorCard } from 'src/shared/ui'
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits'

const {
  subscriptions,
  isLoading,
  error,
  loadSubscriptions
} = useProviderSubscriptions()
const { info } = useSystemStore()

// Загружаем подписки при монтировании
onMounted(async () => {
  await loadSubscriptions()
})

// Форматирование цены
const formatPrice = (price: number | string) => {
  const priceStr = typeof price === 'number' ? price.toString() : price
  const currencySymbol = info.symbols?.root_govern_symbol || 'AXON'
  return formatAsset2Digits(`${priceStr} ${currencySymbol}`)
}

// Получение символа валюты для отображения
const currencySymbol = computed(() => info.symbols?.root_govern_symbol || 'AXON')

// Получение иконки для статуса подписки
const getSubscriptionIcon = (subscription: any) => {
  // Если подписка триальная, показываем специальную иконку
  if (subscription.is_trial) {
    return 'local_offer'
  }

  // Для хостинга проверяем specific_data
  if (subscription.subscription_type_id === 1) {
    const specificData = subscription.specific_data
    if (specificData?.is_valid && specificData?.is_delegated) return 'check_circle'
    if (specificData?.progress > 0 && specificData?.progress < 100) return 'hourglass_top'
    return 'schedule'
  }

  // Для других типов подписок проверяем instance_status
  switch (subscription.instance_status) {
    case 'active': return 'check_circle'
    case 'pending': return 'schedule'
    case 'installing': return 'hourglass_top'
    case 'error': return 'error'
    case 'inactive': return 'pause_circle'
    default: return 'help'
  }
}

// Получение цвета для статуса подписки
const getSubscriptionColor = (subscription: any) => {
  // Если подписка триальная, показываем специальный цвет
  if (subscription.is_trial) {
    return 'info'
  }

  // Для хостинга проверяем specific_data
  if (subscription.subscription_type_id === 1) {
    const specificData = subscription.specific_data
    if (specificData?.is_valid && specificData?.is_delegated) return 'positive'
    if (specificData?.progress > 0 && specificData?.progress < 100) return 'warning'
    return 'grey'
  }

  // Для других типов подписок проверяем instance_status
  switch (subscription.instance_status) {
    case 'active': return 'positive'
    case 'pending': return 'grey'
    case 'installing': return 'warning'
    case 'error': return 'negative'
    case 'inactive': return 'grey'
    default: return 'grey'
  }
}

</script>

<style lang="scss" scoped>
.subscriptions-card {
  padding: 8px;

  // Переопределяем отступ ColorCard только для этого виджета
  :deep(.color-card) {
    margin-bottom: 0 !important;
  }

  .subscriptions-header {
    margin-bottom: 16px;

    .subscriptions-title {
      display: flex;
      align-items: center;
      font-size: 14px;
      font-weight: 600;
    }
  }

  .subscriptions-list {
    .q-list {
      background: transparent;
      border-radius: 8px;

      .q-item {
        padding: 12px 16px;
        border-radius: 8px;

        &:hover {
          background: rgba(255, 255, 255, 0.05);
        }
      }
    }
  }
}
</style>
