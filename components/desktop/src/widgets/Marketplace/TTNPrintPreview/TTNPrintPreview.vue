<template>
  <div class="mp-ttn">
    <div class="mp-ttn__toolbar">
      <BaseButton variant="primary" @click="print">
        <template #icon-left>
          <q-icon name="print" size="16px" />
        </template>
        Печать
      </BaseButton>
      <BaseButton variant="ghost" @click="download">
        <template #icon-left>
          <q-icon name="download" size="16px" />
        </template>
        Скачать
      </BaseButton>
      <q-space />
      <span class="text-caption text-grey-7">Формат А5 (148×210 мм)</span>
    </div>

    <div ref="sheetRef" class="mp-ttn__sheet">
      <header class="mp-ttn__header">
        <div>
          <div class="text-h6">ТТН № {{ data.number }}</div>
          <div class="text-caption">от {{ formatDate(data.date) }}</div>
        </div>
        <div class="mp-ttn__codes">
          <BarcodeDisplay :code="data.number" size="sm" />
          <div v-if="qrDataUrl" class="mp-ttn__qr">
            <img :src="qrDataUrl" alt="QR-код приёмки партии" class="mp-ttn__qr-img" />
            <div class="text-caption mp-ttn__qr-cap">Скан оператором КУ — приёмка партии</div>
          </div>
        </div>
      </header>

      <section class="mp-ttn__parties">
        <div>
          <div class="text-caption text-grey-7">Поставщик</div>
          <div>{{ data.supplier }}</div>
        </div>
        <div>
          <div class="text-caption text-grey-7">Получатель / ПВЗ</div>
          <div>{{ data.recipient }}</div>
        </div>
      </section>

      <table class="mp-ttn__items">
        <thead>
          <tr>
            <th>№</th>
            <th>SKU</th>
            <th>Наименование</th>
            <th>Кол-во</th>
            <th>Ед.</th>
            <th>Цена</th>
            <th>Сумма</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(i, idx) in data.items" :key="i.sku">
            <td>{{ idx + 1 }}</td>
            <td>{{ i.sku }}</td>
            <td>{{ i.title }}</td>
            <td class="text-right">{{ i.qty }}</td>
            <td>{{ i.unit }}</td>
            <td class="text-right">{{ formatPrice(i.price) }}</td>
            <td class="text-right">{{ formatPrice(i.qty * i.price) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="6" class="text-right">Итого:</td>
            <td class="text-right"><strong>{{ formatPrice(total) }}</strong></td>
          </tr>
        </tfoot>
      </table>

      <footer class="mp-ttn__signatures">
        <div>
          <div class="text-caption text-grey-7">Отгрузил</div>
          <div class="mp-ttn__sign-line" />
          <div class="text-caption">{{ data.dispatchedBy }}</div>
        </div>
        <div>
          <div class="text-caption text-grey-7">Принял</div>
          <div class="mp-ttn__sign-line" />
          <div class="text-caption">{{ data.acceptedBy ?? '____________________' }}</div>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type PropType } from 'vue'
import QRCode from 'qrcode'
import { BaseButton } from 'src/shared/ui/base'
import { SuccessAlert } from 'src/shared/api'
import { BarcodeDisplay } from 'src/widgets/Marketplace/BarcodeDisplay'

export interface TTNItem {
  sku: string
  title: string
  qty: number
  unit: string
  price: number
}

export interface TTNData {
  number: string
  date: string | Date
  supplier: string
  recipient: string
  items: TTNItem[]
  dispatchedBy: string
  acceptedBy?: string
  /**
   * Код приёмки партии (shipment-bound handoff-токен). Печатается на ТТН как QR:
   * оператор КУ сканирует его и принимает СТРОГО состав этой партии (экспедитор
   * не пайщик — приёмка по накладной, а не по аккаунту).
   */
  qrValue?: string
}

const props = defineProps({
  data: { type: Object as PropType<TTNData>, required: true },
})

const sheetRef = ref<HTMLElement | null>(null)

// QR кода приёмки партии — PNG data-URL (встраивается в печать и в скачанный
// самодостаточный HTML без внешних зависимостей).
const qrDataUrl = ref('')
watch(
  () => props.data.qrValue,
  async (value) => {
    if (!value) {
      qrDataUrl.value = ''
      return
    }
    try {
      qrDataUrl.value = await QRCode.toDataURL(value, { margin: 1, width: 132, errorCorrectionLevel: 'M' })
    } catch {
      qrDataUrl.value = ''
    }
  },
  { immediate: true },
)

const total = computed(() => props.data.items.reduce((acc, i) => acc + i.qty * i.price, 0))

function formatDate(v: string | Date) {
  const d = typeof v === 'string' ? new Date(v) : v
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatPrice(v: number) {
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' ₽'
}

/**
 * CSS печатного листа — самодостаточный, без Quasar/scoped-стилей. В iframe и
 * blob-скачивании нет ни Quasar, ни scoped data-v, поэтому селекторы здесь по
 * простым классам и включают использованные внутри листа utility-классы.
 * Это единственное дублирование (CSS), разметка остаётся одна — клонируем
 * отрендеренный `sheetRef`, не пересобираем HTML руками.
 */
const PRINT_CSS = `
  @page { size: A5; margin: 0; }
  html, body { margin: 0; padding: 0; }
  body { background: #fff; }
  .mp-ttn__sheet {
    background: #fff; color: #111; width: 148mm; min-height: 210mm;
    padding: 10mm; margin: 0 auto; font-size: 11pt; font-family: 'Times New Roman', serif;
  }
  .mp-ttn__header {
    display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 1px solid #111; padding-bottom: 4mm; margin-bottom: 4mm;
  }
  .mp-ttn__parties { display: flex; justify-content: space-between; margin-bottom: 6mm; }
  .mp-ttn__items { width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 6mm; }
  .mp-ttn__items th, .mp-ttn__items td { border: 1px solid #111; padding: 2mm; }
  .mp-ttn__items th { background: #f0f0f0; }
  .mp-ttn__signatures { display: flex; justify-content: space-between; margin-top: 10mm; gap: 16mm; }
  .mp-ttn__signatures > div { flex: 1; }
  .mp-ttn__sign-line { margin: 8mm 0 2mm; border-bottom: 1px solid #111; height: 0; }
  .mp-barcode-display__svg { display: block; }
  .mp-barcode-display__code { font-size: 8pt; text-align: center; }
  .mp-ttn__codes { display: flex; flex-direction: column; align-items: center; gap: 3mm; }
  .mp-ttn__qr { display: flex; flex-direction: column; align-items: center; }
  .mp-ttn__qr-img { width: 28mm; height: 28mm; display: block; }
  .mp-ttn__qr-cap { font-size: 7pt; text-align: center; max-width: 32mm; color: #555; }
  .text-right { text-align: right; }
  .text-caption { font-size: 0.85em; }
  .text-grey-7 { color: #555; }
  .text-h6 { font-size: 1.25rem; font-weight: 500; margin: 0; }
`

function buildPrintableHtml(): string {
  const sheet = sheetRef.value?.outerHTML ?? ''
  return '<!doctype html><html lang="ru"><head><meta charset="utf-8">'
    + `<title>ТТН № ${props.data.number}</title><style>${PRINT_CSS}</style></head>`
    + `<body>${sheet}</body></html>`
}

// Печать через скрытый iframe — печатается только лист ТТН, без хрома
// приложения (header/drawer/страница не «протекают» в печать).
function print() {
  const html = buildPrintableHtml()
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } finally {
      setTimeout(() => iframe.remove(), 1000)
    }
  }
  iframe.srcdoc = html
  document.body.appendChild(iframe)
}

