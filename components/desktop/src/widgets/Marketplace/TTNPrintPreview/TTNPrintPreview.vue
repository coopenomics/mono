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
      <span class="text-caption text-grey-7">Формат А4 (альбомная, 297×210 мм)</span>
    </div>

    <div ref="viewportRef" class="mp-ttn__viewport" :style="{ height: viewportHeight }">
      <div class="mp-ttn__scaler" :style="{ transform: `scale(${scale})` }">
        <div ref="sheetRef" class="mp-ttn__sheet">
          <div class="mp-ttn__topbar">
        <div v-if="qrDataUrl" class="mp-ttn__code">
          <img :src="qrDataUrl" alt="QR-код приёмки партии" class="mp-ttn__code-img" />
          <div v-if="data.qrCode" class="mp-ttn__code-text">{{ data.qrCode }}</div>
        </div>
      </div>

      <header class="mp-ttn__head">
        <div class="mp-ttn__doctype">Товарно-транспортная накладная</div>
        <div class="mp-ttn__meta">№ {{ data.number }} · Дата составления {{ formatDate(data.date) }}</div>
        <div class="mp-ttn__sub-note">Приёмка партии оператором КУ — скан QR в правом верхнем углу либо ввод кода вручную</div>
      </header>

      <div class="mp-ttn__parties">
        <div class="mp-ttn__party">
          <span class="mp-ttn__party-lbl">Грузоотправитель</span>
          <span class="mp-ttn__party-val">{{ data.supplier }}<template v-if="data.loadingAddress">, {{ data.loadingAddress }}</template></span>
        </div>
        <div class="mp-ttn__party">
          <span class="mp-ttn__party-lbl">Грузополучатель</span>
          <span class="mp-ttn__party-val">{{ data.recipient }}<template v-if="data.recipientAddress">, {{ data.recipientAddress }}</template></span>
        </div>
        <div class="mp-ttn__party">
          <span class="mp-ttn__party-lbl">Перевозчик (экспедитор)</span>
          <span class="mp-ttn__party-val">{{ data.expeditorName || '—' }}<template v-if="data.expeditorPhone">, тел. {{ data.expeditorPhone }}</template><template v-if="data.vehicleNumber">, ТС {{ data.vehicleNumber }}</template></span>
        </div>
        <div v-if="datesParts.length" class="mp-ttn__party">
          <span class="mp-ttn__party-lbl">Сроки перевозки</span>
          <span class="mp-ttn__party-val">{{ datesParts.join(' · ') }}</span>
        </div>
      </div>

      <div class="mp-ttn__section-title">1. Товарный раздел (заполняется грузоотправителем)</div>

      <table class="mp-ttn__items">
        <thead>
          <tr>
            <th>№</th>
            <th>Артикул</th>
            <th>Наименование товара (груза)</th>
            <th>Ед. изм.</th>
            <th>Вид упаковки</th>
            <th>В коробке</th>
            <th>Кол-во мест</th>
            <th>Цена, руб.</th>
            <th>Кол-во</th>
            <th>Сумма, руб.</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(i, idx) in data.items" :key="i.sku">
            <td>{{ idx + 1 }}</td>
            <td>{{ i.sku }}</td>
            <td class="mp-ttn__cell-name">{{ i.title }}</td>
            <td>{{ i.unit }}</td>
            <td>{{ i.boxes != null ? 'коробка' : '—' }}</td>
            <td class="text-right">{{ i.unitsPerBox != null ? i.unitsPerBox : '—' }}</td>
            <td class="text-right">{{ i.boxes != null ? i.boxes : '—' }}</td>
            <td class="text-right">{{ formatPrice(i.price) }}</td>
            <td class="text-right">{{ i.qty }}</td>
            <td class="text-right">{{ formatPrice(i.qty * i.price) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="6" class="mp-ttn__foot-label">Всего наименований: {{ data.items.length }}</td>
            <td class="text-right">{{ totalBoxes != null ? totalBoxes : '' }}</td>
            <td></td>
            <td class="text-right">{{ totalQty }}</td>
            <td class="text-right"><strong>{{ formatPrice(total) }}</strong></td>
          </tr>
        </tfoot>
      </table>

      <div class="mp-ttn__total-line">
        Всего мест (коробок): <strong>{{ totalBoxes != null ? totalBoxes : '—' }}</strong>
        · Всего отпущено на сумму: <strong>{{ formatPrice(total) }}</strong>
      </div>

      <footer class="mp-ttn__signatures">
        <div class="mp-ttn__sign">
          <div class="mp-ttn__sign-role">Отпуск груза произвёл — поставщик</div>
          <div class="mp-ttn__sign-line" />
          <div class="mp-ttn__sign-name">{{ data.supplier }}</div>
        </div>
        <div class="mp-ttn__sign">
          <div class="mp-ttn__sign-role">Груз к перевозке принял — экспедитор</div>
          <div class="mp-ttn__sign-line" />
          <div class="mp-ttn__sign-name">{{ data.expeditorName || '____________________' }}</div>
        </div>
        <div class="mp-ttn__sign">
          <div class="mp-ttn__sign-role">Груз получил — оператор / председатель КУ</div>
          <div class="mp-ttn__sign-line" />
          <div class="mp-ttn__sign-name">{{ data.acceptedBy ?? '____________________' }}</div>
        </div>
      </footer>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue'
import QRCode from 'qrcode'
import { BaseButton } from 'src/shared/ui/base'
import { SuccessAlert } from 'src/shared/api'

export interface TTNItem {
  sku: string
  title: string
  qty: number
  unit: string
  price: number
  /** Штук имущества в одной коробке (экспедиторская упаковка партии). */
  unitsPerBox?: number
  /** Коробок в строке = ceil(qty / unitsPerBox). */
  boxes?: number
}

export interface TTNData {
  number: string
  date: string | Date
  /** Грузоотправитель — поставщик (орг-или-ФИО, не braname). */
  supplier: string
  /** Грузополучатель / ПВЗ — название КУ. */
  recipient: string
  /** Адрес КУ-получателя — «куда везти». */
  recipientAddress?: string
  /** Перевозчик: ФИО экспедитора (подписант ТТН). */
  expeditorName?: string
  /** Телефон экспедитора. */
  expeditorPhone?: string
  /** Госномер ТС. */
  vehicleNumber?: string
  /** Адрес погрузки (склад поставщика). */
  loadingAddress?: string
  /** Дата погрузки. */
  loadingDatetime?: string
  /** Расчётная дата доставки на КУ. */
  deliveryEstimate?: string
  items: TTNItem[]
  /** Оператор/председатель КУ — подпись приёмки (заполняется на месте, от руки). */
  acceptedBy?: string
  /**
   * Код приёмки партии (shipment-bound handoff-токен). Печатается на ТТН как QR:
   * оператор КУ сканирует его и принимает СТРОГО состав этой партии (экспедитор
   * не пайщик — приёмка по накладной, а не по аккаунту).
   */
  qrValue?: string
  /** Тот же код текстом — для ручного ввода оператором без камеры. */
  qrCode?: string
}

const props = defineProps({
  data: { type: Object as PropType<TTNData>, required: true },
})

const sheetRef = ref<HTMLElement | null>(null)
const viewportRef = ref<HTMLElement | null>(null)

// Превью: лист всегда вёрстается в альбомном A4 (width:297mm), а контейнер
// `__scaler` ужимается под ширину диалога через transform:scale — лист на экране
// выглядит горизонтальным, не «вертикальным» (раньше max-width:100% сплющивал
// ширину при фиксированной min-height:210mm). Масштаб на ОБЁРТКЕ, не на sheetRef,
// чтобы клон outerHTML для печати остался без transform.
const scale = ref(1)
const viewportHeight = ref('auto')

function recomputeScale(): void {
  const vp = viewportRef.value
  const sheet = sheetRef.value
  if (!vp || !sheet) return
  const sheetW = sheet.offsetWidth
  if (!sheetW) return
  const s = Math.min(1, vp.clientWidth / sheetW)
  scale.value = s
  viewportHeight.value = `${sheet.offsetHeight * s}px`
}

let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  recomputeScale()
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => recomputeScale())
    if (viewportRef.value) resizeObserver.observe(viewportRef.value)
    if (sheetRef.value) resizeObserver.observe(sheetRef.value)
  }
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

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

