<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { standardsIndex } from '@/data/loader';
import { contractHuman } from '@/data/labels';
import ThemeToggle from '@/components/ThemeToggle.vue';

/** Версия платформы из lerna.json — меняется с каждым выпуском. */
const version = __MONO_VERSION__;

const route = useRoute();

const emit = defineEmits<{ (e: 'collapse'): void }>();

const contracts = computed(() => standardsIndex.contracts);
const byContract = computed(() => standardsIndex.byContract);
const isEmpty = computed(() => contracts.value.length === 0);

const activeProcessType = computed(() => {
  return typeof route.params.processType === 'string' ? route.params.processType : null;
});

</script>

<template>
  <nav class="sidebar">
    <div class="sidebar-brand">
      <RouterLink to="/" class="sidebar-brand__link">
        <span class="sidebar-brand__title">Кооперативные стандарты</span>
        <span class="sidebar-brand__subtitle">v{{ version }}</span>
      </RouterLink>
      <button
        type="button"
        class="sidebar-collapse"
        title="Скрыть список стандартов"
        aria-label="Скрыть список стандартов"
        @click="emit('collapse')"
      >‹</button>
    </div>

    <div class="sidebar-body">
      <p v-if="isEmpty" class="sidebar-empty">
        Стандарты не найдены. Добавьте <code>*.standard.yaml</code> рядом с кодом контракта.
      </p>

      <div v-for="contract in contracts" :key="contract" class="sidebar-group">
        <div class="sidebar-group__head" :title="`Контракт ${contract}`">
          <span class="sidebar-group__name">{{ contractHuman(contract) }}</span>
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
.sidebar-brand {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.sidebar-brand__link { min-width: 0; }
.sidebar-collapse {
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  color: var(--text-muted);
  font-size: 15px;
  line-height: 1;
}
.sidebar-collapse:hover { color: var(--accent); border-color: var(--accent-border); }
.sidebar-brand__title,
.sidebar-brand__subtitle { display: block; }
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
</style>
