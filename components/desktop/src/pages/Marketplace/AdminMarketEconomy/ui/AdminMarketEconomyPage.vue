<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useLiveReload } from 'src/shared/lib/realtime'
import { marketLiveTables } from 'src/shared/lib/marketplace'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { BaseButton, BaseDialog } from 'src/shared/ui/base'
import { AmountInput, PageHint, StatStrip, type StatStripItem } from 'src/shared/ui/domain'
import { useFirstLoad } from 'src/shared/lib/composables'
import { TurnoverTop } from 'src/widgets/Marketplace/TurnoverTop'
import { OfferRegistryOverlay } from 'src/widgets/Marketplace/OfferRegistryOverlay'
import { useSystemStore } from 'src/entities/System/model'
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
 * Раскладка (замечание владельца 04.11.2026): настройки и фонды — одним рядом
 * общих плиток чисел `StatStrip`: короткая подпись, число крупно, пояснение
 * строкой ниже, подробности — подсказкой у подписи. Правка — карандашом у
 * числа, в отдельном диалоге: экран не притворяется формой там, где меняют
 * одну цифру.
 */

type SettingKey = 'fee' | 'initiator' | 'aidLimit'

const { info } = useSystemStore()

const loading = ref(true)
const firstLoad = useFirstLoad(loading)
const saving = ref(false)
const dialogOpen = ref(false)
const editing = ref<SettingKey>('fee')
const settings = ref<MarketplaceEconomySettingsView | null>(null)
const draft = ref<number>(0)

function assetAmount(asset: string | undefined): number {
  return Number.parseFloat(asset?.split(' ')[0] ?? '0') || 0
}

function assetSymbol(asset: string | undefined): string {
  return asset?.split(' ')[1] ?? ''
}

/** Полное название настройки — заголовок и подпись поля диалога правки. */
const SETTING_LABELS: Record<SettingKey, string> = {
  fee: t('marketplace.marketEconomy.feeLabel'),
  initiator: t('marketplace.marketEconomy.initiatorShareLabel'),
  aidLimit: t('marketplace.marketEconomy.aidLimitLabel'),
}

/** Процент без лишних нулей: 38 → «38», 61,80 → «61,8». */
function percentShort(value: number | undefined): string {
  return Number(value ?? 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 })
}

/** Состав фондов накопления для подсказки: «Неделимый фонд 1 %, Резервный фонд 15 %, …». */
const fundsHint = computed(() => {
  const funds = settings.value?.funds ?? []
  if (!funds.length) return t('marketplace.marketEconomy.fundsEmpty')
  const parts = funds.map((f) => `${f.name} ${percentShort(f.percent)} %`)
  return t('marketplace.marketEconomy.fundsHint', { funds: parts.join(', ') })
})

/** Плитки по пути денег заказа: ставка → доля инициатора в экономии → потолок резерва → фонды. */
const tiles = computed<StatStripItem[]>(() => {
  const s = settings.value
  const limitOn = assetAmount(s?.aid_month_limit) > 0
  return [
    {
      key: 'fee',
      caption: t('marketplace.marketEconomy.feeTileCaption'),
      value: percentShort(s?.membership_fee_percent),
      symbol: '%',
      sub: t('marketplace.marketEconomy.feeTileSub'),
      hint: t('marketplace.marketEconomy.feeTileHint'),
      icon: 'receipt_long',
      editLabel: t('marketplace.marketEconomy.feeLabel'),
    },
    {
      key: 'initiator',
      caption: t('marketplace.marketEconomy.initiatorTileCaption'),
      value: percentShort(s?.initiator_share_percent),
      symbol: '%',
      sub: t('marketplace.marketEconomy.initiatorShareSubtitle'),
      hint: t('marketplace.marketEconomy.periodSettingsHint'),
      icon: 'trending_up',
      editLabel: t('marketplace.marketEconomy.initiatorShareLabel'),
    },
    {
      key: 'aidLimit',
      caption: t('marketplace.marketEconomy.aidLimitTileCaption'),
      value: formatAsset2Digits(s?.aid_month_limit ?? '0.0000 RUB').split(' ')[0] || '0,00',
      symbol: assetSymbol(s?.aid_month_limit),
      sub: limitOn ? t('marketplace.marketEconomy.aidLimitTileSub') : t('marketplace.marketEconomy.aidLimitTileOffSub'),
      hint: t('marketplace.marketEconomy.aidLimitTileHint'),
      icon: 'volunteer_activism',
      editLabel: t('marketplace.marketEconomy.aidLimitLabel'),
    },
    {
      key: 'funds',
      caption: t('marketplace.marketEconomy.fundsTileCaption'),
      value: percentShort(s?.funds_percent),
      symbol: '%',
      sub: t('marketplace.marketEconomy.fundsTileSub'),
      hint: fundsHint.value,
      icon: 'account_balance',
    },
  ]
})

function onEditTile(key: string): void {
  if (key === 'fee' || key === 'initiator' || key === 'aidLimit') openDialog(key)
}

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
const dialogTitle = computed(() => SETTING_LABELS[editing.value])
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

  //- Модель кооператива одним рядом плиток: три настройки администратора
  //- (правка — карандашом у числа, своим диалогом) и проценты фондов накопления
  //- только для чтения — ими распоряжается совет. Подробности — подсказкой у подписи.
  StatStrip(:items='tiles' :loading='firstLoad' :framed='false' @edit='onEditTile')

  TurnoverTop(
    v-model='periodDays',
    :inventory='inventory',
    :orders='orders',
    :loading='turnoverLoading'
  )

  //- Карточка предложения строки оборота — та же, что в реестре предложений.
  OfferRegistryOverlay(:coopname='info.coopname', from='economy')

  BaseDialog(v-model='dialogOpen', :title='dialogTitle', size='sm')
    p.admin-economy__dialog-hint {{ dialogHint }}
    AmountInput(
      v-model='draft',
      :label='dialogTitle',
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
  padding: var(--p-6);
  display: flex;
  flex-direction: column;
  gap: var(--p-6);

  &__dialog-hint {
    margin: 0;
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm);
    line-height: var(--p-lh-body-sm);
  }
}

@media (max-width: 599px) {
  .admin-economy {
    padding: var(--p-4);
  }
}
</style>
