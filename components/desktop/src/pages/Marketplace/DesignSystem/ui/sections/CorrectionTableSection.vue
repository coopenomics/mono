<template>
  <div>
    <div class="text-h5 q-mb-md">CorrectionTable · Story 10.2.7 · UX-DR13</div>
    <div class="text-body2 text-grey-7 q-mb-lg">
      Таблица корректировки факт vs план: оператор ПВЗ вбивает фактическое
      количество, дельта подсвечивается цветом, низ показывает счётчики
      совпадений/недостач/избытков. Используется в Эпике 5 (Приёмка), Эпике 6 (Корректировка при выдаче).
    </div>

    <CorrectionTable :rows="rows" @change="onChange" />

    <q-banner v-if="lastChange" class="mp-event-banner q-mt-lg" rounded>
      Изменён факт <strong>{{ lastChange.sku }}</strong> → <strong>{{ lastChange.fact }}</strong>
    </q-banner>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CorrectionTable, type CorrectionRow } from 'src/widgets/Marketplace/CorrectionTable'

const rows = ref<CorrectionRow[]>([
  { sku: 'KA-001', title: 'Картофель «Невский»', unit: 'кг',  expected: 100, fact: 100 },
  { sku: 'KA-002', title: 'Морковь столовая',     unit: 'кг',  expected: 50,  fact: 47  },
  { sku: 'KA-003', title: 'Капуста б/к',          unit: 'кг',  expected: 30,  fact: 32  },
  { sku: 'KA-004', title: 'Лук репчатый',         unit: 'кг',  expected: 20,  fact: 20  },
  { sku: 'KA-005', title: 'Свёкла столовая',      unit: 'кг',  expected: 15,  fact: 0   },
])

const lastChange = ref<{ sku: string; fact: number } | null>(null)
function onChange(payload: { sku: string; fact: number }) { lastChange.value = payload }
</script>
