<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { getStandard, standardsIndex } from '@/data/loader';
import { START_ID } from '@/graph/layout';
import ProcessGraph from '@/components/ProcessGraph.vue';

const route = useRoute();

const processType = computed(() =>
  typeof route.params.processType === 'string' ? route.params.processType : '',
);

const standard = computed(() => getStandard(processType.value));

const RELATION_HUMAN: Record<string, string> = {
  provides: 'обеспечивает',
  repaid_by: 'гасится в',
  affects: 'влияет на',
  consumes: 'потребляет',
  triggers: 'запускает',
};
function relationHuman(r: string): string {
  return RELATION_HUMAN[r] ?? r;
}

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
 * Для каждой записи `related[]` смотрим, есть ли такой process_type у нас
 * в индексе — если да, делаем кликабельный RouterLink, иначе просто метку.
 */
interface RelatedView {
  title: string;
  code: string;
  relation: string;
  note: string;
  target: { contract: string; processType: string } | null;
}

const relatedLinks = computed<RelatedView[]>(() => {
  const list = standard.value?.related ?? [];
  return list.map((r) => {
    const pt = r.process_type;
    const known = pt ? standardsIndex.byProcessType[pt] : undefined;
    return {
      title: known?.title ?? pt ?? r.id ?? '—',
      code: pt ?? r.id ?? '',
      relation: r.relation,
      note: r.note,
      target: known ? { contract: known.contract, processType: known.process_type } : null,
    };
  });
});

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

    <section v-if="relatedLinks.length" class="related">
      <span class="related__title">Связанные стандарты</span>
      <ul class="related__list">
        <li v-for="(r, i) in relatedLinks" :key="i" class="related__item">
          <span class="related__relation">{{ relationHuman(r.relation) }}</span>
          <RouterLink
            v-if="r.target"
            class="related__peer related__peer--link"
            :to="{ name: 'process', params: { contract: r.target.contract, processType: r.target.processType } }"
          >
            <span class="related__peer-title">{{ r.title }}</span>
            <code v-if="r.code" class="related__peer-code">{{ r.code }}</code>
          </RouterLink>
          <span v-else class="related__peer related__peer--plain">
            <span class="related__peer-title">{{ r.title }}</span>
            <code v-if="r.code" class="related__peer-code">{{ r.code }}</code>
          </span>
          <p v-if="r.note" class="related__note">{{ r.note }}</p>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.process-page {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  gap: 10px;
}
.process-page__workspace {
  min-height: 0;
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
.related {
  flex-shrink: 0;
  display: flex;
  align-items: stretch;
  gap: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
  min-height: 0;
}
.related__title {
  flex: 0 0 auto;
  align-self: center;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-subtle);
  font-weight: 600;
  white-space: nowrap;
  padding: 0 6px;
}
.related__list {
  list-style: none;
  margin: 0;
  padding: 0 4px 6px;
  display: flex;
  flex-direction: row;
  gap: 8px;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x proximity;
  flex: 1 1 0;
  min-width: 0;
}
.related__list::-webkit-scrollbar {
  height: 6px;
}
.related__list::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}
.related__item {
  flex: 0 0 auto;
  width: 320px;
  max-width: 60vw;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  align-items: baseline;
  scroll-snap-align: start;
  transition: border-color 80ms ease, background 80ms ease;
}
.related__item:hover {
  border-color: var(--accent-border);
  background: var(--bg);
}
.related__relation {
  font-size: 10.5px;
  color: var(--text-subtle);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-weight: 600;
}
.related__peer {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  text-decoration: none;
}
.related__peer-title {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text);
}
.related__peer-code {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text-subtle);
  font-weight: 500;
}
.related__peer--link .related__peer-title {
  color: var(--accent);
  transition: filter 80ms ease;
}
.related__peer--link:hover .related__peer-title {
  filter: brightness(1.1);
  text-decoration: underline;
}
.related__peer--plain .related__peer-title {
  color: var(--text-muted);
}
.related__note {
  margin: 0;
  font-size: 11.5px;
  color: var(--text-muted);
  line-height: 1.4;
  flex-basis: 100%;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
