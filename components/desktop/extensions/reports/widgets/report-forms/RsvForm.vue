<template lang="pug">
.printable-form
  //- Лист 1. Титульный
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
      b 1151111
      .vers ВерсФорм 5.08

    h1.page__title Расчёт по страховым взносам
    .page__subtitle (форма по КНД 1151111)

    .kv-row
      .kv-cell
        .kv-label Номер корректировки
        .kv-value {{ header.correctionNumber || '0' }}
      .kv-cell
        .kv-label Расчётный (отчётный) период (код)
        .kv-value {{ header.period || '—' }}
      .kv-cell
        .kv-label Календарный год
        .kv-value {{ header.year }}
      .kv-cell
        .kv-label Код налогового органа
        .kv-value {{ header.kodNO || '—' }}
      .kv-cell
        .kv-label По месту (код)
        .kv-value {{ poMestu || '214' }}

    .kv-row
      .kv-cell.grow
        .kv-label Плательщик страховых взносов
        .kv-value.name {{ header.orgName || '—' }}

    .kv-row
      .kv-cell
        .kv-label ОКВЭД2
        .kv-value {{ header.okved || '—' }}
      .kv-cell
        .kv-label ОКТМО (см. Раздел 1)
        .kv-value {{ header.oktmo || '—' }}

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
      .kv-row(v-if='header.signerType === "representative"')
        .kv-cell.grow
          .kv-label Документ, подтверждающий полномочия
          .kv-value {{ header.signerRepDoc || '—' }}

    .signature-line
      .sig-col.signature
        .sig-label Подпись
        .sig-blank _______________________
      .sig-col.date
        .sig-label Дата
        .sig-blank {{ formatDate(header.docDate) }}

  //- Лист 2. Раздел 1 — сводная сумма к уплате
  section.page
    .page__corner
      .barcode {{ '|| ||| ||| ||| | |' }}
      .kpp(v-if='header.kpp') КПП {{ header.kpp }}
      .inn-row
        .inn-label ИНН
        .inn-digits
          .inn-cell(v-for='ch in padInn(header.inn)' :key='ch.idx') {{ ch.val }}
    .page__form-code
      | Форма по КНД
      br
      b 1151111

    h1.page__title(style='margin-top:22mm') Раздел 1
    .page__subtitle Сводные данные об обязательствах плательщика страховых взносов

    .empty-report-note
      q-icon(name='fa-solid fa-circle-info' size='20px')
      .note-body
        b Нулевой отчёт.
        | Блок «РасчетСВ» в XML пустой — облагаемая база, начисленные взносы
        | и численность застрахованных лиц за отчётный период = 0.

    table.data-table
      thead
        tr
          th(style='width:60%') Наименование показателя
          th(style='width:15%') Код строки
          th(style='width:25%') Значение
      tbody
        tr
          td Код ОКТМО
          td.code 010
          td.num {{ header.oktmo || '—' }}
        tr.section-title
          td(colspan='3') Страховые взносы на ОПС (пенсионное страхование)
        tr
          td Сумма к уплате за расчётный (отчётный) период
          td.code 020
          td.num 0
        tr.section-title
          td(colspan='3') Страховые взносы на ОМС (медицинское страхование)
        tr
          td Сумма к уплате за расчётный (отчётный) период
          td.code 040
          td.num 0
        tr.section-title
          td(colspan='3') Страховые взносы на ВНиМ (временная нетрудоспособность и материнство)
        tr
          td Сумма к уплате за расчётный (отчётный) период
          td.code 060
          td.num 0

    .signature-line
      .sig-col.signature
        .sig-label Подпись
        .sig-blank {{ fullSignerName || '_______________________' }}
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

const { header, getAttr, padInn, formatDate } = useReportXml(
  () => props.xml,
  () => props.requisites ?? null,
  () => props.year,
)

const poMestu = computed(() => getAttr('Документ', 'ПоМесту'))

const fullSignerName = computed(() => {
  const h = header.value
  return [h.signerLastName, h.signerFirstName, h.signerMiddleName].filter(Boolean).join(' ')
})
</script>

<style scoped lang="scss">
@use './_printable-form.scss';

.empty-report-note {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  background: #f5f7fa;
  border: 0.5pt solid #bbb;
  padding: 3mm 4mm;
  margin: 4mm 0;
  font-size: 10pt;
  color: #333;
  .note-body b { margin-right: 4px; }
}
</style>
