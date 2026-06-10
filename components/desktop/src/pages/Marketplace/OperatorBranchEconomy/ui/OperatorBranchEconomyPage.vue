<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { useSessionStore } from 'src/entities/Session'
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch'
import { DigitalDocument } from 'src/shared/lib/document'
import { BaseBadge, BaseButton, BaseDialog, BaseSelect, EmptyState, TableSkeleton } from 'src/shared/ui/base'
import type { BaseBadgeVariant, TableSkeletonColumn } from 'src/shared/ui/base'
import { AmountInput, DataRow, PageHint, WalletCard } from 'src/shared/ui/domain'
import {
  type AidStatementDocumentView,
  type MarketplaceAidView,
  type MarketplaceBranchEconomyView,
  convertBranchFunds,
  createAid,
  deleteTrusteeWeight,
  getAidStatementSignablePayload,
  getBranchEconomy,
  getEconomyConfig,
  getPersonalEconomy,
  listAids,
  setBranchSplit,
  setTrusteeWeight,
} from '../api'

/**
 * Стол ПВЗ → «Экономика участка» (requirement b6). Три зоны:
 *
 *  1. «Мои средства» — персональный кошелёк членских средств текущего
 *     оператора: перевод в членский кошелёк Стола заказов (заказы себе)
 *     либо материальная помощь (заявление → выплата кассиром, НДФЛ
 *     получатель платит сам).
 *  2. «Распределение участка» — единая ставка кооператива (read-only),
 *     отсечка персонального распределения и веса участников; правки —
 *     только председателю этого КУ (сверяется и backend'ом, и контрактом).
 *  3. «Общий кошелёк участка» — накопления вне персонального распределения
 *     (источник закупки впрок и будущих расходов участка).
 */

const route = useRoute()
const session = useSessionStore()
const store = useOperatorBranchStore()

const coopname = computed(() => String(route.params.coopname ?? ''))
const braname = computed(() => store.activeBraname ?? '')
const branch = computed(() => store.activeBranch?.branch ?? null)
const isBranchTrustee = computed(
  () => !!branch.value && branch.value.trustee.username === session.username
)

const loading = ref(false)
const feePercent = ref(0)
const economy = ref<MarketplaceBranchEconomyView | null>(null)
const personalBalance = ref('')
const aids = ref<MarketplaceAidView[]>([])

function assetAmount(asset: string): number {
  return Number.parseFloat(asset?.split(' ')[0] ?? '0') || 0
}

function assetSymbol(asset: string): string {
  return asset?.split(' ')[1] ?? ''
}

function personName(p: { first_name?: string; last_name?: string; middle_name?: string; username: string } | undefined): string {
  if (!p) return ''
  const full = [p.last_name, p.first_name, p.middle_name].filter(Boolean).join(' ').trim()
  return full || p.username
}

const nameByUsername = computed<Record<string, string>>(() => {
  const b = branch.value
  if (!b) return {}
  const map: Record<string, string> = { [b.trustee.username]: personName(b.trustee) }
  for (const t of b.trusted) map[t.username] = personName(t)
  return map
})

async function loadAll(): Promise<void> {
  if (!braname.value) return
  loading.value = true
  try {
    const [config, branchEconomy, personal, myAids] = await Promise.all([
      getEconomyConfig(),
      getBranchEconomy(braname.value),
      getPersonalEconomy(),
      listAids(),
    ])
    feePercent.value = config.membership_fee_percent
    economy.value = branchEconomy
    personalBalance.value = personal.personal_balance
    aids.value = myAids
    splitDraft.value = branchEconomy.personal_percent
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить экономику участка')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await store.ensureLoaded(coopname.value)
  void loadAll()
})

watch(braname, () => void loadAll())

// ─── Отсечка (председатель КУ) ───

const splitDraft = ref<number>(0)
const splitSaving = ref(false)
const splitChanged = computed(
  () => economy.value !== null && Number(splitDraft.value) !== economy.value.personal_percent
)

async function onSaveSplit(): Promise<void> {
  if (!braname.value) return
  splitSaving.value = true
  try {
    await setBranchSplit({ braname: braname.value, personal_percent: Number(splitDraft.value) })
    SuccessAlert('Отсечка распределения сохранена')
    await loadAll()
  } catch (e) {
    FailAlert(e, 'Не удалось сохранить отсечку')
  } finally {
    splitSaving.value = false
  }
}

// ─── Веса участников (председатель КУ) ───

const weightColumns = computed<TableSkeletonColumn[]>(() => [
  { label: 'Участник' },
  { label: 'Вес', class: 'col-num' },
  { label: 'Доля', class: 'col-num' },
  { label: 'На кошельке', class: 'col-num' },
  ...(isBranchTrustee.value ? [{ label: '', class: 'col-action', cell: 'icon' as const }] : []),
])

