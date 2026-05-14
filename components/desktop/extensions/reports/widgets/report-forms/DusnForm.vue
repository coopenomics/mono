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
      b 1152017
      .vers ВерсФорм 5.09

    h1.page__title Налоговая декларация по налогу,
    .page__subtitle уплачиваемому в связи с применением упрощённой системы налогообложения

    .kv-row
      .kv-cell
        .kv-label Номер корректировки
        .kv-value {{ header.correctionNumber || '0' }}
      .kv-cell
        .kv-label Налоговый период (код)
        .kv-value {{ header.period || '34' }}
      .kv-cell
        .kv-label Отчётный год
        .kv-value {{ header.year }}
      .kv-cell
        .kv-label Код налогового органа
        .kv-value {{ header.kodNO || '—' }}
      .kv-cell
        .kv-label По месту нахождения (код)
        .kv-value {{ poMestu || '210' }}

    .kv-row
      .kv-cell.grow
        .kv-label Налогоплательщик
        .kv-value.name {{ header.orgName || '—' }}

    .kv-row
      .kv-cell
        .kv-label ОКВЭД2
        .kv-value {{ header.okved || '—' }}
      .kv-cell.grow
        .kv-label Номер контактного телефона
        .kv-value —

    .signer-block
      .kv-row
        .kv-cell
          .kv-label Достоверность подтверждает
          .kv-value
            span(v-if='header.signerType === "chairman"') 1 — налогоплательщик
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

  //- Лист 2. Раздел 1.1 — Сумма налога к уплате
  section.page
    .page__corner
      .barcode {{ '|| || | ||| | ||||' }}
      .kpp(v-if='header.kpp') КПП {{ header.kpp }}
      .inn-row
        .inn-label ИНН
        .inn-digits
          .inn-cell(v-for='ch in padInn(header.inn)' :key='ch.idx') {{ ch.val }}
    .page__form-code
      | Форма по КНД
      br
      b 1152017

    h1.page__title(style='margin-top:22mm') Раздел 1.1
    .page__subtitle Сумма налога, подлежащая уплате (объект «доходы»)

    table.data-table
      thead
        tr
          th(style='width:60%') Наименование показателя
          th(style='width:15%') Код строки
          th(style='width:25%') Значение
      tbody
        tr
          td Код по ОКТМО
          td.code 010
          td.num {{ header.oktmo || '—' }}
        tr
          td Сумма авансового платежа к уплате за I квартал
          td.code 020
          td.num —
        tr
          td Сумма авансового платежа к уплате за полугодие
          td.code 040
          td.num —
        tr
          td Сумма авансового платежа к уплате за 9 месяцев
          td.code 070
          td.num —
        tr.total
          td Сумма налога к уплате за налоговый период
          td.code 100
          td.num {{ fmtZero(section.nalPUUmen) }}

    .section-heading.q-mt-md Раздел 2.1.1 — Расчёт налога (объект «доходы»)

    table.data-table
      thead
        tr
          th(style='width:60%') Наименование показателя
          th(style='width:15%') Код строки
          th(style='width:25%') Значение
      tbody
        tr
          td Признак налогоплательщика
          td.code 101
          td.num {{ section.priznNP || '1' }}
        tr
          td Объект налогообложения
          td.code 102
          td.num {{ section.obNal || '1' }} (доходы)
        tr
          td Сумма полученных доходов за налоговый период
          td.code 113
          td.num {{ fmtZero(rasch.dohod) }}
        tr
          td Ставка налога, %
          td.code 123
          td.num {{ rasch.stavka ?? '0' }}
        tr
          td Сумма исчисленного налога
          td.code 133
          td.num {{ fmtZero(rasch.ischisl) }}
        tr
          td Сумма страховых взносов, уменьшающая налог
          td.code 143
          td.num {{ fmtZero(rasch.umenNal) }}

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

const { header, doc, getAttr, getNum, padInn, formatDate, fmtZero } = useReportXml(
  () => props.xml,
  () => props.requisites ?? null,
  () => props.year,
)

const poMestu = computed(() => getAttr('Документ', 'ПоМесту'))

const section = computed(() => ({
  priznNP: getAttr('УСН СумНалПУ_НП РасчНал1', 'ПризНП') || getAttr('РасчНал1', 'ПризНП'),
  obNal: getAttr('УСН', 'ОбНал'),
  nalPUUmen: getNum('УСН СумНалПУ_НП', 'НалПУУменПер'),
}))

const rasch = computed(() => {
  if (!doc.value) return { dohod: 0, stavka: 0, ischisl: 0, umenNal: 0 }
  return {
    dohod: getNum('РасчНал1 Доход', 'СумЗаНалПер'),
    stavka: getNum('РасчНал1 Ставка', 'СтавкаНалПер'),
    ischisl: getNum('РасчНал1 Исчисл', 'СумЗаНалПер'),
    umenNal: getNum('РасчНал1 УменНал', 'СумЗаНалПер'),
  }
})

const fullSignerName = computed(() => {
  const h = header.value
  return [h.signerLastName, h.signerFirstName, h.signerMiddleName].filter(Boolean).join(' ')
})
</script>

<style scoped lang="scss">
@use './_printable-form.scss';
</style>
