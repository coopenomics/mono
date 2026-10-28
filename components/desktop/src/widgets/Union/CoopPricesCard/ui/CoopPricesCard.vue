<template lang="pug">
//- Индивидуальные цены услуг кооператива у оператора. Зоны: реестр цен
//- (услуга — прейскурант — цена кооператива), правая панель записи с
//- действиями, та же панель — форма назначения.
.coop-prices
  EmptyState(v-if="!firstLoad && !prices.length" :title="$t('union.coopPrices.emptyTitle')" :body="$t('union.coopPrices.emptyBody')")
    template(#icon)
      q-icon(name="sell" size="48px")
  BaseTable(
    v-else
    :columns="columns"
    :rows="prices"
    row-key="subscription_type_id"
    :loading="firstLoad"
    clickable-rows
    @row-click="openRow"
  )
    template(#cell-service="{ row: price }")
      .coop-prices__name {{ price.name }}
      .t-meta.t-muted(v-if="price.code") {{ price.code }}
    template(#cell-list="{ row: price }")
      span.t-mono {{ formatRub(price.list_price_per_month) }}
    template(#cell-price="{ row: price }")
      BaseBadge(v-if="price.amount_per_month === 0" variant="pos") {{ $t('union.coopPrices.free') }}
      span.t-mono(v-else) {{ formatRub(price.amount_per_month) }}
    template(#cell-reason="{ row: price }")
      span(v-if="price.reason") {{ price.reason }}
      span.t-muted(v-else) —

  //- Правая панель: запись целиком либо форма назначения.
  DetailsDrawer(v-model="drawerOpen" :title="drawerTitle" :width="440")
    template(v-if="mode === 'view' && selected")
      .coop-prices__sum
        .t-eyebrow {{ $t('union.coopPrices.column.price') }}
        .coop-prices__amount.t-mono
          template(v-if="selected.amount_per_month === 0") {{ $t('union.coopPrices.free') }}
          template(v-else) {{ formatRub(selected.amount_per_month) }}
        .t-meta.t-muted {{ $t('union.coopPrices.perMonth') }}
      DataRow(:label="$t('union.coopPrices.column.service')" :value="selected.name" align="spread")
      DataRow(v-if="selected.code" :label="$t('union.coopPrices.code')" :value="selected.code" mono align="spread")
      DataRow(:label="$t('union.coopPrices.column.list')" :value="formatRub(selected.list_price_per_month)" align="spread")
      DataRow(v-if="selected.reason" :label="$t('union.coopPrices.column.reason')" :value="selected.reason" align="vertical")
      DataRow(v-if="selected.created_by" :label="$t('union.coopPrices.createdBy')" :value="selected.created_by" align="spread")
      DataRow(:label="$t('union.coopPrices.updatedAt')" :value="formatDate(selected.updated_at)" align="spread")
    BaseForm(v-else ref="formRef" @submit="submit")
      BaseSelect(
        v-model="form.subscription_type_id"
        :options="serviceOptions"
        :label="$t('union.coopPrices.column.service')"
        :disabled="editing"
        required
        searchable
      )
      AmountInput(
        v-model="form.amount_per_month"
        :label="$t('union.coopPrices.amountLabel')"
        :hint="$t('union.coopPrices.amountHint')"
        symbol="₽"
        :precision="2"
        :min="0"
      )
      BaseInput(
        v-model="form.reason"
        type="textarea"
        :label="$t('union.coopPrices.column.reason')"
        :hint="$t('union.coopPrices.reasonHint')"
      )
    template(#footer)
      template(v-if="mode === 'view'")
        BaseButton(variant="danger" size="md" type="button" :loading="removing" @click="removeSelected") {{ $t('union.coopPrices.remove') }}
        BaseButton(variant="primary" size="md" type="button" @click="openEdit") {{ $t('union.coopPrices.edit') }}
      template(v-else)
        BaseButton(variant="ghost" size="md" type="button" @click="drawerOpen = false") {{ $t('common.action.cancel') }}
        BaseButton(variant="primary" size="md" type="button" :loading="saving" :disabled="!canSubmit" @click="submit") {{ $t('union.coopPrices.save') }}
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import moment from 'src/shared/lib/utils/dates/moment'
import { BaseBadge, BaseButton, BaseForm, BaseInput, BaseSelect, BaseTable, EmptyState } from 'src/shared/ui/base'
import { AmountInput, DataRow, DetailsDrawer } from 'src/shared/ui/domain'
import { useConfirm, useFirstLoad } from 'src/shared/lib/composables'
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts'
import { useCoopPrices, type ICoopPrice } from 'src/features/Union/CoopPrices'
import { formatRub } from 'src/entities/Union'
import { t } from 'src/shared/i18n'

const props = defineProps<{ coopname: string }>()
const emit = defineEmits<{ changed: [] }>()

const { prices, services, loading, load, set, remove } = useCoopPrices(() => props.coopname)
const firstLoad = useFirstLoad(loading)
const { confirm } = useConfirm()

const columns = [
  { key: 'service', label: t('union.coopPrices.column.service'), align: 'left' as const },
  { key: 'list', label: t('union.coopPrices.column.list'), align: 'right' as const, numeric: true, width: '150px' },
  { key: 'price', label: t('union.coopPrices.column.price'), align: 'right' as const, numeric: true, width: '150px' },
  { key: 'reason', label: t('union.coopPrices.column.reason'), align: 'left' as const },
]

const drawerOpen = ref(false)
const mode = ref<'view' | 'create' | 'edit'>('view')
const selected = ref<ICoopPrice | null>(null)
const editing = computed(() => mode.value === 'edit')
const drawerTitle = computed(() =>
  mode.value === 'view'
    ? t('union.coopPrices.drawerTitle')
    : mode.value === 'edit'
      ? t('union.coopPrices.edit')
      : t('union.coopPrices.assign'),
)

const form = reactive<{ subscription_type_id: number | null; amount_per_month: number | null; reason: string }>({
  subscription_type_id: null,
  amount_per_month: null,
  reason: '',
})
const formRef = ref()
const saving = ref(false)
const removing = ref(false)

// Услуги кооператива списком; у кого цена уже назначена — в подписи варианта.
const serviceOptions = computed(() =>
  services.value.map((s) => {
    const current = prices.value.find((p) => p.subscription_type_id === s.id)
    return {
      value: s.id,
      label: s.name,
      caption: current ? t('union.coopPrices.assigned', { price: formatRub(current.amount_per_month) }) : formatRub(Number(s.price)),
    }
  }),
)
const canSubmit = computed(
  () => form.subscription_type_id != null && form.amount_per_month != null && Number(form.amount_per_month) >= 0,
)

const openRow = (row: ICoopPrice) => {
  selected.value = row
  mode.value = 'view'
  drawerOpen.value = true
}

/** Назначение новой цены — зовёт страница кнопкой вкладки. */
const openCreate = () => {
  selected.value = null
  form.subscription_type_id = null
  form.amount_per_month = null
  form.reason = ''
  mode.value = 'create'
  drawerOpen.value = true
}
defineExpose({ openCreate, reload: load })

const openEdit = () => {
  if (!selected.value) return
  form.subscription_type_id = selected.value.subscription_type_id
  form.amount_per_month = selected.value.amount_per_month
  form.reason = selected.value.reason ?? ''
  mode.value = 'edit'
}

const submit = async () => {
  if (!canSubmit.value || form.subscription_type_id == null) return
  saving.value = true
  try {
    await set({
      subscription_type_id: Number(form.subscription_type_id),
      amount_per_month: Number(form.amount_per_month),
      reason: form.reason.trim() || null,
    })
    SuccessAlert(t('union.coopPrices.saved'))
    drawerOpen.value = false
    emit('changed')
  } catch (e: unknown) {
    FailAlert(e)
  } finally {
    saving.value = false
  }
}

const removeSelected = async () => {
  const row = selected.value
  if (!row) return
  if (
    !(await confirm({
      title: t('union.coopPrices.removeConfirmTitle', { name: row.name }),
      message: t('union.coopPrices.removeConfirmBody'),
      confirmLabel: t('union.coopPrices.remove'),
      danger: true,
    }))
  )
    return
  removing.value = true
  try {
    await remove(row.subscription_type_id)
    SuccessAlert(t('union.coopPrices.removed'))
    drawerOpen.value = false
    emit('changed')
  } catch (e: unknown) {
    FailAlert(e)
  } finally {
    removing.value = false
  }
}

const formatDate = (d: string) => moment(d).format('DD.MM.YYYY HH:mm')
</script>

<style scoped>
.coop-prices__name {
  font-weight: 500;
}
.coop-prices__sum {
  padding-bottom: var(--p-4);
  margin-bottom: var(--p-2);
  border-bottom: 1px solid var(--p-line);
}
.coop-prices__amount {
  font-size: var(--p-fs-h2);
  font-weight: 700;
  color: var(--p-ink);
}
</style>
