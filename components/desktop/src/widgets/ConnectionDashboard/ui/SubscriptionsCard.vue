<template lang="pug">
.subs-card
  BaseCard(title="Подписки" subtitle="Услуги провайдера, оплачиваемые членскими взносами")
    BaseBanner(v-if="error" variant="neg") Ошибка загрузки подписок: {{ error }}

    EmptyState(
      v-else-if="!isLoading && !subscriptions.length"
      title="Нет активных подписок"
      body="Подписки появятся после подключения услуг платформы"
    )
      template(#icon)
        q-icon(name="receipt_long" size="28px")

    BaseTable(
      v-else
      :columns="columns"
      :rows="subscriptions"
      row-key="id"
      :loading="isLoading"
      :skeleton-rows="3"
      min-width="520px"
    )
      template(#cell-name="{ row }")
        .subs-card__name {{ row.subscription_type_name }}
        .subs-card__desc(v-if="row.subscription_type_description") {{ row.subscription_type_description }}

      template(#cell-status="{ row }")
        BaseBadge(:variant="subscriptionStatusVariant(row.status)") {{ subscriptionStatusLabel(row.status) }}

      //- Три случая: услуга включена оператором (цена 0), пакетная услуга
      //- (документооборот — платится кратно пакету по мере расхода) и обычная
      //- повременная. Валюту печатает formatPrice, рядом её не дописываем.
      template(#cell-price="{ row }")
        template(v-if="isFree(row)")
          .subs-card__price.t-mono.t-num {{ formatPrice(0) }}
          .subs-card__period включено оператором
        template(v-else-if="isPackage(row)")
          .subs-card__price.t-mono.t-num {{ formatPrice(row.packages_current_period_amount || 0) }}
          .subs-card__period {{ packageBreakdown(row) }}
        template(v-else)
          .subs-card__price.t-mono.t-num {{ formatPrice(row.price) }}
          .subs-card__period в месяц

      //- Смена тарифа сервера — решение кооператива, не оператора: отсюда
      //- председатель апгрейдит свой узел; провайдер со своей стороны цену
      //- менять не вправе. Готовность узла здесь не проверяем: instance_status
      //- на подписку провайдер не кладёт (поле всегда пусто), а узел не в строю
      //- честно отклонит сам провайдер понятной ошибкой.
      template(#cell-actions="{ row }")
        BaseButton(
          v-if="isHosting(row)"
          variant="secondary"
          size="sm"
          type="button"
          @click="openUpgrade(row)"
        ) Сменить тариф

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
        :description="optionSpecs(opt)"
        :meta="optionPrice(opt)"
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
import {
  useProviderSubscriptions,
  useConnectionCatalog,
  type ProviderSubscription,
} from 'src/features/Provider/model'
import { useSystemStore } from 'src/entities/System/model'
import { subscriptionStatusLabel, subscriptionStatusVariant } from 'src/entities/Union'
import {
  BaseBadge,
  BaseBanner,
  BaseButton,
  BaseCard,
  BaseDialog,
  BaseRadioCard,
  BaseTable,
  EmptyState,
} from 'src/shared/ui/base'
import type { BaseTableColumn } from 'src/shared/ui/base'
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits'
import { client } from 'src/shared/api/client'
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts'

const { subscriptions, isLoading, error, loadSubscriptions } = useProviderSubscriptions()
const { catalog, load: loadCatalog } = useConnectionCatalog()
const { info } = useSystemStore()

onMounted(async () => {
  await loadSubscriptions()
})

// Ширины колонок фиксированы: цена и действие держат правый край, а название
// услуги забирает остаток — на узком экране включается прокрутка таблицы,
// а не наезд ячеек друг на друга.
const columns: BaseTableColumn<ProviderSubscription>[] = [
  { key: 'name', label: 'Услуга' },
  { key: 'status', label: 'Состояние', width: '170px' },
  { key: 'price', label: 'Стоимость', numeric: true, width: '170px', nowrap: true },
  { key: 'actions', label: '', width: '150px', align: 'right' },
]

// ── Смена тарифа сервера (решение кооператива) ─────────────────────────────
const upgradeOpen = ref(false)
const upgrading = ref(false)
const selectedTypeId = ref<number | null>(null)
const currentPrice = ref(0)

const isHosting = (sub: any): boolean => sub?.subscription_type_id === 1

// Epic 13 v5.1: пакетная подписка считает израсходованное из месячной квоты.
const isPackage = (sub: any): boolean => sub?.kind === 'package'

// Услуга с нулевой ценой — освобождение, назначенное оператором: оператор
// эмитирует AXON сам, у отдельных кооперативов ЭДО покрыт договорённостью, а
// ранние участники не подписывали соглашение на платный хостинг. Строку всё
// равно показываем: подписка у кооператива есть, просто встречного платежа нет.
const isFree = (sub: any): boolean => Number(sub?.price ?? 0) === 0

/**
 * Пакетная услуга платится кратно: цена одного пакета фиксирована, а сумма
 * месяца растёт по мере расхода — кончился ресурс, куплен ещё пакет. Поэтому
 * под суммой объясняем, из чего она сложилась и где потолок, выше которого
 * автоматика докупать не станет.
 */
const packageBreakdown = (sub: any): string => {
  const packagePrice = Number(sub?.price ?? 0)
  const spent = Number(sub?.packages_current_period_amount ?? 0)
  const quota = Number(sub?.monthly_quota_rub ?? 0)
  const packages = packagePrice > 0 ? Math.round(spent / packagePrice) : 0
  const quotaPart = quota > 0 ? ` · потолок ${formatPrice(quota)}` : ''
  if (packages > 0) {
    return `${packages} × ${formatPrice(packagePrice)}${quotaPart}`
  }
  return `${formatPrice(packagePrice)} за пакет${quotaPart}`
}

// Только дороже текущего: даунгрейд провайдер отклонит — диск нового сервера
// должен вмещать данные старого, поэтому и не предлагаем.
const upgradeOptions = computed(() =>
  (catalog.value?.server_options ?? []).filter((opt: any) => Number(opt.price) > currentPrice.value),
)

const optionSpecs = (opt: any): string => {
  const specs = opt.specs as Record<string, unknown> | null
  const parts: string[] = []
  if (specs?.cpu) parts.push(`${specs.cpu} CPU`)
  if (specs?.ram_gb) parts.push(`${specs.ram_gb} ГБ RAM`)
  if (specs?.disk) parts.push(String(specs.disk))
  return parts.join(' · ')
}

const optionPrice = (opt: any): string => `${formatPrice(opt.price)} в месяц`

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
      `Переход оформлен: новая цена ${formatPrice(result.new_price)} в месяц уже действует, ` +
        'система переедет на новый сервер в течение часа',
    )
    await loadSubscriptions()
  } catch (e: any) {
    FailAlert(e)
  } finally {
    upgrading.value = false
  }
}

// Сумма с валютой: «3 660,00 RUB». Символ печатает сам форматтер, поэтому
// рядом дописывать валюту нельзя — период пишется словами («в месяц»).
const formatPrice = (price: number | string): string => {
  const sym = info.symbols?.root_govern_symbol || 'AXON'
  return formatAsset2Digits(`${String(price)} ${sym}`)
}
</script>

<style scoped>
.subs-card__name {
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
}
.subs-card__desc {
  font-size: var(--p-fs-meta);
  color: var(--p-ink-2);
  margin-top: 2px;
}
.subs-card__price {
  font-size: var(--p-fs-h3);
  font-weight: 600;
  color: var(--p-ink);
}
.subs-card__period {
  font-size: var(--p-fs-meta);
  color: var(--p-ink-2);
  margin-top: 2px;
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
