<template>
  <div>
    <div class="text-h5 q-mb-md">TTNPrintPreview · Story 10.2.9 · UX-DR15</div>
    <div class="text-body2 text-grey-7 q-mb-lg">
      Предпросмотр и печать ТТН (товарно-транспортной накладной). Формат А5,
      штрих-код в шапке (через BarcodeDisplay), таблица позиций, две подписи.
      @media print скрывает toolbar и box-shadow. Используется в Эпике 5 (Поставка).
    </div>

    <TTNPrintPreview :data="ttn" />
  </div>
</template>

<script setup lang="ts">
import { TTNPrintPreview, type TTNData } from 'src/widgets/Marketplace/TTNPrintPreview'

const ttn: TTNData = {
  number: 'TTN-202605-0042',
  date: '2026-05-15',
  supplier: 'КФХ Иваново, Ивановская обл., Кольчугино',
  recipient: 'ПК «Восход» / ПВЗ Молодёжная, 12',
  items: [
    { sku: 'KA-001', title: 'Картофель «Невский»', qty: 100, unit: 'кг', price: 35   },
    { sku: 'KA-002', title: 'Морковь столовая',     qty: 50,  unit: 'кг', price: 42   },
    { sku: 'KA-003', title: 'Капуста б/к',          qty: 30,  unit: 'кг', price: 28   },
    { sku: 'KA-004', title: 'Лук репчатый',         qty: 20,  unit: 'кг', price: 38   },
    { sku: 'KA-005', title: 'Свёкла столовая',      qty: 15,  unit: 'кг', price: 32.5 },
  ],
  dispatchedBy: 'Председатель КФХ Иванов И.И.',
}
</script>