// Кандидаты в распределение — операторы участка, ещё не имеющие веса.
const weightCandidates = computed(() => {
  const b = branch.value
  if (!b || !economy.value) return []
  const present = new Set(economy.value.weights.map((w) => w.username))
  return [b.trustee, ...b.trusted]
    .filter((p) => !present.has(p.username))
    .map((p) => ({ label: personName(p), value: p.username }))
})

const newWeightUsername = ref<string | null>(null)
const newWeightValue = ref<number>(1)
const weightSaving = ref(false)

async function onAddWeight(): Promise<void> {
  if (!braname.value || !newWeightUsername.value) return
  weightSaving.value = true
  try {
    await setTrusteeWeight({
      braname: braname.value,
      username: newWeightUsername.value,
      weight: Math.max(1, Math.round(Number(newWeightValue.value) || 1)),
    })
    SuccessAlert('Вес участника назначен')
    newWeightUsername.value = null
    newWeightValue.value = 1
    await loadAll()
  } catch (e) {
    FailAlert(e, 'Не удалось назначить вес')
  } finally {
    weightSaving.value = false
  }
}

const editWeights = ref<Record<string, number>>({})

function onWeightInput(username: string, event: Event): void {
  editWeights.value[username] = Number((event.target as HTMLInputElement).value)
}

async function onUpdateWeight(username: string): Promise<void> {
  const weight = Math.round(Number(editWeights.value[username]))
  if (!braname.value || !Number.isFinite(weight) || weight <= 0) return
  weightSaving.value = true
  try {
    await setTrusteeWeight({ braname: braname.value, username, weight })
    SuccessAlert('Вес обновлён')
    await loadAll()
  } catch (e) {
    FailAlert(e, 'Не удалось обновить вес')
  } finally {
    weightSaving.value = false
  }
}

async function onDeleteWeight(username: string): Promise<void> {
  if (!braname.value) return
  weightSaving.value = true
  try {
    await deleteTrusteeWeight({ braname: braname.value, username })
    SuccessAlert('Участник исключён из распределения')
    await loadAll()
  } catch (e) {
    FailAlert(e, 'Не удалось исключить участника')
  } finally {
    weightSaving.value = false
  }
}

// ─── Перевод персональных средств в Стол заказов ───

const convertOpen = ref(false)
const convertAmount = ref<number | null>(null)
const converting = ref(false)

async function onConvert(): Promise<void> {
  const amount = Number(convertAmount.value)
  if (!Number.isFinite(amount) || amount <= 0) return
  converting.value = true
  try {
    await convertBranchFunds({ amount })
    SuccessAlert('Средства переведены в кошелёк Стола заказов')
    convertOpen.value = false
    convertAmount.value = null
    await loadAll()
  } catch (e) {
    FailAlert(e, 'Не удалось перевести средства')
  } finally {
    converting.value = false
  }
}

// ─── Материальная помощь: сумма → заявление → подпись → заявка ───

const aidOpen = ref(false)
const aidAmount = ref<number | null>(null)
const aidDoc = ref<AidStatementDocumentView | null>(null)
const aidBuilding = ref(false)
const aidSubmitting = ref(false)

function openAidDialog(): void {
  aidAmount.value = null
  aidDoc.value = null
  aidOpen.value = true
}

async function onBuildAidStatement(): Promise<void> {
  const amount = Number(aidAmount.value)
  if (!braname.value || !Number.isFinite(amount) || amount <= 0) return
  aidBuilding.value = true
  try {
    aidDoc.value = await getAidStatementSignablePayload({ braname: braname.value, amount })
  } catch (e) {
    FailAlert(e, 'Не удалось сформировать заявление')
  } finally {
    aidBuilding.value = false
  }
}

async function onSignAndSubmitAid(): Promise<void> {
  const doc = aidDoc.value
  const amount = Number(aidAmount.value)
  if (!doc || !braname.value) return
  aidSubmitting.value = true
  try {
    const digital = new DigitalDocument(doc)
    const signed = await digital.sign(session.username)
    const aidHash = (doc.meta as { aid_hash?: string })?.aid_hash
    if (!aidHash) throw new Error('В заявлении нет идентификатора заявки')
    await createAid({
      braname: braname.value,
      amount,
      aid_hash: aidHash,
      statement: signed,
    })
    SuccessAlert('Заявка на материальную помощь подана — ожидает выплаты кассиром')
    aidOpen.value = false
    await loadAll()
  } catch (e) {
    FailAlert(e, 'Не удалось подать заявку на материальную помощь')
  } finally {
    aidSubmitting.value = false
  }
}

