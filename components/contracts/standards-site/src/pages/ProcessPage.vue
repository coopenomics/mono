<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getStandard } from '@/data/loader';
import { START_ID } from '@/graph/layout';
import ProcessGraph from '@/components/ProcessGraph.vue';
import ProcessText from '@/components/ProcessText.vue';
import { contractHuman } from '@/data/labels';

const route = useRoute();
const router = useRouter();

/** Вид страницы: описание (по умолчанию), схема на всю ширину или прежний граф состояний. */
type View = 'text' | 'scheme' | 'graph';
// Граф при переходе по шагам пишет в адрес только фокус (?a=, ?s=, ?d=, ?o=)
// и теряет ?view=graph — фокус в адресе сам по себе означает вкладку графа.
const GRAPH_FOCUS_KEYS = ['a', 'd', 'o', 's'];
const view = computed<View>(() => {
  const q = route.query.view;
  if (q === 'scheme') return 'scheme';
  if (q === 'graph' || GRAPH_FOCUS_KEYS.some((k) => route.query[k])) return 'graph';
  return 'text';
});
function setView(v: View): void {
  router.replace({ query: v === 'text' ? {} : { view: v } });
}

const processType = computed(() =>
  typeof route.params.processType === 'string' ? route.params.processType : '',
);

const standard = computed(() => getStandard(processType.value));

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
          <dd>
            <span v-if="contractHuman(standard.contract) !== standard.contract" class="meta-item__primary">
              {{ contractHuman(standard.contract) }}
            </span>
            <code>{{ standard.contract }}</code>
          </dd>
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
      </dl>
      <nav class="view-switch">
        <button type="button" :class="{ 'view-switch--on': view === 'text' }" @click="setView('text')">
          Описание
        </button>
        <button type="button" :class="{ 'view-switch--on': view === 'scheme' }" @click="setView('scheme')">
          Схема
        </button>
        <button type="button" :class="{ 'view-switch--on': view === 'graph' }" @click="setView('graph')">
          Граф состояний
        </button>
      </nav>
    </header>

    <div v-if="view !== 'graph'" class="process-page__workspace">
      <ProcessText
        :key="standard.process_type"
        :standard="standard"
        :mode="view === 'scheme' ? 'scheme' : 'text'"
        @mode="setView"
      />
    </div>

    <div v-else-if="!(standard.transitions ?? []).length" class="process-page__empty">
      У процесса нет сущности со статусами — он состоит из отдельных действий,
      поэтому граф состояний не строится. Ход процесса — на вкладке «Описание».
    </div>

    <div v-else class="process-page__workspace">
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
.process-page__empty {
  padding: 24px;
  color: var(--text-muted);
  font-size: 14px;
}
.view-switch {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  margin-top: 4px;
  align-self: flex-start;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}
.view-switch button {
  border: none;
  background: transparent;
  padding: 3px 12px;
  border-radius: 4px;
  font-size: 12.5px;
  color: var(--text-muted);
}
.view-switch button.view-switch--on {
  background: var(--bg);
  color: var(--text);
  box-shadow: 0 0 0 1px var(--border);
}
.process-head {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.process-head h1 {
  margin: 0 0 4px;
  font-size: 24px;
  line-height: 1.2;
  letter-spacing: -0.01em;
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
</style>
