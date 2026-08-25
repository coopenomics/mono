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
            //- Смена тарифа сервера — решение кооператива, не оператора:
            //- отсюда председатель апгрейдит свой узел; провайдер со своей
            //- стороны цену менять не вправе.
            BaseButton.subs-card__upgrade(
              v-if="isHosting(sub) && sub.instance_status === 'active'"
              variant="ghost"
              size="sm"
              type="button"
              @click="openUpgrade(sub)"
            ) Сменить тариф

    EmptyState(
      v-else
      title="Нет активных подписок"
      body="Подписки появятся после подключения услуг платформы"
    )

  //- Апгрейд сервера: конфигурация выбирается здесь, дальше провайдер сам
  //- переносит систему. Даунгрейд намеренно не предлагается — диск нового
  //- сервера должен вмещать данные текущего.
  BaseDialog(
    v-model="upgradeOpen"
    title="Сменить тариф сервера"
    size="md"
  )
    p.subs-card__dlg-text
      | Новая цена начнёт действовать сразу: неиспользованный остаток текущего
      | тарифа будет зачтён днями нового.
    BaseBanner(variant="warn")
      | Во время переезда система кооператива будет недоступна примерно час —
      | идут технические работы. После этого она откроется уже на новом сервере.
    .subs-card__dlg-options(v-if="upgradeOptions.length")
      BaseRadioCard(
        v-for="opt in upgradeOptions"
        :key="opt.instance_type_id"
        :model-value="selectedTypeId"
        :value="opt.instance_type_id"
        :title="opt.name"
        :description="optionSubtitle(opt)"
        @update:model-value="selectedTypeId = Number($event)"
      )
    EmptyState(
      v-else
      title="Тарифов мощнее нет"
      body="Сейчас вы на самой мощной конфигурации из каталога"
    )
    template(#footer)
      BaseButton(
        variant="ghost"
        type="button"
        :disabled="upgrading"
        @click="upgradeOpen = false"
      ) Отменить
      BaseButton(
        variant="primary"
        type="button"
        :loading="upgrading"
        :disabled="!selectedTypeId"
        @click="confirmUpgrade"
      ) Перейти на новый тариф
</template>

<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { Mutations } from '@coopenomics/sdk'
import { useProviderSubscriptions, useConnectionCatalog } from 'src/features/Provider/model'
import { useSystemStore } from 'src/entities/System/model'
import { BaseBanner, BaseButton, BaseCard, BaseDialog, BaseRadioCard, EmptyState } from 'src/shared/ui/base'
import Loader from 'src/shared/ui/Loader/Loader.vue'
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits'
import { client } from 'src/shared/api/client'
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts'

const { subscriptions, isLoading, error, loadSubscriptions } = useProviderSubscriptions()
const { catalog, load: loadCatalog } = useConnectionCatalog()
const { info } = useSystemStore()

onMounted(async () => {
  await loadSubscriptions()
})

// ── Смена тарифа сервера (решение кооператива) ─────────────────────────────
const upgradeOpen = ref(false)
const upgrading = ref(false)
const selectedTypeId = ref<number | null>(null)
const currentPrice = ref(0)

const isHosting = (sub: any): boolean => sub?.subscription_type_id === 1

// Только дороже текущего: даунгрейд провайдер отклонит — диск нового сервера
// должен вмещать данные старого, поэтому и не предлагаем.
const upgradeOptions = computed(() =>
  (catalog.value?.server_options ?? []).filter((opt: any) => Number(opt.price) > currentPrice.value),
)

const optionSubtitle = (opt: any): string => {
  const specs = opt.specs as Record<string, unknown> | null
  const parts: string[] = []
  if (specs?.cpu) parts.push(`${specs.cpu} CPU`)
  if (specs?.ram_gb) parts.push(`${specs.ram_gb} GB RAM`)
  if (specs?.disk) parts.push(String(specs.disk))
  parts.push(`${formatPrice(opt.price)} ${currencySymbol.value}/месяц`)
  return parts.join(' · ')
}

const openUpgrade = async (sub: any) => {
  currentPrice.value = Number(sub.price) || 0
  selectedTypeId.value = null
  upgradeOpen.value = true
  if (!catalog.value) await loadCatalog()
}

const confirmUpgrade = async () => {
  if (!selectedTypeId.value) return
  upgrading.value = true
  try {
    const { [Mutations.System.ChangeProviderHostingPlan.name]: result } = await client.Mutation(
      Mutations.System.ChangeProviderHostingPlan.mutation,
      { variables: { instanceTypeId: selectedTypeId.value } },
    )
    upgradeOpen.value = false
    SuccessAlert(
      `Переход оформлен: новая цена ${formatPrice(result.new_price)} ${currencySymbol.value}/месяц уже действует, ` +
        'система переедет на новый сервер в течение часа',
    )
    await loadSubscriptions()
  } catch (e: any) {
    FailAlert(e)
  } finally {
    upgrading.value = false
  }
}

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
.subs-card__upgrade {
  margin-top: var(--p-1);
}
.subs-card__dlg-text {
  margin: 0 0 var(--p-3);
}
.subs-card__dlg-options {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  margin-top: var(--p-3);
}
</style>
