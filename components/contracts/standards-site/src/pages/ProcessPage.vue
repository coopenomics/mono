<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { getStandard } from '@/data/loader';
import { START_ID } from '@/graph/layout';
import ProcessGraph from '@/components/ProcessGraph.vue';

const route = useRoute();

const processType = computed(() =>
  typeof route.params.processType === 'string' ? route.params.processType : '',
);

const standard = computed(() => getStandard(processType.value));

const LIFECYCLE_HUMAN: Record<string, string> = {
  proposed: 'Предложен',
  approved: 'Утверждён',
  active: 'Действующий',
  deprecated: 'Устаревший',
};
function lifecycleHuman(s: string): string {
  return LIFECYCLE_HUMAN[s] ?? s;
}

/**
 * Единовременный фокус может быть только один:
 *   ?a=<action_name>   — действие
 *   ?d=<template>      — документ
 *   ?o=<ledger_code>   — операция ledger2
 *   ?s=<state>         — статус
 * Если ничего не задано — фокус на первом статусе процесса.
 */
const focusAction = computed<string | null>(() => {
  const q = route.query.a;
  return typeof q === 'string' && q.length > 0 ? q : null;
});
const focusDocument = computed<string | null>(() => {
  const q = route.query.d;
  return typeof q === 'string' && q.length > 0 ? q : null;
});
const focusOperation = computed<string | null>(() => {
  const q = route.query.o;
  return typeof q === 'string' && q.length > 0 ? q : null;
});

const focusStatus = computed<string | null>(() => {
  if (focusAction.value || focusDocument.value || focusOperation.value) return null;
  const q = route.query.s;
  if (typeof q === 'string' && q.length > 0) return q;
  if (!standard.value) return null;
  // По умолчанию фокусируемся на старте процесса (круглешок ∅) —
  // это «описание процесса», с которого начинаем чтение.
  const hasStart = standard.value.transitions.some((t) => t.from === '∅');
  if (hasStart) return START_ID;
  const first = standard.value.states.find((s) => !s.virtual && s.kind !== 'virtual');
  return first?.name ?? null;
});
</script>

<template>
  <div v-if="!standard" class="process-missing">
    <h1>Стандарт не найден</h1>
    <p>process_type: <code>{{ processType }}</code></p>
  </div>

  <div v-else class="process-page">
    <header class="process-head">
      <h1>{{ standard.title }}</h1>

      <dl class="process-head__meta">
        <div class="meta-item">
          <dt>Контракт</dt>
          <dd><code>{{ standard.contract }}</code></dd>
        </div>
        <div class="meta-item">
          <dt>Процесс</dt>
          <dd><code>{{ standard.process_type }}</code></dd>
        </div>
        <div v-if="standard.entity_human || standard.entity" class="meta-item">
          <dt>Сущность</dt>
          <dd>
            <span v-if="standard.entity_human" class="meta-item__primary">
              «{{ standard.entity_human }}»
            </span>
            <code v-if="standard.entity" class="meta-item__sub-code">{{ standard.entity }}</code>
          </dd>
        </div>
        <div v-if="standard.area" class="meta-item">
          <dt>Зона</dt>
          <dd><code>{{ standard.area }}</code></dd>
        </div>
        <div class="meta-item">
          <dt>Статус</dt>
          <dd>
            <span class="status-badge" :class="`status-badge--${standard.status}`">
              {{ lifecycleHuman(standard.status) }}
            </span>
          </dd>
        </div>
      </dl>
    </header>

    <div class="process-page__workspace">
      <ProcessGraph
        :standard="standard"
        :focus-status="focusStatus"
        :focus-action="focusAction"
        :focus-document="focusDocument"
        :focus-operation="focusOperation"
      />
    </div>
  </div>
</template>

<style scoped>
.process-page {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  grid-template-columns: minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  gap: 10px;
}
.process-page__workspace {
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  display: flex;
}
.process-head {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.process-head h1 {
  margin: 0;
  font-size: 20px;
  line-height: 1.2;
}
.process-head__meta {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 22px;
  align-items: baseline;
}
.meta-item {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}
.meta-item dt {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-subtle);
  margin: 0;
}
.meta-item dd {
  margin: 0;
  font-size: 12.5px;
  color: var(--text);
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}
.meta-item dd code {
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 2px 7px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
}
.meta-item__primary {
  font-size: 12.5px;
  color: var(--text);
}
.meta-item__sub-code {
  font-size: 10.5px !important;
  padding: 1px 5px !important;
  color: var(--text-muted) !important;
  background: transparent !important;
  border: none !important;
}
.status-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-muted);
}
.status-badge--proposed {
  background: var(--edge-focus-soft);
  border-color: var(--edge-focus-border);
  color: var(--edge-focus);
}
.status-badge--approved,
.status-badge--active {
  background: var(--accent-soft);
  border-color: var(--accent-border);
  color: var(--accent);
}
.status-badge--deprecated {
  background: var(--reject-soft);
  border-color: var(--reject);
  color: var(--reject);
}
</style>
