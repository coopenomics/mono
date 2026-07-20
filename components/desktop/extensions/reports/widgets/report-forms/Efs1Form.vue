<template lang="pug">
.printable-form
  //- Лист 1. Титульный ЕФС-1
  section.page
    .page__corner
      .barcode {{ '|| | |||| | |||  |' }}
      .kpp(v-if='header.kpp') КПП {{ header.kpp }}
      .inn-row
        .inn-label ИНН
        .inn-digits
          .inn-cell(v-for='ch in padInn(header.inn)' :key='ch.idx') {{ ch.val }}
    .page__form-code
      | Форма ЕФС-1
      br
      b СФР
      .vers прик. №1462 от 17.11.2025

    h1.page__title Единая форма ЕФС-1
    .page__subtitle Сведения для ведения индивидуального (персонифицированного) учёта
    .page__subtitle(style='font-style:italic') и сведения о начисленных страховых взносах от несчастных случаев

    .kv-row
      .kv-cell.grow
        .kv-label Страхователь
        .kv-value.name {{ header.orgName || '—' }}

    .kv-row
      .kv-cell
        .kv-label Регистрационный номер в СФР
        .kv-value.code {{ header.sfrRegNumber || '—' }}
      .kv-cell
        .kv-label ОГРН
        .kv-value.code {{ ogrn || '—' }}
      .kv-cell
        .kv-label ОКВЭД
        .kv-value {{ header.okved || '—' }}

    .kv-row
      .kv-cell
        .kv-label Номер корректировки
        .kv-value {{ header.correctionNumber || '000' }}
      .kv-cell
        .kv-label Отчётный период (код СФР)
        .kv-value {{ period.code || '—' }} ({{ periodLabel(period.code) }})
      .kv-cell
        .kv-label Отчётный год
        .kv-value {{ period.year || header.year }}
      .kv-cell
        .kv-label Дата заполнения
        .kv-value {{ formatDate(fillDate) }}

    .section-heading Раздел 2. Страховые взносы «от несчастных случаев»

    table.data-table
      thead
        tr
          th(style='width:55%') Наименование показателя
          th(style='width:45%') Значение
      tbody
        tr.section-title
          td(colspan='2') Численность
        tr
          td Среднесписочная численность
          td.num {{ fmtZero(chisl.srednesp) }}
        tr
          td Численность работников, подлежащих ОСС
          td.num {{ fmtZero(chisl.rabObSocStrah) }}
        tr.section-title
          td(colspan='2') Подраздел 2.1 — Расчёт сумм страховых взносов (РССВ)
        tr
          td Страховой тариф
          td.num {{ rssv.tariff || '0.20' }}
        tr
          td Скидка к тарифу
          td.num {{ rssv.skidka || '0.00' }}
        tr
          td Надбавка к тарифу
          td.num {{ rssv.nadbavka || '0.00' }}
        tr
          td Тариф с учётом скидки/надбавки
          td.num {{ rssv.tarifUchet || '0.200' }}
        tr
          td База для исчисления (всего с начала)
          td.num {{ fmtZero(bazaWithStart) }}
        tr
          td Сумма исчисленных страховых взносов (всего с начала)
          td.num {{ fmtZero(ischislWithStart) }}
        tr.section-title
          td(colspan='2') Подраздел 2.3 — Результаты СОУТ
        tr
          td Общая численность работников
          td.num {{ fmtZero(rpo.obChisl) }}
        tr
          td Численность, прошедших СОУТ
          td.num {{ fmtZero(rpo.proshChisl) }}
        tr
          td Количество рабочих мест (оценено)
          td.num {{ fmtZero(rpo.kolRabMest) }}

    .signer-block
      .kv-row
        .kv-cell
          .kv-label Руководитель — ФИО
          .kv-value {{ fullSignerName || '—' }}
        .kv-cell
          .kv-label Должность
          .kv-value {{ chairmanPosition || 'Председатель Совета' }}

    .signature-line
      .sig-col.signature
        .sig-label Подпись
        .sig-blank _______________________
      .sig-col.date
        .sig-label Дата
        .sig-blank {{ formatDate(fillDate) }}
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

