<script setup lang="ts">
/**
 * Один шаг процесса в тексте: кто, что делает, условия, результат,
 * смена статуса, проводки, движение по кошелькам и документы этого шага.
 */
import { factAnchor, type ProcessPoint } from '@/data/process-model';
import { getAccount, getWallet } from '@/data/registries';
import { roleHuman, WALLET_OP_HUMAN } from '@/data/labels';
import { foreignOpsFor } from '@/data/cross';
import { computed, inject } from 'vue';
import { hasBlank } from '@/data/blanks';

const props = defineProps<{
  point: ProcessPoint;
  /** process_type стандарта, которому принадлежит шаг. */
  self?: string;
  active?: boolean;
  nested?: boolean;
}>();

/** Открыть бланк документа — панель живёт в описании процесса. */
const openBlank = inject<(id: number | undefined | null) => void>('openBlank', () => {});

/** Операции других процессов, которые проводит действие этого шага. */
const foreignOps = computed(() =>
  props.point.action && props.self ? foreignOpsFor(props.point.action, props.self) : [],
);

const emit = defineEmits<{ (e: 'show', number: string): void }>();

function account(code: number | null): string {
  if (code == null) return '—';
  const meta = getAccount(code);
  return meta ? `${code} «${meta.name}»` : String(code);
}

function wallet(id: string | null): string {
  if (!id) return '';
  return getWallet(id)?.human_name ?? id;
}

function stateLabel(name: string, human: string, end: 'from' | 'to'): string {
  if (name === '∅') return end === 'from' ? 'новая запись' : 'запись закрыта';
  return human;
}
</script>