// ─── Мои заявки ───

function aidBadge(a: MarketplaceAidView): { label: string; variant: BaseBadgeVariant } {
  switch (a.status) {
    case 'completed':
      return { label: 'Выплачена', variant: 'pos' }
    case 'declined':
      return { label: 'Отклонена', variant: 'neg' }
    default:
      return { label: 'Ожидает выплаты', variant: 'warn' }
  }
}
</script>

<template lang="pug">
q-page.economy
  OperatorBranchBar

  EmptyState(
    v-if='!store.loading && !store.isOperator',
    title='Вы не оператор кооперативного участка',
    body='Экономика участка доступна председателю участка и его доверенным лицам.'
  )
    template(#icon)
      q-icon(name='savings', size='48px')

  template(v-else)
    PageHint(storage-key='mp:operator-economy:banner-dismissed')
      | С каждого исполненного заказа участок получает членский взнос по единой
      | ставке кооператива. Часть взноса (отсечка) сразу распределяется между
      | председателем и доверенными по назначенным весам, остальное копится в
      | общем кошельке участка. Персональными средствами вы распоряжаетесь
      | сами: заказывайте имущество через Стол заказов или получайте
      | материальную помощь (налог с дохода оплачиваете самостоятельно).

    //- Мои средства + общий кошелёк
    .economy__cards
      WalletCard(
        program='wallet',
        title='Мои членские средства',
        subtitle='Распределено мне по условиям участка',
        :balance='assetAmount(personalBalance).toFixed(2)',
        :symbol='assetSymbol(personalBalance)',
        :loading='loading && !personalBalance'
      )
      WalletCard(
        program='wallet',
        icon='storefront',
        title='Общий кошелёк участка',
        subtitle='Закупка впрок и нужды участка',
        :balance='economy ? assetAmount(economy.common_balance).toFixed(2) : "0.00"',
        :symbol='economy ? assetSymbol(economy.common_balance) : ""',
        :loading='loading && !economy'
      )

    .economy__actions
      BaseButton(variant='primary', @click='convertOpen = true')
        template(#icon-left)
          q-icon(name='swap_horiz', size='16px')
        | Перевести в Стол заказов
      BaseButton(variant='secondary', @click='openAidDialog')
        template(#icon-left)
          q-icon(name='payments', size='16px')
        | Материальная помощь

    //- Распределение
    .economy__section
      .economy__section-title Распределение членских взносов
      .economy__rows
        DataRow(label='Ставка членского взноса кооператива', :value='feePercent.toFixed(2) + " %"')
        DataRow(
          v-if='!isBranchTrustee',
          label='Персональное распределение (отсечка)',
          :value='(economy?.personal_percent ?? 0).toFixed(2) + " %"'
        )
      .economy__split(v-if='isBranchTrustee')
        AmountInput.economy__split-input(
          v-model='splitDraft',
          label='Персональное распределение (отсечка)',
          symbol='%',
          :precision='2',
          :min='0',
          :max='100'
        )
        BaseButton(
          variant='primary',
          :loading='splitSaving',
          :disabled='!splitChanged',
          @click='onSaveSplit'
        ) Сохранить

      TableSkeleton(v-if='loading && !economy', :columns='weightColumns')

      .table-wrap(v-if='economy && economy.weights.length')
        .table-scroll
          table.table
            thead
              tr
                th Участник
                th.col-num Вес
                th.col-num Доля
                th.col-num На кошельке
                th.col-action(v-if='isBranchTrustee')
            tbody
              tr(v-for='w in economy.weights', :key='w.username')
                td.economy__name {{ nameByUsername[w.username] || w.username }}
                td.col-num
                  template(v-if='isBranchTrustee')
                    input.economy__weight-input(
                      type='number',
                      min='1',
                      :value='editWeights[w.username] ?? w.weight',
                      @input='onWeightInput(w.username, $event)',
                      @change='onUpdateWeight(w.username)'
                    )
                  template(v-else) {{ w.weight }}
                td.col-num {{ w.share_percent.toFixed(1) }} %
                td.col-num.t-mono {{ w.personal_balance }}
                td.col-action(v-if='isBranchTrustee')
                  BaseButton(
                    variant='ghost',
                    icon-only,
                    size='sm',
                    aria-label='Исключить из распределения',
                    :disabled='weightSaving',
                    @click='onDeleteWeight(w.username)'
                  )
                    template(#icon-left)
                      q-icon(name='person_remove', size='18px')

      .banner.banner--info(v-else-if='economy && !economy.weights.length')
        q-icon.banner__icon(name='info', size='18px')
        .banner__body
          | Веса распределения не настроены — весь членский взнос участка
          | уходит в общий кошелёк. Назначьте веса, чтобы часть взноса
          | распределялась персонально.

      .economy__add(v-if='isBranchTrustee && weightCandidates.length')
        BaseSelect.economy__add-select(
          v-model='newWeightUsername',
          label='Участник распределения',
          :options='weightCandidates'
        )
        AmountInput.economy__add-weight(
          v-model='newWeightValue',
          label='Вес',
          :precision='0',
          :min='1'
        )
        BaseButton(
          variant='primary',
          :loading='weightSaving',
          :disabled='!newWeightUsername',
          @click='onAddWeight'
        ) Добавить в распределение

    //- Мои заявки на материальную помощь
    .economy__section(v-if='aids.length')
      .economy__section-title Мои заявки на материальную помощь
      .table-wrap
        .table-scroll
          table.table
            thead
              tr
                th Сумма
                th Состояние
                th Причина отказа
            tbody
              tr(v-for='a in aids', :key='a.hash')
                td.t-mono {{ a.amount }}
                td
                  BaseBadge(:variant='aidBadge(a).variant') {{ aidBadge(a).label }}
                td {{ a.decline_reason || '—' }}

  //- Диалог перевода
  BaseDialog(v-model='convertOpen', title='Перевод в Стол заказов', size='sm')
    .economy__dialog-body
      p
        | Средства перейдут в ваш членский кошелёк Стола заказов — ими можно
        | оплачивать заказы как обычный пайщик.
      AmountInput(
        v-model='convertAmount',
        label='Сумма перевода',
        :symbol='assetSymbol(personalBalance)',
        :precision='2',
        :min='0',
        show-max,
        show-balance,
        :balance='assetAmount(personalBalance)'
      )
    template(#footer)
      BaseButton(variant='ghost', :disabled='converting', @click='convertOpen = false') Отмена
      BaseButton(variant='primary', :loading='converting', :disabled='!convertAmount', @click='onConvert') Перевести

  //- Диалог матпомощи
  BaseDialog(v-model='aidOpen', title='Материальная помощь', size='lg')
    .economy__dialog-body
      template(v-if='!aidDoc')
        p
          | Выплата с вашего персонального кошелька на ваш расчётный счёт.
          | Налог на доходы физических лиц с полученной суммы вы оплачиваете
          | самостоятельно.
        AmountInput(
          v-model='aidAmount',
          label='Сумма выплаты',
          :symbol='assetSymbol(personalBalance)',
          :precision='2',
          :min='0',
          show-max,
          show-balance,
          :balance='assetAmount(personalBalance)'
        )
      template(v-else)
        .economy__doc(v-html='aidDoc.html')
    template(#footer)
      BaseButton(variant='ghost', :disabled='aidBuilding || aidSubmitting', @click='aidOpen = false') Отмена
      BaseButton(
        v-if='!aidDoc',
        variant='primary',
        :loading='aidBuilding',
        :disabled='!aidAmount',
        @click='onBuildAidStatement'
      ) Сформировать заявление
      BaseButton(
        v-else,
        variant='primary',
        :loading='aidSubmitting',
        @click='onSignAndSubmitAid'
      )
        template(#icon-left)
          q-icon(name='draw', size='16px')
        | Подписать и отправить
</template>

<style scoped lang="scss">
.economy {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--p-4, 16px);
  }

  &__actions {
    display: flex;
    gap: var(--p-3, 12px);
    flex-wrap: wrap;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }

  &__section-title {
    font-weight: 600;
    font-size: var(--p-fs-md, 1rem);
  }

  &__rows {
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    padding: var(--p-2, 8px) var(--p-4, 16px);
  }

  &__split {
    display: flex;
    align-items: flex-start;
    gap: var(--p-3, 12px);
  }

  &__split-input {
    max-width: 280px;
    width: 100%;
  }

  &__name {
    font-weight: 600;
  }

  &__weight-input {
    width: 80px;
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-sm, 8px);
    padding: var(--p-1, 4px) var(--p-2, 8px);
    background: var(--p-surface);
    color: var(--p-ink);
  }

  &__add {
    display: flex;
    align-items: flex-start;
    gap: var(--p-3, 12px);
    flex-wrap: wrap;
  }

  &__add-select {
    min-width: 260px;
  }

  &__add-weight {
    max-width: 140px;
  }

  &__dialog-body {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
    color: var(--p-ink-2);
  }

  &__doc {
    max-height: 50vh;
    overflow: auto;
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    padding: var(--p-4, 16px);
    background: var(--p-surface);
  }
}

.col-num {
  width: 130px;
}
.col-action {
  width: 64px;
  text-align: right;
}

@media (max-width: 768px) {
  .economy {
    padding: var(--p-4, 16px);
  }
}
</style>
