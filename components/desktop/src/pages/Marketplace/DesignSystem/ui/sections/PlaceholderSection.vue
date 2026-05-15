<template>
  <div class="mp-placeholder-section">
    <div class="text-h5 q-mb-md">{{ section.title }} · {{ section.story }}</div>

    <q-banner class="bg-grey-2 q-mb-md" rounded>
      <template #avatar>
        <q-icon name="fa-solid fa-hammer" color="grey-7" />
      </template>
      Секция в плане. Компонент будет реализован отдельным коммитом Story 10.2.N
      и появится здесь со всеми состояниями (idle / loading / error / disabled / empty).
    </q-banner>

    <div class="text-body2 q-mb-sm">{{ section.description }}</div>

    <q-list bordered separator class="rounded-borders">
      <q-item>
        <q-item-section>
          <q-item-label caption>UX-DR</q-item-label>
          <q-item-label>{{ section.uxDr }}</q-item-label>
        </q-item-section>
      </q-item>
      <q-item>
        <q-item-section>
          <q-item-label caption>Used at</q-item-label>
          <q-item-label>{{ section.primaryRole.join(' · ') }}</q-item-label>
        </q-item-section>
      </q-item>
      <q-item>
        <q-item-section>
          <q-item-label caption>Status</q-item-label>
          <q-item-label>
            <q-badge :color="statusColor[section.status]">
              {{ statusLabel[section.status] }}
            </q-badge>
          </q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<script setup lang="ts">
import { type PropType } from 'vue'
import { type DesignSystemSection, STATUS_LABEL, STATUS_COLOR } from '../../lib/sections'

defineProps({
  section: { type: Object as PropType<DesignSystemSection>, required: true },
})

const statusLabel = STATUS_LABEL
const statusColor = STATUS_COLOR
</script>
