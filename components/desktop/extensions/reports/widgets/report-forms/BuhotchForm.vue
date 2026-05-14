<template lang="pug">
.printable-form
  //- === Лист 1. Титульный ===
  section.page
    .page__corner
      .barcode {{ '|| | |||| |||| | |||' }}
      .kpp(v-if='header.kpp') КПП {{ header.kpp }}
      .inn-row
        .inn-label ИНН
        .inn-digits
          .inn-cell(v-for='ch in padInn(header.inn)' :key='ch.idx') {{ ch.val }}
    .page__form-code
      | Форма по КНД
      br
      b 0710096
    h1.page__title Упрощённая бухгалтерская (финансовая) отчётность

    .kv-row
      .kv-cell
        .kv-label Номер корректировки
        .kv-value {{ header.correctionNumber || '0' }}
      .kv-cell
        .kv-label Отчётный период (код)
        .kv-value {{ header.period || '91' }}
      .kv-cell
        .kv-label Отчётный год
        .kv-value {{ header.year }}

    .kv-row
      .kv-cell.grow
        .kv-label Наименование организации
        .kv-value.name {{ header.orgName || '—' }}

    .kv-row
      .kv-cell
        .kv-label ОКВЭД2
        .kv-value {{ header.okved || '—' }}
      .kv-cell
        .kv-label ОКПО
        .kv-value {{ header.okpo || '—' }}
      .kv-cell
        .kv-label ОКФС
        .kv-value {{ header.okfs || '—' }}
      .kv-cell
        .kv-label ОКОПФ
        .kv-value {{ header.okopf || '—' }}

    .kv-row
      .kv-cell.narrow
        .kv-label Единица измерения
        .kv-value тыс. ₽ (код ОКЕИ {{ header.okei || '384' }})

    .kv-row
      .kv-cell.grow
        .kv-label Местонахождение (адрес)
        .kv-value {{ header.address || '—' }}

    .signer-block
      .kv-row
        .kv-cell
          .kv-label Достоверность подтверждает
          .kv-value
            span(v-if='header.signerType === "chairman"') 1 — руководитель
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

  //- === Лист 2. Бухгалтерский баланс (0710001) ===
  section.page
    .page__corner
      .barcode {{ '|| |||| | ||| | ||||' }}
      .kpp(v-if='header.kpp') КПП {{ header.kpp }}
      .inn-row
        .inn-label ИНН
        .inn-digits
          .inn-cell(v-for='ch in padInn(header.inn)' :key='ch.idx') {{ ch.val }}
    .page__form-code
      | Форма по ОКУД
      br
      b 0710001
    h1.page__title(style='margin-top:22mm') Бухгалтерский баланс

    table.data-table
      thead
        tr
          th(style='width:45%') Наименование показателя
          th(style='width:10%') Код
          th(style='width:15%') На {{ dec31(header.year) }}
          th(style='width:15%') На 31.12.{{ header.year - 1 }}
          th(style='width:15%') На 31.12.{{ header.year - 2 }}
      tbody
        tr.section-title
          td(colspan='5') АКТИВ
        tr
          td Материальные внеоборотные активы
          td.code 1150
          td.num —
          td.num —
          td.num —
        tr
          td Нематериальные, финансовые и другие внеоборотные активы
          td.code 1170
          td.num {{ fmt(balance.asset.nonMatFin?.otch) }}
          td.num {{ fmt(balance.asset.nonMatFin?.prdPrev) }}
          td.num {{ fmt(balance.asset.nonMatFin?.prdPrePrev) }}
        tr
          td Запасы
          td.code 1210
          td.num —
          td.num —
          td.num —
        tr
          td Денежные средства и денежные эквиваленты
          td.code 1250
          td.num {{ fmt(balance.asset.cash?.otch) }}
          td.num {{ fmt(balance.asset.cash?.prdPrev) }}
          td.num {{ fmt(balance.asset.cash?.prdPrePrev) }}
        tr
          td Финансовые и другие оборотные активы
          td.code 1260
          td.num {{ fmt(balance.asset.finInv?.otch) }}
          td.num {{ fmt(balance.asset.finInv?.prdPrev) }}
          td.num {{ fmt(balance.asset.finInv?.prdPrePrev) }}
        tr.total
          td БАЛАНС
          td.code 1600
          td.num {{ fmt(balance.asset.total?.otch) }}
          td.num {{ fmt(balance.asset.total?.prdPrev) }}
          td.num {{ fmt(balance.asset.total?.prdPrePrev) }}

        tr.section-title
          td(colspan='5') ПАССИВ
        tr
          td Капитал и резервы
          td.code 1300
          td.num —
          td.num —
          td.num —
        tr
          td Целевые средства (паевой фонд + целевые поступления)
          td.code 1350
          td.num {{ fmt(balance.passive.target?.otch) }}
          td.num {{ fmt(balance.passive.target?.prdPrev) }}
          td.num {{ fmt(balance.passive.target?.prdPrePrev) }}
        tr
          td Долгосрочные заёмные средства
          td.code 1410
          td.num —
          td.num —
          td.num —
        tr
          td Краткосрочные заёмные средства
          td.code 1510
          td.num —
          td.num —
          td.num —
        tr
          td Кредиторская задолженность
          td.code 1520
          td.num —
          td.num —
          td.num —
        tr.total
          td БАЛАНС
          td.code 1700
          td.num {{ fmt(balance.passive.total?.otch) }}
          td.num {{ fmt(balance.passive.total?.prdPrev) }}
          td.num {{ fmt(balance.passive.total?.prdPrePrev) }}

    .note-balance(v-if='balanceDelta !== null')
      span(v-if='Math.abs(balanceDelta) <= 1') Актив равен пассиву (расхождение {{ balanceDelta }} тыс. ₽ — в пределах нормы округления)
      span.warn(v-else) ⚠️ Актив не равен пассиву: Δ = {{ balanceDelta }} тыс. ₽

    .signature-line
      .sig-col.signature
        .sig-label Руководитель
        .sig-blank {{ fullSignerName || '_______________________' }}
      .sig-col.date
        .sig-label Дата
        .sig-blank {{ formatDate(header.docDate) }}
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IReportRequisitesView } from 'src/entities/Report'
import { useReportXml, type BaseHeader } from './useReportXml'