<template>
  <section
    :id="point.anchor"
    class="pt"
    :class="{ 'pt--active': active, 'pt--nested': nested }"
    :data-number="point.number"
  >
    <header class="pt__head">
      <span v-if="point.number" class="pt__num">{{ point.number }}</span>
      <div class="pt__titles">
        <h3 class="pt__title">{{ point.title }}</h3>
        <div class="pt__meta">
          <span class="pt__actor">{{ point.actorHuman }}</span>
          <template v-if="point.action">
            <span class="pt__sep">·</span>
            <span v-if="point.actionHuman" class="pt__action-human">{{ point.actionHuman }}</span>
            <code class="pt__action">{{ point.action }}</code>
          </template>
          <span v-else class="pt__noaction">без действия в цепи</span>
        </div>
      </div>
      <button
        v-if="point.number"
        type="button"
        class="pt__show"
        title="Показать на схеме"
        @click="emit('show', point.number)"
      >на схеме</button>
    </header>

    <p v-if="point.description" class="pt__desc">{{ point.description }}</p>

    <div v-if="point.pre.length" class="pt__block">
      <div class="pt__label">Условия</div>
      <ul><li v-for="(x, i) in point.pre" :key="i">{{ x }}</li></ul>
    </div>

    <div v-for="(c, i) in point.changes" :key="`c${i}`" class="pt__block">
      <div class="pt__label">
        Статус:
        <span class="pt__state">{{ stateLabel(c.from, c.fromHuman, 'from') }}</span>
        →
        <span class="pt__state pt__state--to">{{ stateLabel(c.to, c.toHuman, 'to') }}</span>
      </div>
      <ul v-if="c.guards.length" class="pt__guards">
        <li v-for="(g, j) in c.guards" :key="j">{{ g }}</li>
      </ul>
    </div>

    <div v-if="point.post.length" class="pt__block">
      <div class="pt__label">Результат</div>
      <ul><li v-for="(x, i) in point.post" :key="i">{{ x }}</li></ul>
    </div>

    <div v-if="point.operations.length" class="pt__facts">
      <div
        v-for="op in point.operations"
        :id="factAnchor(point, 'op', op.ledger_code)"
        :key="op.ledger_code"
        class="pt__fact pt__fact--op"
      >
        <span class="pt__fact-kind">Операция</span>
        <div class="pt__fact-body">
          <div class="pt__fact-title">{{ op.human_name }} <code>{{ op.ledger_code }}</code></div>
          <div v-if="op.debit != null || op.credit != null" class="pt__fact-line">
            Проводка: Дт {{ account(op.debit) }} / Кт {{ account(op.credit) }}
          </div>
          <div v-if="op.wallet_op && op.wallet_op !== 'NONE'" class="pt__fact-line">
            Кошельки ({{ WALLET_OP_HUMAN[op.wallet_op] ?? op.wallet_op }}):
            {{ op.wallet_from ? wallet(op.wallet_from) : 'извне' }}
            →
            {{ op.wallet_to ? wallet(op.wallet_to) : 'наружу' }}
          </div>
          <div class="pt__fact-line pt__fact-line--muted">Сумма: <code>{{ op.amount_ref }}</code></div>
        </div>
      </div>
    </div>

    <div v-if="foreignOps.length" class="pt__facts">
      <div
        v-for="f in foreignOps"
        :key="`${f.standard.process_type}:${f.op.ledger_code}`"
        class="pt__fact pt__fact--op pt__fact--foreign"
      >
        <span class="pt__fact-kind">Операция программы</span>
        <div class="pt__fact-body">
          <div class="pt__fact-title">{{ f.op.human_name }} <code>{{ f.op.ledger_code }}</code></div>
          <div class="pt__fact-line pt__fact-line--muted">
            в процессе
            <RouterLink :to="{ name: 'process', params: { contract: f.standard.contract, processType: f.standard.process_type } }">«{{ f.standard.title }}»</RouterLink>
          </div>
          <div v-if="f.op.debit != null || f.op.credit != null" class="pt__fact-line">
            Проводка: Дт {{ account(f.op.debit) }} / Кт {{ account(f.op.credit) }}
          </div>
          <div v-if="f.op.wallet_op && f.op.wallet_op !== 'NONE'" class="pt__fact-line">
            Кошельки ({{ WALLET_OP_HUMAN[f.op.wallet_op] ?? f.op.wallet_op }}):
            {{ f.op.wallet_from ? wallet(f.op.wallet_from) : 'извне' }}
            →
            {{ f.op.wallet_to ? wallet(f.op.wallet_to) : 'наружу' }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="point.documents.length" class="pt__facts">
      <div
        v-for="(d, i) in point.documents"
        :id="factAnchor(point, 'doc', String(i))"
        :key="`d${i}`"
        class="pt__fact pt__fact--doc"
      >
        <span class="pt__fact-kind">Документ</span>
        <div class="pt__fact-body">
          <div class="pt__fact-title">
            <button v-if="hasBlank(d.registry_id)" type="button" class="pt__doclink" title="Открыть бланк" @click="openBlank(d.registry_id)">{{ d.title }}</button>
            <template v-else>{{ d.title }}</template>
            <code v-if="d.registry_id">№ {{ d.registry_id }}</code>
          </div>
          <div class="pt__fact-line">Подписывает: {{ d.signed_by.map(roleHuman).join(', ') }}</div>
          <div v-if="d.note" class="pt__fact-line pt__fact-line--muted">{{ d.note }}</div>
        </div>
      </div>
    </div>

    <slot />
  </section>
</template>

<style scoped>
.pt {
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg);
  scroll-margin-top: 12px;
  transition: border-color 120ms ease, background 120ms ease;
}
.pt + .pt { margin-top: 12px; }
.pt--flash { animation: pt-flash 1.6s ease; }
.pt--active {
  border-color: var(--accent-border);
  background: color-mix(in srgb, var(--accent-soft) 55%, var(--bg));
}
.pt--nested {
  margin-top: 10px;
  padding: 10px 12px;
  background: var(--surface);
}
.pt__head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.pt__num {
  flex-shrink: 0;
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  border-radius: 14px;
  background: var(--accent-soft);
  border: 1px solid var(--accent-border);
  color: var(--accent);
  font-weight: 600;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.pt--nested .pt__num {
  background: var(--surface-hover);
  border-color: var(--border-strong);
  color: var(--text-muted);
}
.pt__titles { flex: 1; min-width: 0; }
.pt__title {
  margin: 2px 0 2px;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.35;
}
.pt__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 6px;
  font-size: 12.5px;
  color: var(--text-muted);
}
.pt__actor { color: var(--text); font-weight: 500; }
.pt__sep { color: var(--text-subtle); }
.pt__action { font-size: 11px; }
.pt__noaction { font-style: italic; }
.pt__show {
  flex-shrink: 0;
  font-size: 11.5px;
  padding: 2px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  color: var(--text-muted);
}
.pt__show:hover { color: var(--accent); border-color: var(--accent-border); }
.pt__desc {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.6;
}
.pt__block { margin-top: 10px; }
.pt__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}
.pt__block ul {
  margin: 4px 0 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.5;
}
.pt__state {
  font-weight: 600;
  color: var(--text);
}
.pt__state--to { color: var(--accent); }
.pt__guards { color: var(--text-muted); }
.pt__facts {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pt__fact {
  scroll-margin-top: 60px;
  display: flex;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 13px;
}
.pt__fact-kind {
  flex-shrink: 0;
  width: 74px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-subtle);
  padding-top: 2px;
}
.pt__fact--flash {
  animation: pt-flash 1.6s ease;
}
@keyframes pt-flash {
  0%, 40% { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-border); }
  100% { box-shadow: 0 0 0 0 transparent; }
}
.pt__fact--foreign { border-style: dashed; }
.pt__fact--foreign a { color: var(--accent); }
.pt__fact--op .pt__fact-kind { color: var(--accent); }
.pt__fact--doc .pt__fact-kind { color: var(--edge-focus); }
.pt__fact-body { min-width: 0; }
.pt__fact-title { font-weight: 500; }
.pt__doclink {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  text-align: left;
  color: var(--accent);
  text-decoration: underline;
  text-decoration-color: var(--accent-border);
  text-underline-offset: 3px;
  cursor: pointer;
}
.pt__doclink:hover { text-decoration-color: var(--accent); }
.pt__fact-title code { font-size: 10.5px; margin-left: 4px; }
.pt__fact-line { margin-top: 2px; }
.pt__fact-line--muted { color: var(--text-muted); font-size: 12.5px; }
</style>
