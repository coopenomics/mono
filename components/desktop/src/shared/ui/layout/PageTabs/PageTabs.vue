<template>
  <div class="tabbar">
    <div class="tabbar__tabs">
      <component
        :is="tab.route ? 'router-link' : 'button'"
        v-for="tab in tabs"
        :key="tab.key"
        :to="tab.route"
        active-class=""
        exact-active-class=""
        :type="tab.route ? undefined : 'button'"
        :class="['tab', { 'tab--active': tab.key === activeKey }]"
        :disabled="tab.disabled || undefined"
        @click="!tab.disabled && emit('select', tab)"
      >
        <span>{{ tab.label }}</span>
        <span v-if="tab.count !== undefined" class="tab__count">{{ tab.count }}</span>
      </component>
    </div>
    <div v-if="$slots.actions" class="tabbar__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PageTabsProps, PageTab } from './PageTabs.types';

defineProps<PageTabsProps>();

const emit = defineEmits<{
  select: [tab: PageTab];
}>();
</script>
