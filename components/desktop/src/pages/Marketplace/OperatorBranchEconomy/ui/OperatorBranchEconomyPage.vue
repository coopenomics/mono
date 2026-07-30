<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Zeus } from '@coopenomics/sdk'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { useSessionStore } from 'src/entities/Session'
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch'
import { DigitalDocument } from 'src/shared/lib/document'
import { BaseBadge, BaseButton, BaseDialog, BaseInput, BaseSelect, EmptyState, TableSkeleton } from 'src/shared/ui/base'
import type { TableSkeletonColumn } from 'src/shared/ui/base'
import { AmountInput, DataRow, PageHint, WalletCard } from 'src/shared/ui/domain'
import {
  type AidStatementDocumentView,
  type ExpensePlanView,
  type MarketplaceAidView,
  type MarketplaceBranchEconomyView,
  convertBranchFunds,
  createAid,
  createExpensePlan,
  deleteExpensePlan,
  deleteTrusteeWeight,
  distributeBranchFunds,
  getAidStatementSignablePayload,
  getBranchEconomy,
  getEconomyConfig,
  getPersonalEconomy,
  listAids,
  listExpensePlans,
  setTrusteeWeight,
} from '../api'

/**
 * Стол ПВЗ → «Экономика участка» (requirement b6, раунд 5 — приоритет
 * общего кошелька). Зоны:
 *
 *  1. «Мои средства» — персональный кошелёк членских средств текущего
 *     оператора: перевод в членский кошелёк Стола заказов (заказы себе)
 *     либо материальная помощь (заявление → выплата кассиром, НДФЛ
 *     получатель платит сам).
 *  2. «Общий кошелёк участка» — сюда приходит 100% членских взносов
 *     исполненных заказов; показатели «Резерв на 30 дней» и «Доступно к
 *     распределению».
 *  3. «Плановые расходы» — оффчейн-реестр (срочные и ближайшие 30 дней
 *     образуют резерв); кнопка «Оплатить» заглушена до шасси расходов.
 *  4. «Распределение» — веса участников и ручная команда «Распределить»
 *     (председатель, сумма из общего кошелька сверх резерва).
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

const loading = ref(true)
const feePercent = ref(0)
const economy = ref<MarketplaceBranchEconomyView | null>(null)
const plans = ref<ExpensePlanView[]>([])
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
    const [config, branchEconomy, branchPlans, personal, myAids] = await Promise.all([
      getEconomyConfig(),
      getBranchEconomy(braname.value),
      listExpensePlans(braname.value),
      getPersonalEconomy(),
      listAids(),
    ])
    feePercent.value = config.membership_fee_percent
    economy.value = branchEconomy
    plans.value = branchPlans
    personalBalance.value = personal.personal_balance
    aids.value = myAids
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

// ─── Ручное распределение из общего кошелька (председатель КУ) ───

const distributeOpen = ref(false)
const distributeAmount = ref<number | null>(null)
const distributing = ref(false)
const availableToDistribute = computed(() =>
  economy.value ? assetAmount(economy.value.available_to_distribute) : 0
)

async function onDistribute(): Promise<void> {
  const amount = Number(distributeAmount.value)
  if (!braname.value || !Number.isFinite(amount) || amount <= 0) return
  distributing.value = true
  try {
    await distributeBranchFunds({ braname: braname.value, amount })
    SuccessAlert('Средства распределены между участниками по весам')
    distributeOpen.value = false
    distributeAmount.value = null
    await loadAll()
  } catch (e) {
    FailAlert(e, 'Не удалось распределить средства')
  } finally {
    distributing.value = false
  }
}

// ─── Плановые расходы участка (оффчейн-реестр; резерв 30 дней) ───

const planColumns = computed<TableSkeletonColumn[]>(() => [
  { label: 'Назначение' },
  { label: 'Сумма', class: 'col-num' },
  { label: 'Срок' },
  { label: 'Реквизиты' },
  ...(isBranchTrustee.value ? [{ label: '', class: 'col-action', cell: 'icon' as const }] : []),
])

const planPriorityOptions = [
  { label: 'К дате', value: Zeus.ExpensePlanPriority.SCHEDULED },
  { label: 'Срочный — как только возможно', value: Zeus.ExpensePlanPriority.URGENT },
  { label: 'Необязательный — при наличии средств', value: Zeus.ExpensePlanPriority.OPTIONAL },
]

const SCHEDULED = Zeus.ExpensePlanPriority.SCHEDULED

const planTitle = ref('')
const planAmount = ref<number | null>(null)
const planPriority = ref<Zeus.ExpensePlanPriority>(SCHEDULED)
const planDueDate = ref('')
const planPayTo = ref('')
const planSaving = ref(false)

function planDueLabel(plan: ExpensePlanView): string {
  if (plan.priority === Zeus.ExpensePlanPriority.URGENT) return 'Срочный'
  if (plan.priority === Zeus.ExpensePlanPriority.OPTIONAL) return 'Необязательный'
  return plan.due_date ? new Date(String(plan.due_date)).toLocaleDateString('ru-RU') : '—'
}

async function onAddPlan(): Promise<void> {
  const amount = Number(planAmount.value)
  if (!braname.value || !planTitle.value.trim() || !Number.isFinite(amount) || amount <= 0) return
  if (planPriority.value === Zeus.ExpensePlanPriority.SCHEDULED && !planDueDate.value) {
    FailAlert(new Error('Укажите срок оплаты'), 'Для расхода с оплатой к дате укажите срок')
    return
  }
  planSaving.value = true
  try {
    await createExpensePlan({
      braname: braname.value,
      title: planTitle.value.trim(),
      amount,
      priority: planPriority.value,
      due_date:
        planPriority.value === Zeus.ExpensePlanPriority.SCHEDULED
          ? new Date(planDueDate.value).toISOString()
          : null,
      pay_to: planPayTo.value.trim() || '—',
    })
    SuccessAlert('Плановый расход добавлен')
    planTitle.value = ''
    planAmount.value = null
    planDueDate.value = ''
    planPayTo.value = ''
    await loadAll()
  } catch (e) {
    FailAlert(e, 'Не удалось добавить плановый расход')
  } finally {
    planSaving.value = false
  }
}

async function onDeletePlan(plan: ExpensePlanView): Promise<void> {
  planSaving.value = true
  try {
    await deleteExpensePlan({ plan_id: plan.id })
    SuccessAlert('Плановый расход удалён')
    await loadAll()
  } catch (e) {
    FailAlert(e, 'Не удалось удалить плановый расход')
  } finally {
    planSaving.value = false
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

</script>

<template lang="pug">
q-page.economy
  OperatorBranchBar

  EmptyState(
    v-if='store.loaded && !store.isOperator',
    title='Вы не оператор кооперативного участка',
    body='Экономика участка доступна председателю участка и его доверенным лицам.'
  )
    template(#icon)
      q-icon(name='savings', size='48px')

  template(v-else)
    PageHint(storage-key='mp:operator-economy:banner-dismissed')
      | С каждого исполненного заказа участок получает членский взнос по единой
      | ставке кооператива — он целиком зачисляется в общий кошелёк участка.
      | Сначала из него покрываются плановые расходы (срочные и ближайшие
      | 30 дней образуют неснижаемый резерв), и только остаток председатель
      | распределяет между участниками по весам — когда и сколько решит сам.
      | Персональными средствами вы распоряжаетесь сами: заказывайте имущество
      | через Стол заказов или получайте материальную помощь (налог с дохода
      | оплачиваете самостоятельно).

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
        subtitle='Расходы, закупка впрок и распределения',
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

    //- Плановые расходы участка
    .economy__section
      .economy__section-title Плановые расходы
      .economy__rows
        DataRow(label='Резерв на 30 дней', :value='economy?.reserve_amount ?? "—"')
        DataRow(label='Доступно к распределению', :value='economy?.available_to_distribute ?? "—"')

      TableSkeleton(v-if='loading && !economy', :columns='planColumns')

      .table-wrap(v-if='plans.length')
        .table-scroll
          table.table
            thead
              tr
                th Назначение
                th.col-num Сумма
                th Срок
                th Реквизиты
                th.col-action(v-if='isBranchTrustee')
            tbody
              tr(v-for='plan in plans', :key='plan.id')
                td.economy__name {{ plan.title }}
                td.col-num.t-mono {{ plan.amount }}
                td {{ planDueLabel(plan) }}
                td.economy__payto {{ plan.pay_to }}
                td.col-action(v-if='isBranchTrustee')
                  BaseButton(
                    variant='ghost',
                    size='sm',
                    disabled,
                    title='Оплата расходов включится вместе с общесистемным учётом расходов'
                  ) Оплатить
                  BaseButton(
                    variant='ghost',
                    icon-only,
                    size='sm',
                    aria-label='Удалить плановый расход',
                    :disabled='planSaving',
                    @click='onDeletePlan(plan)'
                  )
                    template(#icon-left)
                      q-icon(name='delete', size='18px')

      .banner.banner--info(v-else-if='economy && !plans.length')
        q-icon.banner__icon(name='info', size='18px')
        .banner__body
          | Плановых расходов нет — весь общий кошелёк доступен распределению.
          | Внесите предстоящие траты участка, чтобы система удерживала под них
          | резерв.

      .economy__plan-add(v-if='isBranchTrustee')
        BaseInput.economy__plan-title(v-model='planTitle', label='Назначение расхода')
        AmountInput.economy__plan-amount(v-model='planAmount', label='Сумма', :precision='2', :min='0')
        BaseSelect.economy__plan-priority(v-model='planPriority', label='Приоритет', :options='planPriorityOptions')
        BaseInput.economy__plan-date(
          v-if='planPriority === SCHEDULED',
          v-model='planDueDate',
          label='Срок оплаты',
          type='date'
        )
        BaseInput.economy__plan-payto(v-model='planPayTo', label='Реквизиты оплаты')
        BaseButton(
          variant='primary',
          :loading='planSaving',
          :disabled='!planTitle || !planAmount',
          @click='onAddPlan'
        ) Добавить расход

    //- Распределение
    .economy__section
      .economy__section-title Распределение членских взносов
      .economy__rows
        DataRow(label='Ставка членского взноса кооператива', :value='feePercent.toFixed(2) + " %"')

      .economy__distribute(v-if='isBranchTrustee')
        BaseButton(
          variant='primary',
          :disabled='availableToDistribute <= 0 || !economy || !economy.weights.length',
          @click='distributeOpen = true'
        )
          template(#icon-left)
            q-icon(name='call_split', size='16px')
          | Распределить

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
          | Веса распределения не настроены. Назначьте веса участникам, чтобы
          | председатель мог распределять средства общего кошелька персонально.

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

    //- Заявки на материальную помощь, ожидающие выплаты (выплаченные и
    //- отклонённые исчезают из списка — итог виден в движениях по кошельку)
    .economy__section(v-if='aids.length')
      .economy__section-title Мои заявки на материальную помощь
      .table-wrap
        .table-scroll
          table.table
            thead
              tr
                th Сумма
                th Состояние
            tbody
              tr(v-for='a in aids', :key='a.hash')
                td.t-mono {{ a.amount }}
                td
                  BaseBadge(variant='warn') Ожидает выплаты

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

  //- Диалог распределения
  BaseDialog(v-model='distributeOpen', title='Распределить из общего кошелька', size='sm')
    .economy__dialog-body
      p
        | Сумма разойдётся между участниками распределения пропорционально их
        | весам. Распределять можно частично и несколько раз; резерв плановых
        | расходов на 30 дней останется в общем кошельке.
      AmountInput(
        v-model='distributeAmount',
        label='Сумма распределения',
        :symbol='economy ? assetSymbol(economy.common_balance) : ""',
        :precision='2',
        :min='0',
        show-max,
        show-balance,
        :balance='availableToDistribute'
      )
    template(#footer)
      BaseButton(variant='ghost', :disabled='distributing', @click='distributeOpen = false') Отмена
      BaseButton(variant='primary', :loading='distributing', :disabled='!distributeAmount', @click='onDistribute') Распределить

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

  &__distribute {
    display: flex;
    align-items: flex-start;
    gap: var(--p-3, 12px);
  }

  &__plan-add {
    display: flex;
    align-items: flex-start;
    gap: var(--p-3, 12px);
    flex-wrap: wrap;
  }

  &__plan-title {
    min-width: 240px;
    flex: 1 1 240px;
  }

  &__plan-amount {
    max-width: 160px;
  }

  &__plan-priority {
    min-width: 240px;
  }

  &__plan-date {
    max-width: 180px;
  }

  &__plan-payto {
    min-width: 240px;
    flex: 1 1 240px;
  }

  &__payto {
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