interface BalanceRow {
  otch: number
  prdPrev: number
  prdPrePrev: number
}

interface ParsedBalance {
  asset: {
    nonMatFin?: BalanceRow
    cash?: BalanceRow
    finInv?: BalanceRow
    total?: BalanceRow
  }
  passive: {
    target?: BalanceRow
    total?: BalanceRow
  }
}

const props = defineProps<{
  xml: string
  requisites?: IReportRequisitesView | null
  year?: number
}>()

const { header, doc, getNum, padInn, formatDate, fmt } = useReportXml(
  () => props.xml,
  () => props.requisites ?? null,
  () => props.year,
)

const balance = computed<ParsedBalance>(() => {
  const out: ParsedBalance = { asset: {}, passive: {} }
  if (!doc.value) return out
  const readRow = (sel: string): BalanceRow => ({
    otch: getNum(sel, 'СумОтч'),
    prdPrev: getNum(sel, 'СумПрдщ'),
    prdPrePrev: getNum(sel, 'СумПрдшв'),
  })
  if (doc.value.querySelector('Актив')) {
    out.asset.total = readRow('Актив')
    if (doc.value.querySelector('Актив НеМатФинАкт')) out.asset.nonMatFin = readRow('Актив НеМатФинАкт')
    if (doc.value.querySelector('Актив ДенежнСр'))    out.asset.cash      = readRow('Актив ДенежнСр')
    if (doc.value.querySelector('Актив ФинВлож'))     out.asset.finInv    = readRow('Актив ФинВлож')
  }
  if (doc.value.querySelector('Пассив')) {
    out.passive.total = readRow('Пассив')
    if (doc.value.querySelector('Пассив ЦелевСредства')) out.passive.target = readRow('Пассив ЦелевСредства')
  }
  return out
})

const fullSignerName = computed(() => {
  const h = header.value
  return [h.signerLastName, h.signerFirstName, h.signerMiddleName].filter(Boolean).join(' ')
})

const balanceDelta = computed(() => {
  const a = balance.value.asset.total?.otch
  const p = balance.value.passive.total?.otch
  if (a == null || p == null) return null
  return a - p
})

function dec31(year: number): string {
  return `31 декабря ${year} г.`
}

// Re-expose для template — defineProps-хуки не поднимают helpers в scope pug
void (header as { value: BaseHeader })
</script>

<style scoped lang="scss">
@use './_printable-form.scss';

.note-balance {
  margin-top: 4mm;
  font-size: 9pt;
  font-style: italic;
  color: #444;
  .warn { color: #a00; font-weight: bold; font-style: normal; }
}
</style>
