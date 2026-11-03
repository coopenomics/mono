<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useLiveReload } from 'src/shared/lib/realtime'
import { marketLiveTables } from 'src/shared/lib/marketplace'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { BaseButton, BaseDialog } from 'src/shared/ui/base'
import { AmountInput, PageHint } from 'src/shared/ui/domain'
import { TurnoverTop } from 'src/widgets/Marketplace/TurnoverTop'
import { listInventory, type MarketplaceInventoryItemView } from 'src/entities/MarketplaceInventory'
import {
  fetchOrdersForTurnover,
  type MarketplaceOrderListView,
} from 'src/entities/MarketplaceOrder'
import { formatAsset2Digits } from 'src/shared/lib/utils'
import {
  getEconomySettings,
  type MarketplaceEconomySettingsView,
  setAidLimit,
  setInitiatorShare,
  setMembershipFee,
} from '../api'
import { t } from 'src/shared/i18n';

/**
 * Стол администратора → «Экономика» (requirement b6; коэффициент
 * экономического участия — задача 99D-23). Три настройки модели кооператива,
 * единые для всех участков:
 *
 *  - ставка обеспечительной части паевого взноса — доля от стоимости заказа;
 *  - доля инициатора участка в экономии месяца — остальное возвращается
 *    пайщикам на свободный паевой Стола заказов;
 *  - потолок резерва социально-экономического обеспечения пайщиков на одного
 *    получателя в месяц — предел строки, которую задаёт председатель участка.
 *
 * Проценты фондов накопления здесь только читаются: ими распоряжается совет.
 *
 * Паттерн «настройка-значение» как в банковских приложениях: значение
 * показывается статичным крупным числом (не полем-инпутом), правка — в
 * отдельном сфокусированном диалоге. Так экран не «прыгает» при переходе
 * просмотр↔правка и не притворяется формой там, где меняют одну цифру.
 */

type SettingKey = 'fee' | 'initiator' | 'aidLimit'

interface SettingCard {
  key: SettingKey
  label: string
  /** Отформатированное значение без единицы. */
  value: string
  unit: string
  caption: string
}

const loading = ref(false)
const saving = ref(false)
const dialogOpen = ref(false)
const editing = ref<SettingKey>('fee')
const settings = ref<MarketplaceEconomySettingsView | null>(null)
const draft = ref<number>(0)

function percentText(value: number | undefined): string {
  return (value ?? 0).toFixed(2).replace('.', ',')
}

function assetAmount(asset: string | undefined): number {
  return Number.parseFloat(asset?.split(' ')[0] ?? '0') || 0
}

function assetSymbol(asset: string | undefined): string {
  return asset?.split(' ')[1] ?? ''
}

const cards = computed<SettingCard[]>(() => [
  {
    key: 'fee',
    label: t('marketplace.marketEconomy.feeLabel'),
    value: percentText(settings.value?.membership_fee_percent),
    unit: '%',
    caption: t('marketplace.marketEconomy.statSubtitle'),
  },
  {
    key: 'initiator',
    label: t('marketplace.marketEconomy.initiatorShareLabel'),
    value: percentText(settings.value?.initiator_share_percent),
    unit: '%',
    caption: t('marketplace.marketEconomy.initiatorShareSubtitle'),
  },
  {
    key: 'aidLimit',
    label: t('marketplace.marketEconomy.aidLimitLabel'),
    value: formatAsset2Digits(settings.value?.aid_month_limit ?? '0.0000 RUB').split(' ')[0] || '0,00',
    unit: assetSymbol(settings.value?.aid_month_limit),
    caption: assetAmount(settings.value?.aid_month_limit) > 0
      ? t('marketplace.marketEconomy.aidLimitSubtitle')
      : t('marketplace.marketEconomy.aidLimitDisabledSubtitle'),
  },
])