const { header, doc, getByLocal, getText, padInn, formatDate, fmtZero } = useReportXml(
  () => props.xml,
  () => props.requisites ?? null,
  () => props.year,
)

const ogrn = computed(() => getText('ОГРН'))
const fillDate = computed(() => getText('ДатаЗаполнения'))
const chairmanPosition = computed(() => getText('Должность'))

const period = computed(() => {
  // В XML ЕФС-1 структура:
  //   <ОСС><Период><Код>03</Код><Год>2026</Год></Период></ОСС>
  // Простого attr нет — читаем текстом из вложенных узлов, уникальных для ОСС.
  const oss = getByLocal('ОСС')
  if (!oss) return { code: '', year: '' }
  // Внутри ОСС есть <Период>, внутри него <Код> и <Год>.
  const per = Array.from(oss.children).find((c) => c.localName === 'Период')
  if (!per) return { code: '', year: '' }
  const codeEl = Array.from(per.children).find((c) => c.localName === 'Код')
  const yearEl = Array.from(per.children).find((c) => c.localName === 'Год')
  return {
    code: codeEl?.textContent?.trim() ?? '',
    year: yearEl?.textContent?.trim() ?? '',
  }
})

const chisl = computed(() => {
  const c = getByLocal('Численность')
  if (!c) return { srednesp: 0, rabObSocStrah: 0 }
  const num = (local: string) => {
    const el = Array.from(c.children).find((x) => x.localName === local)
    return Number(el?.textContent?.trim() ?? '0')
  }
  return {
    srednesp: num('Среднесписочная'),
    rabObSocStrah: num('РабПоОбСоцСтрах'),
  }
})

const rssv = computed(() => {
  const r = getByLocal('РССВ')
  if (!r) return { tariff: '', skidka: '', nadbavka: '', tarifUchet: '' }
  const txt = (local: string) => {
    const el = Array.from(r.children).find((x) => x.localName === local)
    return el?.textContent?.trim() ?? ''
  }
  return {
    tariff: txt('СтраховойТариф'),
    skidka: txt('СкидкаТариф'),
    nadbavka: txt('НадбавкаТариф'),
    tarifUchet: txt('ТарифУчСкидНадб'),
  }
})

// В РССВ есть группы <БазаИсч><ВсегоСНачала>0</ВсегоСНачала>...</БазаИсч>
// и <ИсчислСтрахВзн><ВсегоСНачала>...</>. Достаём «Всего с начала» — это то,
// что бухгалтер видит как итог за период.
function vsegoSNachala(groupLocal: string): number {
  const d = doc.value
  if (!d) return 0
  const group = Array.from(d.getElementsByTagNameNS('*', groupLocal))[0]
  if (!group) return 0
  const el = Array.from(group.children).find((x) => x.localName === 'ВсегоСНачала')
  return Number(el?.textContent?.trim() ?? '0')
}

const bazaWithStart = computed(() => vsegoSNachala('БазаИсч'))
const ischislWithStart = computed(() => vsegoSNachala('ИсчислСтрахВзн'))

const rpo = computed(() => {
  const r = getByLocal('РПО')
  if (!r) return { obChisl: 0, proshChisl: 0, kolRabMest: 0 }
  const num = (path: string[]): number => {
    let cur: Element | null = r
    for (const local of path) {
      if (!cur) return 0
      cur = Array.from(cur.children).find((x) => x.localName === local) ?? null
    }
    return Number(cur?.textContent?.trim() ?? '0')
  }
  return {
    obChisl: num(['ОбщЧисл']),
    proshChisl: num(['ПрошЧисл']),
    kolRabMest: num(['Результат', 'КоличРабМест']),
  }
})

const fullSignerName = computed(() => {
  const h = header.value
  return [h.signerLastName, h.signerFirstName, h.signerMiddleName].filter(Boolean).join(' ')
})

// СФР-коды периодов отличаются от ФНС: 03=I кв., 06=полугодие,
// 09=9 мес., 0=год (IV квартал).
const PERIOD_LABELS: Record<string, string> = {
  '03': 'I квартал',
  '06': 'полугодие',
  '09': '9 месяцев',
  '0': 'год',
}
function periodLabel(code: string): string {
  return PERIOD_LABELS[code] ?? (code || '—')
}
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
