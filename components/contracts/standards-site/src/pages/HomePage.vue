<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { standardsIndex } from '@/data/loader';
import { CONTRACT_HUMAN } from '@/data/labels';
import type { Standard, StandardIndexEntry } from '@/types/standard';

interface GroupedStandard extends StandardIndexEntry {
  purpose: string;
}

const groups = computed<{ contract: string; items: GroupedStandard[] }[]>(() => {
  return standardsIndex.contracts.map((contract) => ({
    contract,
    items: standardsIndex.byContract[contract].map((entry) => {
      const std: Standard = standardsIndex.byProcessType[entry.process_type];
      return { ...entry, purpose: std.purpose.trim() };
    }),
  }));
});

const total = computed(() =>
  standardsIndex.contracts.reduce((n, c) => n + standardsIndex.byContract[c].length, 0),
);

function contractHuman(c: string): string {
  return CONTRACT_HUMAN[c] ?? c;
}

/** «1 процесс», «3 процесса», «5 процессов». */
function processesLabel(n: number): string {
  const d10 = n % 10;
  const d100 = n % 100;
  if (d10 === 1 && d100 !== 11) return `${n} процесс`;
  if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return `${n} процесса`;
  return `${n} процессов`;
}
</script>

<template>
  <!-- Основная область фиксирована по высоте окна — главная прокручивается сама. -->
  <div class="home">
    <section class="home-hero">
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

    <section v-for="g in groups" :key="g.contract" class="home-section">
      <header class="home-section__head">
        <h2 class="home-section__name">{{ contractHuman(g.contract) }}</h2>
        <div class="home-section__meta">
          <span>{{ processesLabel(g.items.length) }}</span>
          <span v-if="contractHuman(g.contract) !== g.contract" class="home-section__code">контракт {{ g.contract }}</span>
        </div>
      </header>
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
          <p class="home-card__purpose">{{ item.purpose }}</p>
        </RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home {
  height: 100%;
  overflow-y: auto;
  padding: 12px 8px 72px 4px;
}

/* ── Вступление ───────────────────────────────────────────────────────── */
.home-hero {
  max-width: 720px;
  margin: 8px 0 56px;
}
.home-hero h1 {
  font-size: 30px;
  line-height: 1.15;
  letter-spacing: -0.01em;
  margin: 0 0 18px;
}
.home-hero__lead {
  font-size: 15px;
  color: var(--text-muted);
  line-height: 1.7;
  margin: 0 0 12px;
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

/* ── Раздел контракта: подпись слева, процессы справа ─────────────────── */
.home-section {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 32px;
  padding: 32px 0 40px;
  border-top: 1px solid var(--border);
}
.home-section__head {
  position: sticky;
  top: 0;
  align-self: start;
  padding-top: 2px;
}
.home-section__name {
  margin: 0;
  padding: 0;
  border: none;
  font-size: 19px;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.005em;
  color: var(--text);
}
.home-section__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 8px;
  font-size: 12.5px;
  color: var(--text-muted);
}
.home-section__code {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--text-subtle);
}

@media (max-width: 1100px) {
  .home-section {
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
  }
  .home-section__head { position: static; }
}

/* ── Карточки процессов ───────────────────────────────────────────────── */
.home-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
.home-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px 22px 22px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg);
  transition: border-color 120ms ease, background-color 120ms ease;
}
.home-card:hover {
  border-color: var(--accent-border);
  background: color-mix(in srgb, var(--accent-soft) 35%, var(--bg));
}
.home-card:hover .home-card__title { color: var(--accent); }
.home-card__title {
  font-weight: 600;
  font-size: 15px;
  line-height: 1.4;
  color: var(--text);
  transition: color 120ms ease;
}
.home-card__purpose {
  margin: 0;
  font-size: 13.5px;
  color: var(--text-muted);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
