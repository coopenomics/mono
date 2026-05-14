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
      b 1151162
      .vers ВерсФорм 5.01

    h1.page__title Персонифицированные сведения о физических лицах

    .kv-row
      .kv-cell
        .kv-label Номер корректировки
        .kv-value {{ header.correctionNumber || '0' }}
      .kv-cell
        .kv-label Отчётный период (код)
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

  //- Лист 2. Раздел 3 — Персонифицированные сведения
  section.page
    .page__corner
      .barcode {{ '|| ||| || ||| || ||' }}
      .kpp(v-if='header.kpp') КПП {{ header.kpp }}
      .inn-row
        .inn-label ИНН
        .inn-digits
          .inn-cell(v-for='ch in padInn(header.inn)' :key='ch.idx') {{ ch.val }}
    .page__form-code
      | Форма по КНД
      br
      b 1151162

    h1.page__title(style='margin-top:22mm') Раздел 3
    .page__subtitle Персонифицированные сведения о физических лицах

    table.data-table
      thead
        tr
          th(style='width:5%') №
          th(style='width:22%') Фамилия
          th(style='width:20%') Имя
          th(style='width:20%') Отчество
          th(style='width:18%') СНИЛС
          th(style='width:15%') Сумма выплат, ₽
      tbody
        tr(v-for='(p, i) in persons' :key='i')
          td.num {{ i + 1 }}
          td {{ p.lastName || '—' }}
          td {{ p.firstName || '—' }}
          td {{ p.middleName || '—' }}
          td.code {{ p.snils || '—' }}
          td.num {{ fmtZero(p.sumVypl) }}
        tr(v-if='persons.length === 0')
          td.num —
          td(colspan='5') Нет персонифицированных сведений

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

const { header, doc, getAttr, padInn, formatDate, fmtZero } = useReportXml(
  () => props.xml,
  () => props.requisites ?? null,
  () => props.year,
)

const poMestu = computed(() => getAttr('Документ', 'ПоМесту'))

interface PersonRow {
  lastName: string
  firstName: string
  middleName: string
  snils: string
  sumVypl: number
}

const persons = computed<PersonRow[]>(() => {
  const d = doc.value
  if (!d) return []
  const nodes = Array.from(d.querySelectorAll('ПерсСвФЛ'))
  return nodes.map((n) => {
    const fio = n.querySelector('ФИО')
    return {
      lastName: fio?.getAttribute('Фамилия') ?? '',
      firstName: fio?.getAttribute('Имя') ?? '',
      middleName: fio?.getAttribute('Отчество') ?? '',
      snils: n.getAttribute('СНИЛС') ?? '',
      sumVypl: Number(n.getAttribute('СумВыпл') ?? '0'),
    }
  })
})

const fullSignerName = computed(() => {
  const h = header.value
  return [h.signerLastName, h.signerFirstName, h.signerMiddleName].filter(Boolean).join(' ')
})
</script>

<style scoped lang="scss">
@use './_printable-form.scss';
</style>
