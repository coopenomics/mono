<template lang="pug">
q-dialog(:model-value='modelValue' @update:model-value='$emit("update:modelValue", $event)')
  q-card(style='min-width: 600px; max-width: 90vw')
    q-card-section
      .row.items-center
        .text-h6.col Результат генерации
        q-chip(
          :color='result?.isValid ? "positive" : "negative"'
          text-color='white'
        ) {{ result?.isValid ? 'Валиден' : 'Ошибки' }}

    q-card-section(v-if='result?.errors?.length')
      q-banner.bg-negative.text-white(v-for='err in result.errors' :key='err')
        | {{ err }}

    q-card-section
      .text-caption.text-grey Файл: {{ result?.fileName }}
      q-input.q-mt-sm(
        :modelValue='result?.xml'
        readonly
        outlined
        type='textarea'
        rows='12'
      )

    q-card-actions(align='right')
      q-btn(
        flat
        label='Скачать XML'
        icon='download'
        color='primary'
        :disable='!result?.isValid'
        @click='$emit("download")'
      )
        q-tooltip(v-if='!result?.isValid') Отчёт невалиден — сначала исправьте ошибки
      q-btn(flat label='Закрыть' @click='$emit("update:modelValue", false)')
</template>

<script setup lang="ts">
import type { IGeneratedReport } from 'src/entities/Report'

defineProps<{
  modelValue: boolean
  result: IGeneratedReport | null
}>()

defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'download'): void
}>()
</script>
