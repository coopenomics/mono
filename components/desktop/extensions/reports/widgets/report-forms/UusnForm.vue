<template lang="pug">
.printable-form
  //- Лист 1. Титульный + Уведомление (1 листом)
  section.page
    .page__corner
      .barcode {{ '|| | |||| | |||  |' }}
      .kpp(v-if='header.kpp') КПП {{ header.kpp }}
      .inn-row
        .inn-label ИНН
        .inn-digits
          .inn-cell(v-for='ch in padInn(header.inn)' :key='ch.idx') {{ ch.val }}
    .page__form-code
      | Форма по КНД
      br
      b 1110355
      .vers ВерсФорм 5.03

    h1.page__title Уведомление об исчисленных суммах налогов,
    .page__subtitle авансовых платежей по налогам, сборов и страховых взносов

    .kv-row
      .kv-cell
        .kv-label Дата документа
        .kv-value {{ formatDate(header.docDate) }}
      .kv-cell
        .kv-label Код налогового органа
        .kv-value {{ header.kodNO || '—' }}
      .kv-cell.grow
        .kv-label Налогоплательщик
        .kv-value.name {{ header.orgName || '—' }}

    .section-heading Раздел «Данные»

    table.data-table
      thead
        tr
          th(style='width:55%') Наименование показателя
          th(style='width:45%') Значение
      tbody
        tr
          td КПП, по которому сдаётся отчёт
          td.code {{ uv.kpp || '—' }}
        tr
          td Код по ОКТМО
          td.code {{ uv.oktmo || '—' }}
        tr
          td Код бюджетной классификации (КБК)
          td.code {{ uv.kbk || '—' }}
        tr
          td Сумма налога/аванса/взноса
          td.num {{ fmtZero(uv.summa) }}
        tr
          td Отчётный (налоговый) период (код)
          td.code {{ uv.period || '—' }} ({{ periodLabel(uv.period) }})
        tr
          td Номер месяца (квартала)
          td.code {{ uv.nomerMesKvart || '—' }}
        tr
          td Отчётный год
          td.code {{ uv.god || header.year }}

    .signer-block
      .kv-row
        .kv-cell
          .kv-label Достоверность подтверждает
          .kv-value
            span(v-if='header.signerType === "chairman"') 1 — плательщик
            span(v-else) 2 — представитель
        .kv-cell.grow
          .kv-label ФИО
          .kv-value {{ fullSignerName || '—' }}

    .signature-line
      .sig-col.signature
        .sig-label Подпись
        .sig-blank _______________________
      .sig-col.date
        .sig-label Дата
        .sig-blank {{ formatDate(header.docDate) }}
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IReportRequisitesView } from 'src/entities/Report'
import { useReportXml } from './useReportXml'

const props = defineProps<{
  xml: string
  requisites?: IReportRequisitesView | null
  year?: number
}>()

const { header, getAttr, getNum, padInn, formatDate, fmtZero } = useReportXml(
  () => props.xml,
  () => props.requisites ?? null,
  () => props.year,
)

const uv = computed(() => ({
  kpp: getAttr('УвИсчСумНалог', 'КППДекл'),
  oktmo: getAttr('УвИсчСумНалог', 'ОКТМО'),
  kbk: getAttr('УвИсчСумНалог', 'КБК'),
  summa: getNum('УвИсчСумНалог', 'СумНалогАванс'),
  period: getAttr('УвИсчСумНалог', 'Период'),
  nomerMesKvart: getAttr('УвИсчСумНалог', 'НомерМесКварт'),
  god: getAttr('УвИсчСумНалог', 'Год'),
}))

// Коды: 21 — 1 квартал, 31 — полугодие, 33 — 9 мес, 34 — год;
// месяцы — 01..12, квартальные — 01..04 (см. генератор + XSD).
const PERIOD_LABELS: Record<string, string> = {
  21: 'I квартал',
  31: 'полугодие',
  33: '9 месяцев',
  34: 'год',
}
function periodLabel(code: string): string {
  if (!code) return '—'
  if (PERIOD_LABELS[code]) return PERIOD_LABELS[code]
  const m = /^(\d{2})$/.exec(code)
  if (m) {
    const n = Number(m[1])
    if (n >= 1 && n <= 12) return `месяц ${n}`
  }
  return code
}

const fullSignerName = computed(() => {
  const h = header.value
  return [h.signerLastName, h.signerFirstName, h.signerMiddleName].filter(Boolean).join(' ')
})
</script>

<style scoped lang="scss">
@use './_printable-form.scss';
</style>
