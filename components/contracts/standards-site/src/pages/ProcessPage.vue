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
      <div class="process-head__title-box">
        <h1>{{ standard.title }}</h1>
      </div>

      <dl class="process-head__meta">
        <div class="meta-item">
          <dt>Контракт</dt>
          <dd><code>{{ standard.contract }}</code></dd>
        </div>
        <div class="meta-item">
          <dt>Процесс</dt>
          <dd><code>{{ standard.process_type }}</code></dd>
        </div>
        <div v-if="standard.entity_human || standard.entity" class="meta-item meta-item--stacked">
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
          <dt>Статус стандарта</dt>
          <dd>
            <span class="status-badge" :class="`status-badge--${standard.status}`">
              {{ lifecycleHuman(standard.status) }}
            </span>
          </dd>
        </div>
      </dl>
    </header>

    <section v-if="standard.purpose" class="process-intro">
      <p class="process-intro__prose">{{ standard.purpose }}</p>
    </section>

    <ProcessGraph
      :standard="standard"
      :focus-status="focusStatus"
      :focus-action="focusAction"
      :focus-document="focusDocument"
      :focus-operation="focusOperation"
    />

    <section v-if="relatedLinks.length" class="related">
      <h3>Связанные стандарты</h3>
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
          <p class="related__note">{{ r.note }}</p>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.process-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
  margin-bottom: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border);
}
.process-head__title-box {
  flex: 1 1 420px;
  min-width: 0;
}
.process-head__title-box h1 {
  margin: 0 0 4px;
  font-size: 22px;
  line-height: 1.2;
}
.process-intro {
  margin: 0 0 18px;
  padding: 14px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}
.process-intro__prose {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--text-muted);
  max-width: 920px;
  white-space: pre-line;
}
.process-head__meta {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, auto));
  gap: 10px 22px;
  align-content: start;
}
.meta-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.meta-item dt {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-subtle);
}
.meta-item dd {
  margin: 0;
  font-size: 12.5px;
  color: var(--text);
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
.meta-item--stacked dd {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-start;
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
  margin-top: 28px;
  max-width: 780px;
}
.related h3 {
  margin: 0 0 10px;
  font-size: 13px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-subtle);
  font-weight: 600;
  padding-bottom: 0;
  border-bottom: none;
}
.related__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.related__item {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  align-items: baseline;
}
.related__relation {
  font-size: 12px;
  color: var(--text-subtle);
  letter-spacing: 0.04em;
}
.related__peer {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  text-decoration: none;
}
.related__peer-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
}
.related__peer-code {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--surface);
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
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.55;
  flex-basis: 100%;
}
</style>
