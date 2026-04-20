<template lang="pug">
q-dialog(:model-value='modelValue' @update:model-value='$emit("update:modelValue", $event)' persistent)
  q-card(style='min-width: 600px; max-width: 90vw')
    q-card-section
      .text-h6 Генерация: {{ report?.name }}

    q-card-section
      .row.q-gutter-md
        .col-6
          q-input(v-model.number='yearValue' label='Год' type='number' dense outlined)
        .col-6(v-if='report?.period !== "yearly"')
          q-input(
            v-model.number='periodValue'
            :label='report?.period === "monthly" ? "Месяц (1-12)" : "Квартал (1-4)"'
            type='number'
            dense
            outlined
          )

      q-expansion-item.q-mt-md(
        v-if='report?.type === "BUHOTCH"'
        icon='fa-solid fa-scale-balanced'
        label='Корректировка прошлых периодов'
        :default-opened='corrections.length > 0'
      )
        .q-pa-sm
          .text-caption.text-grey-7.q-mb-sm
            | Остатки на 31 декабря прошлого и позапрошлого года для счетов баланса.
          q-table(
            :rows='corrections'
            :columns='correctionsColumns'
            row-key='accountDisplayId'
            flat
            dense
            hide-pagination
            :pagination='{ rowsPerPage: 0 }'
          )
            template(#body-cell-displayId='props')
              q-td(:props='props')
                q-input(v-model='props.row.accountDisplayId' dense borderless placeholder='86.01')
            template(#body-cell-prev='props')
              q-td(:props='props')
                q-input(v-model.number='props.row.balancePrevious' type='number' dense borderless)
            template(#body-cell-preprev='props')
              q-td(:props='props')
                q-input(v-model.number='props.row.balancePrePrevious' type='number' dense borderless)
            template(#body-cell-remove='props')
              q-td(:props='props')
                q-btn(
                  flat dense size='sm'
                  icon='fa-solid fa-trash'
                  color='negative'
                  @click='removeRow(props.rowIndex)'
                )
          q-btn.q-mt-sm(
            flat dense size='sm' icon='fa-solid fa-plus'
            label='Добавить счёт'
            @click='addRow'
          )

    q-card-actions(align='right')
      q-btn(flat label='Отмена' @click='$emit("update:modelValue", false)')
      q-btn(flat label='Сгенерировать' color='primary' @click='$emit("generate")' :loading='generating')
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IAvailableReport } from 'src/entities/Report'

interface CorrectionRow {
  accountDisplayId: string
  balancePrevious: number
  balancePrePrevious: number
}

const props = defineProps<{
  modelValue: boolean
  report: IAvailableReport | null
  year: number
  period: number
  corrections: CorrectionRow[]
  generating: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'update:year', v: number): void
  (e: 'update:period', v: number): void
  (e: 'update:corrections', v: CorrectionRow[]): void
  (e: 'generate'): void
}>()

const yearValue = computed({
  get: () => props.year,
  set: (v: number) => emit('update:year', v),
})
const periodValue = computed({
  get: () => props.period,
  set: (v: number) => emit('update:period', v),
})

const correctionsColumns = computed(() => [
  { name: 'displayId', label: 'Счёт', field: 'accountDisplayId', align: 'left' as const },
  { name: 'prev', label: `На 31.12.${props.year - 1}`, field: 'balancePrevious', align: 'right' as const },
  { name: 'preprev', label: `На 31.12.${props.year - 2}`, field: 'balancePrePrevious', align: 'right' as const },
  { name: 'remove', label: '', field: 'remove', align: 'right' as const },
])

function addRow() {
  emit('update:corrections', [
    ...props.corrections,
    { accountDisplayId: '', balancePrevious: 0, balancePrePrevious: 0 },
  ])
}

function removeRow(i: number) {
  const next = props.corrections.slice()
  next.splice(i, 1)
  emit('update:corrections', next)
}
</script>