// Строка ТТН приходит в единицах отпуска (упаковки при упаковочном отпуске),
// цена — за ту же единицу: произведение прямое, делить на фасовку не нужно.
const total = computed(() => props.data.items.reduce((acc, i) => acc + i.qty * i.price, 0))
const totalQty = computed(() => props.data.items.reduce((acc, i) => acc + i.qty, 0))

// Сумма коробок по партии — печатается в строке «Итого» только если упаковка
// задана хотя бы по одной строке.
const totalBoxes = computed(() => {
  const withBoxes = props.data.items.filter((i) => i.boxes != null)
  if (!withBoxes.length) return null
  return withBoxes.reduce((acc, i) => acc + (i.boxes ?? 0), 0)
})

// Даты перевозки: погрузка + расчётная доставка. Адреса переехали в реквизиты
// (грузоотправитель/грузополучатель). Только заполненное — пустое не печатается.
const datesParts = computed(() => {
  const p: string[] = []
  if (props.data.loadingDatetime) p.push(`Дата погрузки: ${formatDate(props.data.loadingDatetime)}`)
  if (props.data.deliveryEstimate) p.push(`Ожидаемая доставка: ${formatDate(props.data.deliveryEstimate)}`)
  return p
})

function formatDate(v: string | Date) {
  const d = typeof v === 'string' ? new Date(v) : v
  if (isNaN(d.getTime())) return String(v)
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
  @page { size: A4 landscape; margin: 0; }
  html, body { margin: 0; padding: 0; }
  body { background: #fff; }
  .mp-ttn__sheet {
    position: relative;
    background: #fff; color: #111; width: 297mm; min-height: 210mm;
    padding: 8mm 10mm; margin: 0 auto; font-size: 10pt; font-family: 'Times New Roman', serif;
    box-sizing: border-box;
  }
  .mp-ttn__topbar { display: flex; justify-content: flex-end; align-items: flex-start; margin-bottom: 2mm; }
  .mp-ttn__code { width: 24mm; text-align: center; flex-shrink: 0; }
  .mp-ttn__code-img { width: 18mm; height: 18mm; display: block; margin: 0 auto; }
  .mp-ttn__code-text { margin-top: .5mm; font-family: 'Courier New', monospace; font-size: 5.5pt; line-height: 1.15; word-break: break-all; color: #333; }
  .mp-ttn__head { border-bottom: 1.5px solid #111; padding-bottom: 2.5mm; margin-bottom: 3mm; }
  .mp-ttn__doctype { font-size: 15pt; font-weight: 700; text-align: center; letter-spacing: .3px; }
  .mp-ttn__meta { text-align: center; font-family: 'Courier New', monospace; font-size: 10pt; margin-top: 1mm; }
  .mp-ttn__sub-note { text-align: center; font-size: 8pt; color: #555; margin-top: 1mm; }
  .mp-ttn__parties { border: 1px solid #111; margin-bottom: 3mm; }
  .mp-ttn__party { display: flex; gap: 3mm; padding: 1.5mm 3mm; border-bottom: 1px solid #111; font-size: 9.5pt; }
  .mp-ttn__party:last-child { border-bottom: 0; }
  .mp-ttn__party-lbl { flex: 0 0 42mm; color: #555; }
  .mp-ttn__party-val { flex: 1; font-weight: 600; }
  .mp-ttn__section-title { font-size: 9.5pt; font-weight: 700; margin-bottom: 1.5mm; }
  .mp-ttn__items { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 3mm; }
  .mp-ttn__items th, .mp-ttn__items td { border: 1px solid #111; padding: 1.5mm 2mm; text-align: center; }
  .mp-ttn__items th { background: #f0f0f0; font-weight: 600; }
  .mp-ttn__items .mp-ttn__cell-name { text-align: left; }
  .mp-ttn__items .mp-ttn__foot-label { text-align: left; font-weight: 600; }
  .mp-ttn__items .text-right { text-align: right; }
  .mp-ttn__total-line { font-size: 10pt; margin-bottom: 5mm; }
  .mp-ttn__signatures { display: flex; justify-content: space-between; margin-top: 5mm; gap: 16mm; }
  .mp-ttn__sign { flex: 1; }
  .mp-ttn__sign-role { font-size: 8pt; color: #555; }
  .mp-ttn__sign-line { margin: 9mm 0 1.5mm; border-bottom: 1px solid #111; height: 0; }
  .mp-ttn__sign-name { font-size: 9pt; }
  .text-right { text-align: right; }
  .text-caption { font-size: 0.85em; }
  .text-grey-7 { color: #555; }
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

  // Окно превью: лист внутри масштабируется под ширину, поэтому здесь прячем
  // «выступающую» часть нескейленного потока (transform не меняет layout-размер).
  &__viewport {
    width: 100%;
    overflow: hidden;
  }

  &__scaler {
    transform-origin: top left;
    width: 297mm;
  }

  &__sheet {
    position: relative;
    background: white;
    color: #111;
    width: 297mm;
    min-height: 210mm;
    padding: 8mm 10mm;
    box-sizing: border-box;
    box-shadow: 0 1px 6px rgba(0, 0, 0, .12);
    font-size: 10pt;
    font-family: 'Times New Roman', serif;
  }

  &__topbar {
    display: flex;
    justify-content: flex-end;
    align-items: flex-start;
    margin-bottom: 2mm;
  }

  &__code {
    width: 24mm;
    text-align: center;
    flex-shrink: 0;
  }

  &__code-img {
    width: 18mm;
    height: 18mm;
    display: block;
    margin: 0 auto;
  }

  &__code-text {
    margin-top: 0.5mm;
    font-family: 'Courier New', monospace;
    font-size: 5.5pt;
    line-height: 1.15;
    word-break: break-all;
    color: #333;
  }

  &__head {
    border-bottom: 1.5px solid #111;
    padding-bottom: 2.5mm;
    margin-bottom: 3mm;
  }

  &__doctype {
    font-size: 15pt;
    font-weight: 700;
    text-align: center;
    letter-spacing: 0.3px;
  }

  &__meta {
    text-align: center;
    font-family: 'Courier New', monospace;
    font-size: 10pt;
    margin-top: 1mm;
  }

  &__sub-note {
    text-align: center;
    font-size: 8pt;
    color: #555;
    margin-top: 1mm;
  }

  &__parties {
    border: 1px solid #111;
    margin-bottom: 3mm;
  }

  &__party {
    display: flex;
    gap: 3mm;
    padding: 1.5mm 3mm;
    border-bottom: 1px solid #111;
    font-size: 9.5pt;

    &:last-child {
      border-bottom: 0;
    }
  }

  &__party-lbl {
    flex: 0 0 42mm;
    color: #555;
  }

  &__party-val {
    flex: 1;
    font-weight: 600;
  }

  &__section-title {
    font-size: 9.5pt;
    font-weight: 700;
    margin-bottom: 1.5mm;
  }

  &__items {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
    margin-bottom: 3mm;

    th, td {
      border: 1px solid #111;
      padding: 1.5mm 2mm;
      text-align: center;
    }
    th { background: #f0f0f0; font-weight: 600; }

    .text-right { text-align: right; }
    .mp-ttn__cell-name { text-align: left; }
    .mp-ttn__foot-label { text-align: left; font-weight: 600; }
  }

  &__total-line {
    font-size: 10pt;
    margin-bottom: 5mm;
  }

  &__signatures {
    display: flex;
    justify-content: space-between;
    margin-top: 5mm;
    gap: 16mm;
  }

  &__sign {
    flex: 1;
  }

  &__sign-role {
    font-size: 8pt;
    color: #555;
  }

  &__sign-line {
    margin: 9mm 0 1.5mm;
    border-bottom: 1px solid #111;
    height: 0;
  }

  &__sign-name {
    font-size: 9pt;
  }
}
</style>
