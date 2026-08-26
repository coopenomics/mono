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
      :rows="orderedSubscriptions"
      row-key="id"
      :loading="isLoading"
      :skeleton-rows="3"
      min-width="520px"
    )
      template(#cell-name="{ row }")
        .subs-card__name {{ row.subscription_type_name }}
        .subs-card__desc(v-if="row.subscription_type_description") {{ row.subscription_type_description }}
        //- Текущая конфигурация и смена тарифа стоят здесь, а не отдельной
        //- колонкой: действие относится к самой услуге, а по одной цене
        //- кооператив не понимал, на каком сервере работает.
        //- Что входит в тариф — строкой под описанием: название конфигурации
        //- само по себе ничего не говорит, а сравнивать её с предложением о
        //- смене нужно здесь же.
        .subs-card__specs(v-if="isHosting(row) && planSpecs(row)") {{ planSpecs(row) }}
        .subs-card__plan(v-if="isHosting(row)")
          BaseChip(variant="neutral" size="sm") {{ planName(row) }}
          BaseButton(
            variant="secondary"
            size="sm"
            type="button"
            @click="openUpgrade(row)"
          ) Сменить тариф

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
  // Каталог нужен не только диалогу: по нему подписывается текущий тариф.
  await loadCatalog()
})

// Ширины колонок фиксированы: цена и действие держат правый край, а название
// услуги забирает остаток — на узком экране включается прокрутка таблицы,
// а не наезд ячеек друг на друга.
const columns: BaseTableColumn<ProviderSubscription>[] = [
  { key: 'name', label: 'Услуга' },
  { key: 'status', label: 'Состояние', width: '170px' },
  { key: 'price', label: 'Стоимость', numeric: true, width: '170px', nowrap: true },
]

// Порядок услуг в реестре: документооборот — основа участия и платится
// каждым, поэтому он первый; хостинг идёт следом, остальные услуги — за ними
// в том порядке, в каком их отдал провайдер.
const orderedSubscriptions = computed(() =>
  [...subscriptions.value].sort((a: any, b: any) => serviceRank(a) - serviceRank(b)),
)

const serviceRank = (sub: any): number => {
  if (isPackage(sub)) return 0
  if (isHosting(sub)) return 1
  return 2
}

/** Конфигурация подписки из каталога провайдера по её instance_type_id. */
const planOption = (sub: any): any =>
  (catalog.value?.server_options ?? []).find(
    (opt: any) => opt.instance_type_id === sub?.instance_type_id,
  )

/**
 * Имя текущей конфигурации сервера («Мощный»): цена сама по себе тариф не
 * называет, а кооперативу важно видеть, на чём он работает, прежде чем менять.
 */
const planName = (sub: any): string => {
  const option = planOption(sub)
  return option?.name ? `Тариф «${option.name}»` : 'Тариф не определён'
}

/** Характеристики текущей конфигурации — «4 CPU · 8 ГБ RAM · 120 GB». */
const planSpecs = (sub: any): string => {
  const option = planOption(sub)
  return option ? optionSpecs(option) : ''
}

/**
 * Объём накопителя конфигурации в гигабайтах. По нему решается, можно ли
 * перейти на тариф: перенос идёт слепком дисков, поэтому диск нового сервера
 * обязан быть больше текущего — в обратную сторону данные просто не поместятся.
 */
const diskGb = (opt: any): number => {
  const raw = String((opt?.specs as Record<string, unknown> | null)?.disk ?? '')
  const match = raw.match(/([\d.]+)\s*(TB|ТБ|GB|ГБ)?/i)
  if (!match) return 0
  const value = Number(match[1])
  if (!Number.isFinite(value)) return 0
  const unit = (match[2] ?? '').toUpperCase()
  return unit === 'TB' || unit === 'ТБ' ? value * 1024 : value
}

// ── Смена тарифа сервера (решение кооператива) ─────────────────────────────
const upgradeOpen = ref(false)
const upgrading = ref(false)
const selectedTypeId = ref<number | null>(null)
const currentPrice = ref(0)
const currentDiskGb = ref(0)

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
 * под суммой объясняем, из чего она сложилась. Потолка расхода нет: докупку
 * ограничивает баланс кошелька членских взносов.
 */
const packageBreakdown = (sub: any): string => {
  const packagePrice = Number(sub?.price ?? 0)
  const spent = Number(sub?.packages_current_period_amount ?? 0)
  const packages = packagePrice > 0 ? Math.round(spent / packagePrice) : 0
  if (packages > 0) {
    return `${packages} × ${formatPrice(packagePrice)} в этом месяце`
  }
  return `${formatPrice(packagePrice)} за пакет`
}

// Предлагаем только конфигурации с бо́льшим накопителем: перенос копирует диск
// целиком, поэтому на меньший он не встанет, а равный — это текущий тариф,
// менять его на себя же незачем. Если конфигурация подписки неизвестна
// (старые записи без instance_type_id), падаем на прежнее правило «дороже
// текущего» — лучше показать больше вариантов, чем пустой список.
const upgradeOptions = computed(() => {
  const options = catalog.value?.server_options ?? []
  if (currentDiskGb.value > 0) {
    return options.filter((opt: any) => diskGb(opt) > currentDiskGb.value)
  }
  return options.filter((opt: any) => Number(opt.price) > currentPrice.value)
})

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
  currentDiskGb.value = diskGb(planOption(sub))
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
/* Название и описание переносятся по словам: q-table держит ячейки в одну
   строку, и длинное описание услуги уезжало под соседние колонки. */
.subs-card__name {
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
  white-space: normal;
}
.subs-card__desc {
  font-size: var(--p-fs-meta);
  line-height: var(--p-lh-meta);
  color: var(--p-ink-2);
  margin-top: 2px;
  white-space: normal;
}
.subs-card__specs {
  font-size: var(--p-fs-meta);
  color: var(--p-ink-2);
  margin-top: var(--p-1);
  white-space: normal;
}
.subs-card__plan {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  margin-top: var(--p-2);
  flex-wrap: wrap;
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
