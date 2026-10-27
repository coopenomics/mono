<template lang="pug">
//- Реестр подписок кооператива у провайдера. Записи сравнивают по колонкам
//- (состояние над состоянием, сумма над суммой), поэтому это таблица, и она
//- лежит на странице сама: рамки в рамке и заголовка-дубля нет (27.10.2026).
.subs-card
  PageHint(storage-key="connection:subscriptions:hint") {{ $t('connectionDashboard.subscriptionsCard.subtitle') }}

  BaseBanner(v-if="error" variant="neg") {{ $t('connectionDashboard.subscriptionsCard.loadErrorWithReason', { error }) }}

  EmptyState(
    v-else-if="!firstLoad && !orderedSubscriptions.length"
    :title="$t('connectionDashboard.subscriptionsCard.emptyTitle')"
    :body="$t('connectionDashboard.subscriptionsCard.emptyBody')"
  )
    template(#icon)
      q-icon(name="receipt_long" size="28px")

  BaseTable(
    v-else
    :columns="columns"
    :rows="orderedSubscriptions"
    row-key="id"
    :loading="firstLoad"
    :skeleton-rows="3"
    min-width="720px"
  )
    //- Опознание: название, мета-строка (пакет; тариф и конфигурация), описание.
    template(#cell-name="{ row }")
      .subs-row__title {{ rowTitle(row) }}
      .subs-row__meta(v-if="rowMeta(row).length")
        template(v-for="(part, i) in rowMeta(row)" :key="i")
          span.subs-row__sep(v-if="i > 0" aria-hidden="true") ·
          span(:class="{ 't-mono': isCatalogApp(row) && i === 0 }") {{ part }}
      .subs-row__desc(v-if="rowDescription(row)") {{ rowDescription(row) }}
      //- Смена тарифа относится к серверу и стоит в его строке: отдельная
      //- колонка действия держала бы пустое место у всех остальных подписок.
      .subs-row__action(v-if="isHosting(row)")
        BaseButton(variant="secondary" size="sm" type="button" @click="openUpgrade(row)") {{ $t('connectionDashboard.subscriptionsCard.changePlan') }}

    //- Состояние: бейдж один раз, под ним только новое — срок пробного периода.
    template(#cell-status="{ row }")
      BaseBadge(:variant="subscriptionStatusVariant(row.status)") {{ subscriptionStatusLabel(row.status) }}
      .subs-row__period(v-if="trialEndsOn(row)") {{ $t('connectionDashboard.subscriptionsCard.trialUntil', { date: trialEndsOn(row) }) }}

    //- Деньги: сумма, под ней период, «включено оператором» или кванты сверх объёма.
    template(#cell-price="{ row }")
      .subs-row__sum.t-mono.t-num {{ formatPrice(isFree(row) ? 0 : row.price) }}
      .subs-row__period {{ priceNote(row) }}

    //- Итог: сколько кооператив платит за платформу в месяц. По строкам это
    //- не складывалось в голове, а именно эта сумма нужна, чтобы держать
    //- кошелёк наполненным.
    template(#footer)
      .subs-card__total
        .subs-card__total-label
          | {{ $t('connectionDashboard.subscriptionsCard.totalPerMonth') }}
          .subs-row__period(v-if="hasPackage") {{ $t('connectionDashboard.subscriptionsCard.docflowQuantNote', { price: formatPrice(QUANT_PRICE_RUB), quant: AXON_QUANT }) }}
        .subs-card__total-value
          .subs-row__sum.t-mono.t-num {{ formatPrice(summary.monthlyTotal) }}
          .subs-row__period {{ $t('connectionDashboard.subscriptionsCard.perMonth') }}

  //- Апгрейд сервера: конфигурация выбирается здесь, дальше провайдер сам
  //- переносит систему. Даунгрейд намеренно не предлагается — диск нового
  //- сервера должен вмещать данные текущего.
  BaseDialog(
    v-model="upgradeOpen"
    :title="hasTariffGrid ? $t('connectionDashboard.subscriptionsCard.changeTariffDialogTitle') : $t('connectionDashboard.subscriptionsCard.changePlanDialogTitle')"
    size="md"
  )
    p.subs-card__dlg-text
      | {{ $t('connectionDashboard.subscriptionsCard.changePlanLine1') }}
      | {{ $t('connectionDashboard.subscriptionsCard.changePlanLine2') }}
    //- Тарифная сетка: переезд нужен не каждому тарифу — предупреждаем условно.
    BaseBanner(v-if="hasTariffGrid" variant="warn") {{ $t('connectionDashboard.subscriptionsCard.downtimeIfServerChanges') }}
    BaseBanner(v-else variant="warn")
      | {{ $t('connectionDashboard.subscriptionsCard.downtimeLine1') }}
      | {{ $t('connectionDashboard.subscriptionsCard.downtimeLine2') }}
    .subs-card__dlg-options(v-if="hasTariffGrid && tariffUpgradeOptions.length")
      BaseRadioCard(
        v-for="opt in tariffUpgradeOptions"
        :key="opt.id"
        :model-value="selectedTariffCode"
        :value="opt.id"
        :title="opt.name"
        :description="tariffOptionLine(opt)"
        :meta="tariffOptionPrice(opt)"
        @update:model-value="selectedTariffCode = String($event)"
      )
    .subs-card__dlg-options(v-else-if="!hasTariffGrid && upgradeOptions.length")
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
      :title="$t('connectionDashboard.subscriptionsCard.noUpgradeTitle')"
      :body="hasTariffGrid ? $t('connectionDashboard.subscriptionsCard.noTariffUpgradeBody') : $t('connectionDashboard.subscriptionsCard.noUpgradeBody')"
    )
    template(#footer)
      BaseButton(
        variant="ghost"
        type="button"
        :disabled="upgrading"
        @click="upgradeOpen = false"
      ) {{ $t('connectionDashboard.subscriptionsCard.cancel') }}
      BaseButton(
        variant="primary"
        type="button"
        :loading="upgrading"
        :disabled="hasTariffGrid ? !selectedTariffCode : !selectedTypeId"
        @click="hasTariffGrid ? confirmTariffChange() : confirmUpgrade()"
      ) {{ $t('connectionDashboard.subscriptionsCard.confirmUpgrade') }}
</template>

<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { Mutations } from '@coopenomics/sdk'
import {
  useProviderSubscriptions,
  useConnectionCatalog,
  summarizeSubscriptions,
  isYearlySubscription,
} from 'src/features/Provider/model'
import { useSessionStore } from 'src/entities/Session'
import type { ITariff } from 'src/entities/ConnectionAgreement'
import { tariffVolumeBreakdown } from 'src/shared/lib/axon'
import { useSystemStore } from 'src/entities/System/model'
import { subscriptionStatusLabel, subscriptionStatusVariant } from 'src/entities/Union'
import {
  BaseBadge,
  BaseBanner,
  BaseButton,
  BaseDialog,
  BaseRadioCard,
  BaseTable,
  EmptyState,
} from 'src/shared/ui/base'
import type { BaseTableColumn } from 'src/shared/ui/base'
import { PageHint } from 'src/shared/ui/domain'
import { useFirstLoad } from 'src/shared/lib/composables'
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits'
import { client } from 'src/shared/api/client'
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts'
import { AXON_PRICE_RUB, AXON_QUANT, QUANT_PRICE_RUB } from 'src/shared/lib/axon'
import { t } from 'src/shared/i18n';
import { formatDateToLocalTimezone } from 'src/shared/lib/utils/dates/timezone'

const { subscriptions, isLoading, error, loadSubscriptions } = useProviderSubscriptions()
// Каркас — только при первой загрузке; дочитки обновляют список молча.
const firstLoad = useFirstLoad(isLoading)
const { catalog, load: loadCatalog, connectionTariffs, currentTariff } = useConnectionCatalog()
const session = useSessionStore()
const { info } = useSystemStore()

// Загружаем подписки при монтировании
// realtime: нет источника — подписки кооператива ведёт сервер провайдера (другой узел), в ленте кооператива их нет.
onMounted(async () => {
  await loadSubscriptions()
  // Каталог нужен не только диалогу: по нему подписывается текущий тариф.
  // С именем кооператива провайдер отдаёт и его тариф сетки.
  await loadCatalog(true, session.username)
})


// Порядок услуг в реестре: документооборот — основа участия и платится
// каждым, поэтому он первый; хостинг идёт следом, остальные услуги — за ними
// в том порядке, в каком их отдал провайдер.
// Отменённые подписки в реестре не показываются (26.10.2026): кооператив
// видит только то, за что платит; история списаний — отдельной вкладкой.
const orderedSubscriptions = computed(() =>
  subscriptions.value
    .filter((s: any) => !String(s?.status ?? '').toLowerCase().startsWith('cancel'))
    .sort((a: any, b: any) => serviceRank(a) - serviceRank(b)),
)

/** Подписка на приложение каталога: код типа `catalog:@scope/name`. */
const isCatalogApp = (sub: any): boolean => String(sub?.subscription_type_code ?? '').startsWith('catalog:')

/** Название строки: у приложения — имя пакета с прописной, у услуг — название типа. */
const rowTitle = (sub: any): string => {
  if (!isCatalogApp(sub)) return String(sub?.subscription_type_name ?? '')
  const tail = String(sub.subscription_type_code).split('/').pop() ?? ''
  return tail.charAt(0).toUpperCase() + tail.slice(1)
}

// Ширины колонок фиксированы: состояние и сумма держат правый край и стоят
// колонкой строка в строку, название забирает остаток.
const columns: BaseTableColumn<any>[] = [
  { key: 'name', label: t('connectionDashboard.subscriptionsCard.column.service') },
  { key: 'status', label: t('connectionDashboard.subscriptionsCard.column.status'), width: '150px', nowrap: true },
  { key: 'price', label: t('connectionDashboard.subscriptionsCard.column.price'), numeric: true, width: '170px' },
]

/**
 * Мета-строка под названием: у приложения — имя пакета, у сервера — тариф и
 * конфигурация. Номер, идентификатор и тариф не растут в плитку: они идут
 * второй строкой через «·» (канон строки).
 */
const rowMeta = (sub: any): string[] => {
  if (isCatalogApp(sub)) return [String(sub.subscription_type_code).slice('catalog:'.length)]
  if (isHosting(sub)) return [planName(sub), planSpecs(sub)].filter(Boolean)
  return []
}

/** Подпись под суммой: период, «включено оператором» или кванты сверх объёма. */
const priceNote = (sub: any): string => {
  if (isFree(sub)) return t('connectionDashboard.subscriptionsCard.includedByOperator')
  if (isPackage(sub)) return packageBreakdown(sub)
  return isYearlySubscription(sub)
    ? t('connectionDashboard.subscriptionsCard.perYear')
    : t('connectionDashboard.subscriptionsCard.perMonth')
}

// Плата за месяц по всем платным услугам — считает общий helper, тот же, что
// показывает сумму к оплате при просрочке.
const summary = computed(() => summarizeSubscriptions(subscriptions.value))

const hasPackage = computed(() => subscriptions.value.some((s: any) => isPackage(s)))

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
  if (currentTariff.value) return t('connectionDashboard.subscriptionsCard.planName', { name: currentTariff.value.name })
  const option = planOption(sub)
  return option?.name ? t('connectionDashboard.subscriptionsCard.planName', { name: option.name }) : t('connectionDashboard.subscriptionsCard.planUnknown')
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
  // i18n-ignore: сравнение единицы объёма диска — логика, а не текст интерфейса
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
 * Документооборот (@ant 17.10.2026): цена строки платится раз в месяц по дате,
 * и в бак кооператива приходит объём месяца в AXON. Сверх объёма идут кванты
 * по 5 AXON за 50 ₽, когда бак ниже кванта. Правило словами — иначе списание
 * «ещё 50 ₽» выглядит необъяснимым. Порог приходит с хаба; без него правило
 * не пишем — выдумывать число нельзя.
 */
const packageRule = (sub: any): string => {
  if (!isPackage(sub)) return ''
  const threshold = Number(sub?.package_low_water_axon ?? 0)
  if (!Number.isFinite(threshold) || threshold <= 0) return ''
  return t('connectionDashboard.subscriptionsCard.nextPackageHint', {
    axon: formatAxonCount(Number(sub?.price ?? 0) / AXON_PRICE_RUB),
    price: formatPrice(QUANT_PRICE_RUB),
    quant: AXON_QUANT,
    threshold,
  })
}

/** Число AXON без валюты: formatPrice дописал бы «RUB» к количеству токенов. */
const formatAxonCount = (value: number): string =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 4 }).format(value)

/** Описание услуги, у документооборота — вместе с правилом объёма. */
const rowDescription = (sub: any): string =>
  isCatalogApp(sub)
    ? t('connectionDashboard.subscriptionsCard.appFromCatalog')
    : [sub?.subscription_type_description, packageRule(sub)].filter(Boolean).join(' ')

/**
 * Дата окончания пробного периода. У пробной подписки провайдер ставит
 * expires_at = начало + trial_days, после неё начинаются списания.
 */
const trialEndsOn = (sub: any): string => {
  if (!sub?.is_trial || !sub?.expires_at) return ''
  return formatDateToLocalTimezone(sub.expires_at, 'DD.MM.YYYY')
}

/** Под ценой месяца — сколько квантов сверх тарифа ушло в этом месяце. */
const packageBreakdown = (sub: any): string => {
  const spent = Number(sub?.packages_current_period_amount ?? 0)
  const quants = QUANT_PRICE_RUB > 0 ? Math.round(spent / QUANT_PRICE_RUB) : 0
  if (quants > 0) {
    return t('connectionDashboard.subscriptionsCard.quantsThisMonth', { quants, price: formatPrice(spent) })
  }
  return t('connectionDashboard.subscriptionsCard.perMonth')
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
  if (specs?.ram_gb) parts.push(t('connectionDashboard.subscriptionsCard.ramGb', { ram: specs.ram_gb }))
  if (specs?.disk) parts.push(String(specs.disk))
  return parts.join(' · ')
}

const optionPrice = (opt: any): string => t('connectionDashboard.subscriptionsCard.pricePerMonth', { price: formatPrice(opt.price) })

const openUpgrade = async (sub: any) => {
  currentPrice.value = Number(sub.price) || 0
  selectedTypeId.value = null
  selectedTariffCode.value = null
  upgradeOpen.value = true
  if (!catalog.value) await loadCatalog()
  currentDiskGb.value = diskGb(planOption(sub))
}

// ── Смена тарифа сетки (16.10.2026) ─────────────────────────────────────────
// Сетка есть — меняется тариф целиком: сервер, поддержка, приложение и пакет.
// Предлагаются только тарифы дороже текущего: сервер переносится слепком
// диска и на меньший не встанет. Кооператив без тарифа видит всю сетку.
const hasTariffGrid = computed(() => connectionTariffs.value.length > 0)
const selectedTariffCode = ref<string | null>(null)

const tariffUpgradeOptions = computed<ITariff[]>(() => {
  const current = currentTariff.value
  if (!current) return connectionTariffs.value
  return connectionTariffs.value.filter((opt) => (opt.monthlyTotal ?? 0) > (current.monthlyTotal ?? 0))
})

const tariffOptionLine = (opt: ITariff): string =>
  t('connectionDashboard.subscriptionsCard.tariffOptionLine', {
    ...tariffVolumeBreakdown(opt.docflowAxon ?? 0),
    response: opt.supportResponse ?? '',
  })

// Цена — за тот же период, которым кооператив платит сейчас.
const tariffOptionPrice = (opt: ITariff): string =>
  currentTariff.value?.billingPeriod === 'year' && opt.annualTotal != null
    ? t('connectionDashboard.subscriptionsCard.pricePerYear', { price: formatPrice(opt.annualTotal) })
    : t('connectionDashboard.subscriptionsCard.pricePerMonth', { price: formatPrice(opt.monthlyTotal ?? 0) })

const confirmTariffChange = async () => {
  const code = selectedTariffCode.value
  if (!code) return
  upgrading.value = true
  try {
    const { [Mutations.System.ChangeProviderTariff.name]: result } = await client.Mutation(
      Mutations.System.ChangeProviderTariff.mutation,
      { variables: { tariffCode: code } },
    )
    upgradeOpen.value = false
    const name = connectionTariffs.value.find((opt) => opt.code === code)?.name ?? code
    SuccessAlert(
      t('connectionDashboard.subscriptionsCard.tariffChangeDone', { name }) +
        (result.migration_state !== 'none' ? t('connectionDashboard.subscriptionsCard.tariffChangeMigration') : ''),
    )
    await loadSubscriptions()
    await loadCatalog(true, session.username)
  } catch (e: any) {
    FailAlert(e)
  } finally {
    upgrading.value = false
  }
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
      t('connectionDashboard.subscriptionsCard.upgradeDoneLine1', { price: formatPrice(result.new_price) }) +
        t('connectionDashboard.subscriptionsCard.upgradeDoneLine2'),
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

<style scoped lang="scss">
.subs-card {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}

// Ячейка названия: заголовок, мета-строка, описание — переносятся по словам,
// q-table сам держит ячейки в одну строку.
.subs-row__title {
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
  white-space: normal;
}
.subs-row__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 2px var(--p-2);
  margin-top: 2px;
  font-size: var(--p-fs-meta);
  color: var(--p-ink-2);
  white-space: normal;
}
.subs-row__sep {
  color: var(--p-ink-3);
}
.subs-row__desc {
  margin-top: var(--p-1);
  font-size: var(--p-fs-meta);
  line-height: var(--p-lh-meta);
  color: var(--p-ink-2);
  white-space: normal;
  max-width: 60ch;
}
.subs-row__action {
  margin-top: var(--p-2);
}
.subs-row__sum {
  font-size: var(--p-fs-h3);
  font-weight: 600;
  color: var(--p-ink);
  // Сумму не ломаем: «3 660,00» в две строки читается как две суммы.
  white-space: nowrap;
}
.subs-row__period {
  margin-top: 2px;
  font-size: var(--p-fs-meta);
  line-height: var(--p-lh-tight, 1.3);
  color: var(--p-ink-2);
  white-space: normal;
}
.subs-card__total {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--p-3);
  width: 100%;
  padding: var(--p-2) 0;
}
.subs-card__total-label {
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
}
.subs-card__total-value {
  text-align: right;
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
