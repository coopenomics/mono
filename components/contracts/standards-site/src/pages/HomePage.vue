<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { standardsIndex } from '@/data/loader';
import { CONTRACT_HUMAN, STATUS_HUMAN } from '@/data/labels';
import type { Standard, StandardIndexEntry } from '@/types/standard';

interface GroupedStandard extends StandardIndexEntry {
  summary: string;
}

function summarize(std: Standard): { summary: string } {
  return { summary: std.summary.trim() };
}

const groups = computed<{ contract: string; items: GroupedStandard[] }[]>(() => {
  return standardsIndex.contracts.map((contract) => ({
    contract,
    items: standardsIndex.byContract[contract].map((entry) => {
      const std = standardsIndex.byProcessType[entry.process_type];
      return { ...entry, ...summarize(std) };
    }),
  }));
});

const total = computed(() =>
  standardsIndex.contracts.reduce((n, c) => n + standardsIndex.byContract[c].length, 0),
);

function contractHuman(c: string): string {
  return CONTRACT_HUMAN[c] ?? c;
}
function statusHuman(s: string): string {
  return STATUS_HUMAN[s] ?? s;
}
</script>

<template>
  <section class="home-hero">
    <div class="home-hero__kicker">Реестр v1</div>
    <h1>Кооперативные стандарты</h1>
    <p class="home-hero__lead">
      Стандарт кооперативного процесса — формальное описание того, в какой
      последовательности участники совершают действия в смарт-контрактах,
      какие документы создаются и кем подписываются, какие статусы проходит
      сущность и какие бухгалтерские операции возникают.
    </p>
    <p class="home-hero__lead">
      Всего описано <strong>{{ total }}</strong> {{ total === 1 ? 'стандарт' : 'стандартов' }}.
      Слева — группировка по исходному контракту.
    </p>
  </section>

  <div v-if="total === 0" class="home-empty">
    <p>Пока ни одного стандарта не найдено. Добавьте <code>*.standard.yaml</code> рядом с кодом контракта.</p>
  </div>

  <div v-for="g in groups" :key="g.contract" class="home-section">
    <h2 class="home-section__title">
      <span class="home-section__name">{{ contractHuman(g.contract) || g.contract }}</span>
      <code v-if="contractHuman(g.contract)" class="home-section__code">{{ g.contract }}</code>
      <span class="home-section__count">{{ g.items.length }}</span>
    </h2>
    <div class="home-grid">
      <RouterLink
        v-for="item in g.items"
        :key="item.process_type"
        :to="{ name: 'process', params: { contract: item.contract, processType: item.process_type } }"
        class="home-card"
      >
        <div class="home-card__head">
          <span class="home-card__title">{{ item.title }}</span>
        </div>
        <p class="home-card__summary">{{ item.summary }}</p>
        <div class="home-card__foot">
          <span class="home-card__badge home-card__badge--status">{{ statusHuman(item.status) }}</span>
        </div>
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.home-hero {
  max-width: 780px;
  margin-bottom: 36px;
}
.home-hero__kicker {
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-subtle);
  font-weight: 600;
  margin-bottom: 6px;
}
.home-hero__lead {
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.65;
  margin: 0 0 10px;
}
.home-hero__lead strong {
  color: var(--text);
  font-weight: 600;
}

.home-empty {
  padding: 16px 20px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-lg);
  color: var(--text-muted);
}

.home-section {
  margin-bottom: 28px;
}
.home-section__title {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 0 0 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}
.home-section__name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}
.home-section__code {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  color: var(--text-subtle);
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 2px 7px;
  border-radius: 4px;
}
.home-section__count {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
}

.home-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.home-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg);
  transition: border-color 80ms ease, transform 80ms ease;
}
.home-card:hover {
  border-color: var(--border-strong);
  transform: translateY(-1px);
}
.home-card__head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.home-card__title {
  font-weight: 500;
  font-size: 14px;
  color: var(--text);
}
.home-card__code {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}
.home-card__summary {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.home-card__foot {
  display: flex;
  gap: 6px;
  margin-top: auto;
  padding-top: 4px;
}
.home-card__badge {
  font-size: 10px;
  letter-spacing: 0.04em;
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-muted);
  background: var(--surface);
  font-family: var(--font-mono);
}
.home-card__badge--status {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: var(--accent-border);
  text-transform: lowercase;
}
</style>
