<template>
  <div class="mp-role-admin">
    <div class="text-h5 q-mb-md">WarehouseSummaryGrid · Story 10.2.10 · UX-DR16</div>
    <div class="text-body2 text-grey-7 q-mb-lg">
      Сводная таблица склада кооператива на admin-столе: приход / расход /
      остаток / статус, фильтр по SKU/названию, плотный layout 14px.
      Используется в Эпике 9 (Склад и отчётность).
    </div>

    <WarehouseSummaryGrid :rows="rows" />
  </div>
</template>

<script setup lang="ts">
import { WarehouseSummaryGrid, type WarehouseRow } from 'src/widgets/Marketplace/WarehouseSummaryGrid'

const rows: WarehouseRow[] = [
  { sku: 'KA-001', title: 'Картофель «Невский»', unit: 'кг', incoming: 800, outgoing: 720, balance: 80,  pvz: 'Молодёжная, 12' },
  { sku: 'KA-002', title: 'Морковь столовая',     unit: 'кг', incoming: 400, outgoing: 397, balance: 3,   pvz: 'Молодёжная, 12' },
  { sku: 'KA-003', title: 'Капуста б/к',          unit: 'кг', incoming: 240, outgoing: 240, balance: 0,   pvz: 'Молодёжная, 12' },
  { sku: 'KA-004', title: 'Лук репчатый',         unit: 'кг', incoming: 160, outgoing: 130, balance: 30,  pvz: 'Гагарина, 5'    },
  { sku: 'KA-005', title: 'Свёкла столовая',      unit: 'кг', incoming: 120, outgoing: 120, balance: 0,   pvz: 'Гагарина, 5'    },
  { sku: 'MO-001', title: 'Молоко цельное',       unit: 'л',  incoming: 50,  outgoing: 47,  balance: 3,   pvz: 'Молодёжная, 12' },
  { sku: 'MO-002', title: 'Творог 9%',            unit: 'кг', incoming: 30,  outgoing: 18,  balance: 12,  pvz: 'Гагарина, 5'    },
  { sku: 'ME-001', title: 'Мёд гречишный',        unit: 'кг', incoming: 12,  outgoing: 12,  balance: 0,   pvz: 'Молодёжная, 12' },
]
</script>
