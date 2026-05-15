<template>
  <div class="mp-ttn">
    <div class="mp-ttn__toolbar no-print">
      <q-btn unelevated color="primary" icon="fa-solid fa-print" label="Печать" @click="print" />
      <q-space />
      <span class="text-caption text-grey-7">Формат А5 (148×210 мм)</span>
    </div>

    <div ref="sheetRef" class="mp-ttn__sheet">
      <header class="mp-ttn__header">
        <div>
          <div class="text-h6">ТТН № {{ data.number }}</div>
          <div class="text-caption">от {{ formatDate(data.date) }}</div>
        </div>
        <BarcodeDisplay :code="data.number" size="sm" />
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
import { computed, ref, type PropType } from 'vue'
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
}

const props = defineProps({
  data: { type: Object as PropType<TTNData>, required: true },
})

const sheetRef = ref<HTMLElement | null>(null)

const total = computed(() => props.data.items.reduce((acc, i) => acc + i.qty * i.price, 0))

function formatDate(v: string | Date) {
  const d = typeof v === 'string' ? new Date(v) : v
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatPrice(v: number) {
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' ₽'
}

function print() {
  window.print()
}
</script>

<style scoped lang="scss">
.mp-ttn {
  display: flex;
  flex-direction: column;
  gap: var(--mp-space-md);

  &__toolbar {
    display: flex;
    align-items: center;
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
    gap: var(--mp-space-xl);

    > div { flex: 1; }
  }

  &__sign-line {
    margin: 8mm 0 2mm;
    border-bottom: 1px solid #111;
    height: 0;
  }
}

@media print {
  .no-print { display: none !important; }
  .mp-ttn__sheet { box-shadow: none; margin: 0; }
}
</style>
