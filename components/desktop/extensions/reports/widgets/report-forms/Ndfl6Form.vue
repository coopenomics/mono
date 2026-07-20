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
      b 1151100
      .vers ВерсФорм 5.05

    h1.page__title Расчёт сумм налога на доходы физических лиц,
    .page__subtitle исчисленных и удержанных налоговым агентом (форма 6-НДФЛ)

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
        .kv-label Налоговый агент
        .kv-value.name {{ header.orgName || '—' }}

    .kv-row
      .kv-cell
        .kv-label Код ОКТМО
        .kv-value {{ header.oktmo || '—' }}
      .kv-cell.grow
        .kv-label ОКВЭД2
        .kv-value {{ header.okved || '—' }}

    .signer-block
      .kv-row
        .kv-cell
          .kv-label Достоверность подтверждает
          .kv-value
            span(v-if='header.signerType === "chairman"') 1 — налоговый агент
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

  //- Лист 2. Раздел 1 — Данные об обязательствах налогового агента
  section.page
    .page__corner
      .barcode {{ '|| | ||| | |||| | |' }}
      .kpp(v-if='header.kpp') КПП {{ header.kpp }}
      .inn-row
        .inn-label ИНН
        .inn-digits
          .inn-cell(v-for='ch in padInn(header.inn)' :key='ch.idx') {{ ch.val }}
    .page__form-code
      | Форма по КНД
      br
      b 1151100

    h1.page__title(style='margin-top:22mm') Раздел 1
    .page__subtitle Данные об обязательствах налогового агента

    table.data-table
      thead
        tr
          th(style='width:60%') Наименование показателя
          th(style='width:15%') Код строки
          th(style='width:25%') Значение
      tbody
        tr
          td Код бюджетной классификации (КБК)
          td.code 010
          td.num {{ obyaz.kbk || '—' }}
        tr
          td Сумма налога, удержанная (всего за период)
          td.code 020
          td.num {{ fmtZero(obyaz.sumNalUd) }}
        tr.section-title
          td(colspan='3') Сумма налога, удержанная по срокам
        tr
          td Срок 1
          td.code 021
          td.num {{ fmtZero(ud.sum1) }}
        tr
          td Срок 2
          td.code 022
          td.num {{ fmtZero(ud.sum2) }}
        tr
          td Срок 3
          td.code 023
          td.num {{ fmtZero(ud.sum3) }}
        tr
          td Срок 4
          td.code 024
          td.num {{ fmtZero(ud.sum4) }}
        tr
          td Срок 5
          td.code 025
          td.num {{ fmtZero(ud.sum5) }}
        tr
          td Срок 6
          td.code 026
          td.num {{ fmtZero(ud.sum6) }}
        tr.total
          td Сумма налога, возвращённая (всего за период)
          td.code 030
          td.num {{ fmtZero(obyaz.sumNalVoz) }}

  //- Лист 3. Раздел 2 — Расчёт исчисленных и удержанных сумм
  section.page
    .page__corner
      .barcode {{ '|| ||| | || | ||||' }}
      .kpp(v-if='header.kpp') КПП {{ header.kpp }}
      .inn-row
        .inn-label ИНН
        .inn-digits
          .inn-cell(v-for='ch in padInn(header.inn)' :key='ch.idx') {{ ch.val }}
    .page__form-code
      | Форма по КНД
      br
      b 1151100

    h1.page__title(style='margin-top:22mm') Раздел 2
    .page__subtitle Расчёт исчисленных, удержанных и перечисленных сумм НДФЛ

    table.data-table
      thead
        tr
          th(style='width:65%') Наименование показателя
          th(style='width:10%') Код
          th(style='width:25%') Значение
      tbody
        tr
          td Ставка налога, %
          td.code 100
          td.num {{ rasch.stavka || '13' }}
        tr
          td КБК
          td.code 105
          td.num {{ rasch.kbk || '—' }}
        tr
          td Количество физических лиц, получивших доход
          td.code 110
          td.num {{ fmtZero(rasch.kolFL) }}
        tr
          td Сумма дохода начисленная
          td.code 120
          td.num {{ fmtZero(rasch.sumNachislNach) }}
        tr
          td Сумма вычетов
          td.code 130
          td.num {{ fmtZero(rasch.sumVych) }}
        tr
          td Налоговая база
          td.code 131
          td.num {{ fmtZero(rasch.nalBaza) }}
        tr
          td Сумма налога исчисленная
          td.code 140
          td.num {{ fmtZero(rasch.sumNalIsch) }}
        tr
          td Сумма налога удержанная
          td.code 160
          td.num {{ fmtZero(rasch.sumNalUderzh) }}
        tr
          td Сумма налога не удержанная
          td.code 170
          td.num {{ fmtZero(rasch.sumNalNeUd) }}
        tr
          td Сумма налога излишне удержанная
          td.code 180
          td.num {{ fmtZero(rasch.sumNalIzlUd) }}
        tr.total
          td Сумма налога возвращённая
          td.code 190
          td.num {{ fmtZero(rasch.sumNalVozvr) }}

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

const { header, getAttr, getNum, padInn, formatDate, fmtZero } = useReportXml(
  () => props.xml,
  () => props.requisites ?? null,
  () => props.year,
)

const poMestu = computed(() => getAttr('Документ', 'ПоМесту'))

const obyaz = computed(() => ({
  kbk: getAttr('ОбязНА', 'КБК'),
  sumNalUd: getNum('ОбязНА', 'СумНалУд'),
  sumNalVoz: getNum('ОбязНА', 'СумНалВоз'),
}))

const ud = computed(() => ({
  sum1: getNum('СведСумНалУд', 'СумНал1Срок'),
  sum2: getNum('СведСумНалУд', 'СумНал2Срок'),
  sum3: getNum('СведСумНалУд', 'СумНал3Срок'),
  sum4: getNum('СведСумНалУд', 'СумНал4Срок'),
  sum5: getNum('СведСумНалУд', 'СумНал5Срок'),
  sum6: getNum('СведСумНалУд', 'СумНал6Срок'),
}))

const rasch = computed(() => ({
  stavka: getAttr('РасчСумНал', 'Ставка'),
  kbk: getAttr('РасчСумНал', 'КБК'),
  kolFL: getNum('РасчСумНал', 'КолФЛ'),
  sumNachislNach: getNum('РасчСумНал', 'СумНачислНач'),
  sumVych: getNum('РасчСумНал', 'СумВыч'),
  nalBaza: getNum('РасчСумНал', 'НалБаза'),
  sumNalIsch: getNum('РасчСумНал', 'СумНалИсч'),
  sumNalUderzh: getNum('РасчСумНал', 'СумНалУдерж'),
  sumNalNeUd: getNum('РасчСумНал', 'СумНалНеУдерж'),
  sumNalIzlUd: getNum('РасчСумНал', 'СумНалИзлУдерж'),
  sumNalVozvr: getNum('РасчСумНал', 'СумНалВозвр'),
}))

const fullSignerName = computed(() => {
  const h = header.value
  return [h.signerLastName, h.signerFirstName, h.signerMiddleName].filter(Boolean).join(' ')
})
</script>

<style scoped lang="scss">
@use './_printable-form.scss';

.section-title {
  font-size: var(--p-fs-h2);
  font-weight: 600;
  color: var(--p-ink);

  @media (max-width: 768px) {
    font-size: var(--p-fs-h3);
  }
}
</style>
