<template lang="pug">
.desktops-list(v-if='desktops && desktops.length > 0')
  .desktops-list__title {{ $t('extensionDesktopsList.desktopsList.title') }}
  .desktops-list__items
    .desktops-list__row(
      v-for='(desktop, index) in desktops',
      :key='desktop.name || index'
    )
      q-avatar.desktops-list__ico(size='32px')
        q-icon(:name='desktop.icon || "desktop_windows"', size='16px')
      span.desktops-list__label {{ desktop.title || $t('extensionDesktopsList.desktopsList.untitledFallback') }}
</template>

<script setup lang="ts">
import type { IDesktopConfig } from 'src/entities/Desktop/model/types'

interface Props {
  desktops?: IDesktopConfig[] | null
}

defineProps<Props>()
</script>

<style scoped lang="scss">
.desktops-list {
  width: 100%;
  margin-top: var(--p-2, 8px);
  padding: var(--p-4, 16px);
  background: var(--p-surface-2);
  border-radius: var(--p-r-md, 12px);
  text-align: center;
}
.desktops-list__title {
  font-size: var(--p-fs-meta);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-ink-3);
  margin-bottom: var(--p-3, 12px);
}
// Список — блоком по центру карточки, строки внутри — от левого края блока:
// иконки стоят одним столбцом, подписи начинаются с одной линии и не
// «прыгают» от длины названия (замечание владельца 24.11.2026)
.desktops-list__items {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--p-2, 8px);
  width: fit-content;
  max-width: 100%;
  margin: 0 auto;
  text-align: left;
}
.desktops-list__row {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--p-2, 8px);
  min-width: 0;
}
.desktops-list__ico {
  color: var(--p-primary);
}
.desktops-list__label {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-1);
}
</style>

