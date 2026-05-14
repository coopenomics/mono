<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { standardsIndex } from '@/data/loader';
import { CONTRACT_HUMAN } from '@/data/labels';
import ThemeToggle from '@/components/ThemeToggle.vue';

const route = useRoute();

const contracts = computed(() => standardsIndex.contracts);
const byContract = computed(() => standardsIndex.byContract);
const isEmpty = computed(() => contracts.value.length === 0);

const activeProcessType = computed(() => {
  return typeof route.params.processType === 'string' ? route.params.processType : null;
});

function contractHuman(c: string): string {
  return CONTRACT_HUMAN[c] ?? '';
}
</script>

<template>
  <nav class="sidebar">
    <div class="sidebar-brand">
      <RouterLink to="/">
        <div class="sidebar-brand__title">Кооперативные стандарты</div>
        <div class="sidebar-brand__subtitle">Реестр v1</div>
      </RouterLink>
    </div>

    <div class="sidebar-body">
      <p v-if="isEmpty" class="sidebar-empty">
        Стандарты не найдены. Добавьте <code>*.standard.yaml</code> рядом с кодом контракта.
      </p>

      <div v-for="contract in contracts" :key="contract" class="sidebar-group">
        <div class="sidebar-group__head">
          <span class="sidebar-group__name">{{ contractHuman(contract) || contract }}</span>
          <code v-if="contractHuman(contract)" class="sidebar-group__code">{{ contract }}</code>
        </div>
        <ul class="sidebar-group__list">
          <li v-for="entry in byContract[contract]" :key="entry.process_type">
            <RouterLink
              :to="{ name: 'process', params: { contract: entry.contract, processType: entry.process_type } }"
              class="sidebar-item"
              :class="{ 'sidebar-item--active': activeProcessType === entry.process_type }"
            >
              {{ entry.title }}
            </RouterLink>
          </li>
        </ul>
      </div>
    </div>

    <div class="sidebar-foot">
      <ThemeToggle />
    </div>
  </nav>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.sidebar-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.sidebar-foot {
  flex: 0 0 auto;
  padding: 16px 24px 0;
  border-top: 1px solid var(--border);
  margin-top: 16px;
}
.sidebar-group__head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 0 20px 6px;
}
.sidebar-group__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.2;
}
.sidebar-group__code {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  text-transform: lowercase;
  letter-spacing: 0;
  color: var(--text-subtle);
  padding: 1px 5px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--surface);
}
</style>
