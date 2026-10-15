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

  //- Приложение № 1. Справка о доходах и суммах налога физического лица —
  //- по одному листу на получателя, только в годовом отчёте.
  section.page(v-for='certificate in certificates' :key='certificate.number')
    .page__corner
      .barcode {{ '||| | ||  ||| | ||' }}
      .kpp(v-if='header.kpp') КПП {{ header.kpp }}
      .inn-row
        .inn-label ИНН
        .inn-digits
          .inn-cell(v-for='ch in padInn(header.inn)' :key='ch.idx') {{ ch.val }}
    .page__form-code
      | Приложение № 1
      br
      b к форме 6-НДФЛ

    h2.section-heading Справка о доходах и суммах налога физического лица

    .kv-row
      .kv-cell
        .kv-label Номер справки
        .kv-value {{ certificate.number }}
      .kv-cell
        .kv-label Номер корректировки
        .kv-value {{ certificate.correction }}
      .kv-cell
        .kv-label Отчётный год
        .kv-value {{ header.year }}

    h3.section-heading Раздел 1. Сведения о физическом лице — получателе дохода

    .kv-row
      .kv-cell.grow
        .kv-label Фамилия, имя, отчество
        .kv-value {{ certificate.fullName }}
    .kv-row
      .kv-cell
        .kv-label Дата рождения
        .kv-value {{ certificate.birthDate || '—' }}
      .kv-cell
        .kv-label Гражданство (код страны)
        .kv-value {{ certificate.citizenship || '—' }}
      .kv-cell
        .kv-label Статус налогоплательщика
        .kv-value {{ certificate.status || '—' }}
    .kv-row
      .kv-cell
        .kv-label Код вида документа
        .kv-value {{ certificate.documentType || '—' }}
      .kv-cell.grow
        .kv-label Серия и номер документа
        .kv-value {{ certificate.documentNumber || '—' }}

    h3.section-heading Раздел 2. Общая сумма дохода и сумма налога по итогам налогового периода

    table.data-table
      tbody
        tr
          td Ставка налога
          td.code 100
          td.num {{ certificate.rate }}
        tr
          td Код бюджетной классификации
          td.code 105
          td.num {{ certificate.kbk }}
        tr
          td Общая сумма дохода
          td.code 110
          td.num {{ fmtZero(certificate.income) }}
        tr
          td Налоговая база
          td.code 120
          td.num {{ fmtZero(certificate.taxBase) }}
        tr
          td Сумма налога исчисленная
          td.code 130
          td.num {{ fmtZero(certificate.taxCalculated) }}
        tr.total
          td Сумма налога удержанная
          td.code 160
          td.num {{ fmtZero(certificate.taxWithheld) }}

    h3.section-heading Приложение. Сведения о доходах по месяцам налогового периода

    table.data-table
      thead
        tr
          th Месяц
          th Код дохода
          th Сумма дохода
      tbody
        tr(v-for='(row, index) in certificate.months' :key='index')
          td {{ row.month }}
          td {{ row.code }}
          td.num {{ fmtZero(row.amount) }}
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

const { header, getAttr, getNum, getAllByLocal, padInn, formatDate, fmtZero } = useReportXml(
  () => props.xml,
  () => props.requisites ?? null,
  () => props.year,
)

// i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
// i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
const poMestu = computed(() => getAttr('Документ', 'ПоМесту'))

