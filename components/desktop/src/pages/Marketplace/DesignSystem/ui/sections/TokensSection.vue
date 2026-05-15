<template>
  <div class="mp-tokens-section">
    <div class="text-h5 q-mb-md">Дизайн-токены · Story 10.1</div>
    <div class="text-body2 text-grey-7 q-mb-lg">
      Источник истины: <code>src/app/styles/marketplace-tokens.scss</code>.
      Все 13 компонентов Story 10.2 используют только эти токены.
    </div>

    <!-- Цвета -->
    <div class="text-h6 q-mt-lg q-mb-sm">Палитра (UX-DR19) · per-coop кастомизация</div>
    <div class="row q-gutter-sm">
      <div v-for="c in palette" :key="c.label" class="col-3 col-sm-2">
        <div :class="`bg-${c.token}`" class="mp-swatch" />
        <div class="text-caption q-mt-xs">{{ c.label }}</div>
        <code class="text-caption text-grey-7">${{ c.token }}</code>
      </div>
    </div>

    <!-- Статусные чипы -->
    <div class="text-h6 q-mt-xl q-mb-sm">Статусные чипы (UX-DR20)</div>
    <div class="text-body2 text-grey-7 q-mb-sm">
      Нейтральный фон + цветная точка + текст. Никаких залитых разноцветных бэйджей.
    </div>
    <div class="row q-gutter-sm">
      <span v-for="s in statuses" :key="s.label" :class="`mp-status-chip mp-status-chip--${s.kind}`">
        {{ s.label }}
      </span>
    </div>

    <!-- Typography -->
    <div class="text-h6 q-mt-xl q-mb-sm">Типографика (UX-DR21)</div>
    <div class="text-h1 q-mb-sm">H1 — заголовок секции</div>
    <div class="text-h2 q-mb-sm">H2 — заголовок страницы</div>
    <div class="text-h3 q-mb-sm">H3 — заголовок блока</div>
    <div class="text-h6 q-mb-sm">H6 — карточка</div>
    <div style="font-size: var(--mp-font-body)">Body 16px — основной текст пайщика</div>
    <div style="font-size: var(--mp-font-admin-table)" class="text-grey-7">
      14px — admin-таблицы (плотный режим)
    </div>

    <!-- Spacing -->
    <div class="text-h6 q-mt-xl q-mb-sm">Spacing (UX-DR22)</div>
    <div class="row items-end q-gutter-sm">
      <div v-for="s in spacing" :key="s.label" class="column items-center">
        <div class="bg-primary" :style="`width: ${s.value}; height: ${s.value};`" />
        <div class="text-caption q-mt-xs">{{ s.label }}</div>
        <code class="text-caption text-grey-7">{{ s.value }}</code>
      </div>
    </div>

    <!-- Touch-targets -->
    <div class="text-h6 q-mt-xl q-mb-sm">Touch-targets (UX-DR23)</div>
    <div class="row q-gutter-md items-center">
      <div>
        <q-btn label="44px (mobile/orderer)" color="primary" style="min-height: 44px" />
        <div class="text-caption q-mt-xs">var(--mp-touch-target)</div>
      </div>
      <div>
        <q-btn label="48px (operator POS)" color="accent" style="min-height: 48px" />
        <div class="text-caption q-mt-xs">var(--mp-touch-target-pos)</div>
      </div>
    </div>

    <!-- Per-role -->
    <div class="text-h6 q-mt-xl q-mb-sm">Per-роль layout (UX-DR31)</div>
    <div class="row q-col-gutter-md">
      <div v-for="r in roleCards" :key="r.role" :class="`col-12 col-sm-6 col-md-3 mp-role-${r.role}`">
        <div class="mp-card">
          <div class="text-subtitle1">{{ r.title }}</div>
          <div class="text-caption text-grey-7 q-mb-md">{{ r.hint }}</div>
          <q-btn :label="r.cta" color="primary" unelevated no-caps class="full-width" />
        </div>
      </div>
    </div>

    <!-- Grid / Icons -->
    <div class="text-h6 q-mt-xl q-mb-sm">Grid (UX-DR29) · Icons (UX-DR30)</div>
    <div class="text-body2 q-mb-sm">
      Сетка — Quasar 12-column flexbox-grid. Иконки — Font Awesome free.
    </div>
    <div class="row q-gutter-sm">
      <q-icon v-for="ic in icons" :key="ic" :name="ic" size="24px" />
    </div>
  </div>
</template>

<script setup lang="ts">
const palette = [
  { label: 'primary',   token: 'primary' },
  { label: 'secondary', token: 'secondary' },
  { label: 'accent',    token: 'accent' },
  { label: 'dark',      token: 'dark' },
  { label: 'positive',  token: 'positive' },
  { label: 'negative',  token: 'negative' },
  { label: 'warning',   token: 'warning' },
  { label: 'info',      token: 'info' },
]

const statuses = [
  { label: 'Info',     kind: 'info' },
  { label: 'Success',  kind: 'success' },
  { label: 'Warning',  kind: 'warning' },
  { label: 'Error',    kind: 'error' },
  { label: 'Neutral',  kind: 'neutral' },
]

const spacing = [
  { label: 'xs', value: '4px' },
  { label: 'sm', value: '8px' },
  { label: 'md', value: '16px' },
  { label: 'lg', value: '24px' },
  { label: 'xl', value: '48px' },
]

const roleCards = [
  { role: 'orderer',  title: 'Стол заказчика',  hint: 'просторный · 16px · 44px tap', cta: 'Заказать' },
  { role: 'offerer',  title: 'Стол поставщика', hint: 'просторный · 16px · 44px tap', cta: 'Опубликовать' },
  { role: 'operator', title: 'Стол ПВЗ (POS)',  hint: 'POS · 16px · 48px tap',         cta: 'Принять' },
  { role: 'admin',    title: 'Стол админа',     hint: 'плотный · 14px таблицы',        cta: 'Открыть' },
]

const icons = [
  'fa-solid fa-shop',
  'fa-solid fa-cart-shopping',
  'fa-solid fa-truck',
  'fa-solid fa-warehouse',
  'fa-solid fa-shield-halved',
  'fa-solid fa-file-invoice',
  'fa-solid fa-map-location-dot',
  'fa-solid fa-boxes-stacked',
]
</script>

<style scoped lang="scss">
.mp-swatch {
  width: 100%;
  height: 56px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, .06);
}
</style>