// Скачивание самодостаточного HTML-файла ТТН (открывается и печатается офлайн,
// в т.ч. «Сохранить как PDF» из браузера). Без новых зависимостей.
function download() {
  const blob = new Blob([buildPrintableHtml()], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ТТН-${props.data.number}.html`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  SuccessAlert('ТТН сохранена')
}
</script>

<style scoped lang="scss">
.mp-ttn {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__toolbar {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
  }

  &__sheet {
    background: white;
    color: #111;
    width: 148mm;
    min-height: 210mm;
    padding: 10mm;
    box-shadow: 0 1px 6px rgba(0, 0, 0, .12);
    margin: 0 auto;
    font-size: 11pt;
    font-family: 'Times New Roman', serif;
  }

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid #111;
    padding-bottom: 4mm;
    margin-bottom: 4mm;
  }

  &__codes {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3mm;
  }

  &__qr {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  &__qr-img {
    width: 28mm;
    height: 28mm;
    display: block;
  }

  &__qr-cap {
    text-align: center;
    max-width: 32mm;
    color: #555;
  }

  &__parties {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6mm;
  }

  &__items {
    width: 100%;
    border-collapse: collapse;
    font-size: 10pt;
    margin-bottom: 6mm;

    th, td {
      border: 1px solid #111;
      padding: 2mm;
    }
    th { background: #f0f0f0; }
  }

  &__signatures {
    display: flex;
    justify-content: space-between;
    margin-top: 10mm;
    gap: 16mm;

    > div { flex: 1; }
  }

  &__sign-line {
    margin: 8mm 0 2mm;
    border-bottom: 1px solid #111;
    height: 0;
  }
}
</style>
