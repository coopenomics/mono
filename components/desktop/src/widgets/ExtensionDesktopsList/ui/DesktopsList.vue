<template lang="pug">
.desktops-list(v-if='desktops && desktops.length > 0')
  .desktops-list__title Рабочие столы
  .desktops-list__items
    .desktops-list__row(
      v-for='(desktop, index) in desktops',
      :key='desktop.name || index'
    )
      q-avatar.desktops-list__ico(size='32px')
        q-icon(:name='desktop.icon || "fa-solid fa-desktop"', size='16px')
      span.desktops-list__label {{ desktop.title || 'Без названия' }}
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
.desktops-list__items {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
}
.desktops-list__row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--p-2, 8px);
}
.desktops-list__ico {
  color: var(--p-primary);
}
.desktops-list__label {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-1);
}
</style>