const MONTH_NAMES = [
  // i18n-ignore: официальная форма
  // i18n-ignore: официальная форма
  // i18n-ignore: официальная форма
  // i18n-ignore: официальная форма
  // i18n-ignore: официальная форма
  // i18n-ignore: официальная форма
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  // i18n-ignore: официальная форма
  // i18n-ignore: официальная форма
  // i18n-ignore: официальная форма
  // i18n-ignore: официальная форма
  // i18n-ignore: официальная форма
  // i18n-ignore: официальная форма
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

/**
 * Справки о доходах из приложения № 1. В квартальных отчётах их нет —
 * схема допускает справки только в годовом, поэтому список пуст и листы
 * не печатаются.
 */
const certificates = computed(() =>
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  getAllByLocal('СправДох').map((node) => {
    // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
    const receiver = node.getElementsByTagNameNS('*', 'ПолучДох')[0] ?? null
    // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
    const fio = node.getElementsByTagNameNS('*', 'ФИО')[0] ?? null
    // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
    const document = node.getElementsByTagNameNS('*', 'УдЛичнФЛ')[0] ?? null
    // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
    const income = node.getElementsByTagNameNS('*', 'СведДох')[0] ?? null
    // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
    const totals = node.getElementsByTagNameNS('*', 'СумИтНалПер')[0] ?? null

    const attr = (el: Element | null, name: string): string => el?.getAttribute(name) ?? ''
    const num = (el: Element | null, name: string): number => {
      const parsed = Number(attr(el, name))
      return Number.isFinite(parsed) ? parsed : 0
    }

    // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
    // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
    // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
    const fullName = [attr(fio, 'Фамилия'), attr(fio, 'Имя'), attr(fio, 'Отчество')]
      .filter(Boolean)
      .join(' ')

    return {
      // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
      number: attr(node, 'НомСпр'),
      // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
      correction: attr(node, 'НомКорр'),
      fullName: fullName || '—',
      // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
      birthDate: attr(receiver, 'ДатаРожд'),
      // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
      citizenship: attr(receiver, 'Гражд'),
      // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
      status: attr(receiver, 'Статус'),
      // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
      documentType: attr(document, 'КодУдЛичн'),
      // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
      documentNumber: attr(document, 'СерНомДок'),
      // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
      rate: attr(income, 'Ставка'),
      // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
      kbk: attr(income, 'КБК'),
      // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
      income: num(totals, 'СумДохОбщ'),
      // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
      taxBase: num(totals, 'НалБаза'),
      // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
      taxCalculated: num(totals, 'НалИсчисл'),
      // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
      taxWithheld: num(totals, 'НалУдерж'),
      // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
      months: Array.from(node.getElementsByTagNameNS('*', 'СвСумДох')).map((row) => ({
        // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
        // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
        month: MONTH_NAMES[Number(row.getAttribute('Месяц')) - 1] ?? row.getAttribute('Месяц'),
        // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
        code: row.getAttribute('КодДоход') ?? '',
        // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
        amount: Number(row.getAttribute('СумДоход')) || 0,
      })),
    }
  }),
)

const obyaz = computed(() => ({
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  kbk: getAttr('ОбязНА', 'КБК'),
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  sumNalUd: getNum('ОбязНА', 'СумНалУд'),
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  sumNalVoz: getNum('ОбязНА', 'СумНалВоз'),
}))

const ud = computed(() => ({
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  sum1: getNum('СведСумНалУд', 'СумНал1Срок'),
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  sum2: getNum('СведСумНалУд', 'СумНал2Срок'),
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  sum3: getNum('СведСумНалУд', 'СумНал3Срок'),
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  sum4: getNum('СведСумНалУд', 'СумНал4Срок'),
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  sum5: getNum('СведСумНалУд', 'СумНал5Срок'),
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  sum6: getNum('СведСумНалУд', 'СумНал6Срок'),
}))

const rasch = computed(() => ({
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  stavka: getAttr('РасчСумНал', 'Ставка'),
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  kbk: getAttr('РасчСумНал', 'КБК'),
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  kolFL: getNum('РасчСумНал', 'КолФЛ'),
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  sumNachislNach: getNum('РасчСумНал', 'СумНачислНач'),
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  sumVych: getNum('РасчСумНал', 'СумВыч'),
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  nalBaza: getNum('РасчСумНал', 'НалБаза'),
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  sumNalIsch: getNum('РасчСумНал', 'СумНалИсч'),
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  sumNalUderzh: getNum('РасчСумНал', 'СумНалУдерж'),
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  sumNalNeUd: getNum('РасчСумНал', 'СумНалНеУдерж'),
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  sumNalIzlUd: getNum('РасчСумНал', 'СумНалИзлУдерж'),
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
  // i18n-ignore: XML-идентификатор для поиска узла в отчёте, не текст интерфейса
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
