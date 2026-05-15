<template>
  <div>
    <div class="text-h5 q-mb-md">Performance baseline · Story 10.3 · NFR-P1/P2/P3</div>
    <div class="text-body2 text-grey-7 q-mb-lg">
      Эталонная инструкция для measure-only контроля производительности marketplace-frontend.
      В MVP — manual через Chrome DevTools / Lighthouse; CI-gate — Phase 2.
    </div>

    <div class="text-h6 q-mb-sm">Эталонные страницы (P1..P4)</div>
    <q-list bordered separator class="rounded-borders q-mb-lg">
      <q-item v-for="p in pages" :key="p.id">
        <q-item-section avatar><q-chip dense color="primary" text-color="white">{{ p.id }}</q-chip></q-item-section>
        <q-item-section>
          <q-item-label>{{ p.role }} · {{ p.path }}</q-item-label>
          <q-item-label caption>{{ p.story }}</q-item-label>
        </q-item-section>
      </q-item>
    </q-list>

    <div class="text-h6 q-mb-sm">Целевые показатели MVP</div>
    <q-markup-table flat bordered class="q-mb-lg">
      <thead>
        <tr><th class="text-left">Метрика</th><th>Цель MVP</th><th>Phase 2 (CI-gate)</th></tr>
      </thead>
      <tbody>
        <tr v-for="m in metrics" :key="m.label">
          <td>{{ m.label }}</td>
          <td>{{ m.mvp }}</td>
          <td class="text-grey-7">{{ m.phase2 }}</td>
        </tr>
      </tbody>
    </q-markup-table>

    <q-banner class="mp-event-banner" rounded>
      <template #avatar>
        <q-icon name="fa-solid fa-circle-info" color="primary" />
      </template>
      Полная инструкция и Phase 2 — см.
      <code>src/pages/Marketplace/DesignSystem/PERFORMANCE.md</code>.
    </q-banner>
  </div>
</template>

<script setup lang="ts">
const pages = [
  { id: 'P1', role: 'orderer',  path: '/:coopname/market/showcase',  story: 'Story 3.5 — каталог' },
  { id: 'P2', role: 'orderer',  path: '/:coopname/market/my-orders', story: 'Story 4.6 — Мои заказы' },
  { id: 'P3', role: 'operator', path: '/:coopname/market/warehouse', story: 'Story 9.1 — Склад моего КУ' },
  { id: 'P4', role: 'admin',    path: '/:coopname/market/warehouse', story: 'Story 9.2 — Сводный склад' },
]

const metrics = [
  { label: 'Отзывчивость на действие', mvp: '≤ 1 сек', phase2: '≤ 800 мс' },
  { label: 'FCP (First Contentful Paint)', mvp: '≤ 1.5 сек', phase2: '≤ 1.2 сек' },
  { label: 'TTI (Time to Interactive)', mvp: '≤ 3 сек', phase2: '≤ 2.5 сек' },
  { label: 'Bundle size (gzipped, per-стол)', mvp: '≤ 500 КБ', phase2: '≤ 400 КБ' },
  { label: 'CLS (Cumulative Layout Shift)', mvp: '≤ 0.1', phase2: '≤ 0.05' },
]
</script>