/** Фонды накопления одной строкой: «Неделимый фонд 1 %, Резервный фонд 15 %, …». */
const fundsLine = computed(() => {
  const funds = settings.value?.funds ?? []
  if (!funds.length) return t('marketplace.marketEconomy.fundsEmpty')
  const parts = funds.map((f) => `${f.name} ${percentText(f.percent).replace(',00', '')} %`)
  return t('marketplace.marketEconomy.fundsLine', { funds: parts.join(', '), total: percentText(settings.value?.funds_percent).replace(',00', '') })
})

const currentValue = computed<number>(() => {
  const s = settings.value
  if (!s) return 0
  switch (editing.value) {
    case 'fee': return s.membership_fee_percent
    case 'initiator': return s.initiator_share_percent
    default: return assetAmount(s.aid_month_limit)
  }
})

const changed = computed(() => Number(draft.value) !== currentValue.value)
const editingCard = computed(() => cards.value.find((c) => c.key === editing.value) ?? cards.value[0])
const dialogSymbol = computed(() => (editing.value === 'aidLimit' ? assetSymbol(settings.value?.aid_month_limit) : '%'))
const dialogMax = computed(() => (editing.value === 'aidLimit' ? undefined : 100))
const dialogHint = computed(() =>
  editing.value === 'fee'
    ? t('marketplace.marketEconomy.dialogHint')
    : t('marketplace.marketEconomy.periodSettingsHint'),
)

async function load(): Promise<void> {
  loading.value = true
  try {
    settings.value = await getEconomySettings()
  } catch (e) {
    FailAlert(e, t('marketplace.marketEconomy.loadFailedError'))
  } finally {
    loading.value = false
  }
}

function openDialog(key: SettingKey): void {
  editing.value = key
  draft.value = currentValue.value
  dialogOpen.value = true
}

async function onSave(): Promise<void> {
  saving.value = true
  const value = Number(draft.value)
  try {
    switch (editing.value) {
      case 'fee': {
        const config = await setMembershipFee({ membership_fee_percent: value })
        if (settings.value) settings.value = { ...settings.value, membership_fee_percent: config.membership_fee_percent }
        SuccessAlert(t('marketplace.marketEconomy.setSuccess'))
        break
      }
      case 'initiator':
        settings.value = await setInitiatorShare({ initiator_share_percent: value })
        SuccessAlert(t('marketplace.marketEconomy.initiatorShareSetSuccess'))
        break
      default:
        settings.value = await setAidLimit({ aid_month_limit: value })
        SuccessAlert(t('marketplace.marketEconomy.aidLimitSetSuccess'))
    }
    dialogOpen.value = false
  } catch (e) {
    FailAlert(e, t('marketplace.marketEconomy.setFailedError'))
  } finally {
    saving.value = false
  }
}

// ─── Топ позиций по обороту ───
// Оборот считает общий раздел (виджет TurnoverTop) — тот же, что на
// «Экономике участка»: приход по приёмкам склада, выдача по исполненным
// заказам. Страница отвечает только за то, чьи данные в него положить: здесь
// это весь кооператив.

const periodDays = ref<number>(30)
const inventory = ref<MarketplaceInventoryItemView[]>([])
const orders = ref<MarketplaceOrderListView[]>([])
const turnoverLoading = ref(true)

/** Сколько исполненных заказов забираем под свод: хвост старше периода не нужен. */
const TURNOVER_ORDERS_LIMIT = 500

/** `silent` — перечитывание по ленте: свод обновляется на месте, без скелетона. */
async function loadTurnover(silent = false): Promise<void> {
  if (!silent) turnoverLoading.value = true
  try {
    const [inventoryRows, orderRows] = await Promise.all([
      listInventory(),
      fetchOrdersForTurnover({ limit: TURNOVER_ORDERS_LIMIT }),
    ])
    inventory.value = inventoryRows
    orders.value = orderRows
  } catch (e) {
    FailAlert(e, t('marketplace.marketEconomy.loadTurnoverFailedError'))
  } finally {
    turnoverLoading.value = false
  }
}

onMounted(() => {
  void load()
  void loadTurnover()
})

// Настройки модели живут в цепи (marketplace::config, branch::brnconfig,
// реестр фондов fund::funds), свод оборота — в базе стола: приёмки склада и
// исполненные заказы.
useLiveReload(marketLiveTables('economy'), load)
useLiveReload(marketLiveTables('order', 'warehouse'), () => loadTurnover(true))
</script>

<template lang="pug">
q-page.admin-economy
  PageHint(storage-key='mp:admin-economy:banner-dismissed')
    | {{ $t('marketplace.marketEconomy.intro') }}
    | {{ $t('marketplace.marketEconomy.introPeriod') }}

  //- Три настройки одной сеткой: одинаковые карточки «подпись — число — пояснение»,
  //- правка каждой — в своём диалоге.
  .admin-economy__cards
    .admin-economy__card(v-for='card in cards', :key='card.key', :data-setting='card.key')
      .admin-economy__stat
        .admin-economy__label {{ card.label }}
        .admin-economy__value
          span.admin-economy__amount {{ card.value }}
          span.admin-economy__unit {{ card.unit }}
        .admin-economy__caption {{ card.caption }}
      BaseButton.admin-economy__edit(
        variant='secondary',
        size='sm',
        :disabled='loading',
        @click='openDialog(card.key)'
      )
        template(#icon-left)
          q-icon(name='edit', size='16px')
        | {{ $t('marketplace.marketEconomy.editButton') }}

  //- Проценты фондов накопления — для чтения: ими распоряжается совет.
  .admin-economy__funds
    q-icon(name='account_balance', size='18px')
    span {{ fundsLine }}
    span.admin-economy__funds-note {{ $t('marketplace.marketEconomy.fundsNote') }}

  TurnoverTop(
    v-model='periodDays',
    :inventory='inventory',
    :orders='orders',
    :loading='turnoverLoading'
  )

  BaseDialog(v-model='dialogOpen', :title='editingCard.label', size='sm')
    p.admin-economy__dialog-hint {{ dialogHint }}
    AmountInput(
      v-model='draft',
      :label='editingCard.label',
      :symbol='dialogSymbol',
      :precision='2',
      :min='0',
      :max='dialogMax',
      :disabled='saving'
    )
    template(#footer)
      BaseButton(variant='ghost', :disabled='saving', @click='dialogOpen = false') {{ $t('common.action.cancel') }}
      BaseButton(
        variant='primary',
        :loading='saving',
        :disabled='!changed',
        @click='onSave'
      ) {{ $t('common.action.save') }}
</template>

<style scoped lang="scss">
.admin-economy {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--p-4, 16px);
  }

  &__card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-4, 16px);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    background: var(--p-surface);
    padding: var(--p-5, 20px) var(--p-6, 24px);
  }

  &__label {
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm, 13px);
    margin-bottom: var(--p-1, 4px);
  }

  &__caption {
    margin-top: var(--p-1, 4px);
    color: var(--p-ink-3);
    font-size: var(--p-fs-body-sm, 13px);
    line-height: var(--p-lh-body-sm, 1.5);
  }

  &__value {
    display: flex;
    align-items: baseline;
    gap: var(--p-1, 4px);
    color: var(--p-ink);
  }

  &__amount {
    font-size: var(--p-fs-h1, 24px);
    line-height: var(--p-lh-h1, 1.2);
    letter-spacing: var(--p-ls-h1, -0.018em);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    font-feature-settings: 'tnum' 1;
  }

  &__unit {
    font-size: var(--p-fs-h3, 15px);
    font-weight: 500;
    color: var(--p-ink-2);
  }

  &__edit {
    flex-shrink: 0;
  }

  &__funds {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--p-2, 8px);
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm, 13px);
    line-height: var(--p-lh-body-sm, 1.5);
  }

  &__funds-note {
    color: var(--p-ink-3);
  }

  &__dialog-hint {
    margin: 0;
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm, 13px);
    line-height: var(--p-lh-body-sm, 1.5);
  }
}

@media (max-width: 599px) {
  .admin-economy {
    padding: var(--p-4, 16px);
  }
}
</style>
