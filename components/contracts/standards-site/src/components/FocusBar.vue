<script setup lang="ts">
/**
 * Горизонтальная полоса деталей фокуса.
 * Живёт внутри рабочей области ProcessGraph, приклеена к низу.
 * Показывает одно из: статус / действие / документ / операцию.
 */
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { FileText, ArrowRight } from 'lucide-vue-next';
import type { Standard, Transition, Ledger2Operation, ContractAction, ProcessDocument } from '@/types/standard';
import { getAccount, getWallet } from '@/data/registries';
import { standardsIndex } from '@/data/loader';

const router = useRouter();

const props = defineProps<{
  standard: Standard;
  focusStatus: string | null;
  focusAction: string | null;
  focusDocument: string | null;
  focusOperation: string | null;
}>();

const INITIAL_MARKER = '∅';
const START_ID = '__start__';
const END_ID = '__end__';
const REJECTED_PREFIX = '__rejected__';

// В slim-формате actor — свободный русский текст, но оставляем маппинг
// для legacy-YAML, где ещё используются короткие коды.
const ROLE_HUMAN: Record<string, string> = {
  contributor: 'Участник',
  chairman: 'Председатель',
  soviet: 'Совет',
  soviet_members: 'Члены совета',
  meet: 'Общее собрание',
  gateway_operator: 'Кассир',
  administrator: 'Администратор',
  chairman_or_soviet: 'Председатель / Совет',
};
function roleHuman(r: string): string {
  return ROLE_HUMAN[r] ?? r;
}

function actionShort(name: string): string {
  return name.split('::').pop() ?? name;
}

const virtualStates = computed(() =>
  new Set(
    props.standard.states.filter((s) => s.virtual || s.kind === 'virtual').map((s) => s.name),
  ),
);

// Поиск транзишена для focusAction (первый попавшийся с этим именем)
const focusedTransition = computed<Transition | null>(() => {
  if (!props.focusAction) return null;
  return props.standard.transitions.find((t) => t.action === props.focusAction) ?? null;
});

const focusedAction = computed<ContractAction | null>(() => {
  if (!props.focusAction) return null;
  return props.standard.actions.find((a) => a.name === props.focusAction) ?? null;
});

function getOperationsForAction(actionName: string): Ledger2Operation[] {
  return props.standard.operations.filter((op) => op.triggered_by === actionName);
}

const opsForFocusedAction = computed<Ledger2Operation[]>(() => {
  if (!props.focusAction) return [];
  return getOperationsForAction(props.focusAction);
});

// Документы, привязанные к focus action (slim: doc.action; legacy: doc.step → scenario)
function getDocsForAction(actionName: string): ProcessDocument[] {
  const stepToAction = new Map<number, string>();
  for (const step of props.standard.scenario?.steps ?? []) {
    stepToAction.set(step.step, step.action);
  }
  return (props.standard.documents ?? []).filter((d) => {
    if (d.action) return d.action === actionName;
    if (d.step != null) return stepToAction.get(d.step) === actionName;
    return false;
  });
}

const docsForFocusedAction = computed<ProcessDocument[]>(() => {
  if (!props.focusAction) return [];
  return getDocsForAction(props.focusAction);
});

// Читаемый код документа: registry_id (slim) имеет приоритет над template (legacy)
function docCode(d: ProcessDocument): string {
  if (d.registry_id != null) return `#${d.registry_id}`;
  return d.template ?? '';
}

// Переходы к связанным стандартам (кнопки в карточке действия)
function linkTitle(processType: string, fallback?: string): string {
  if (fallback) return fallback;
  const target = standardsIndex.byProcessType[processType];
  return target?.title ?? processType;
}

function openLink(processType: string): void {
  const target = standardsIndex.byProcessType[processType];
  if (!target) return;
  router.push({ name: 'process', params: { contract: target.contract, processType: target.slug } });
}

// Документ по шаблону
const focusedDocument = computed<ProcessDocument | null>(() => {
  if (!props.focusDocument) return null;
  return props.standard.documents.find((d) => d.template === props.focusDocument) ?? null;
});

// Операция по ledger_code
const focusedOperation = computed<Ledger2Operation | null>(() => {
  if (!props.focusOperation) return null;
  return props.standard.operations.find((op) => op.ledger_code === props.focusOperation) ?? null;
});

// Статус
const focusedState = computed(() => {
  if (focusedTransition.value || focusedDocument.value || focusedOperation.value) return null;
  const id = props.focusStatus;
  if (!id) return null;
  if (id === START_ID || id === END_ID) return null;
  const s = props.standard.states.find((x) => x.name === id);
  if (!s) return null;
  return {
    name: s.name,
    label: s.name,
    human: s.human ?? '',
    description: s.description,
    kind: s.kind ?? (s.virtual ? 'virtual' : 'normal'),
  };
});

const focusMode = computed<
  | 'action'
  | 'document'
  | 'operation'
  | 'state'
  | 'process-start'
  | 'process-end'
  | 'process-rejected'
  | 'none'
>(() => {
  if (focusedTransition.value) return 'action';
  if (focusedDocument.value) return 'document';
  if (focusedOperation.value) return 'operation';
  if (props.focusStatus === START_ID) return 'process-start';
  if (props.focusStatus === END_ID) return 'process-end';
  if (rejectedInfo.value) return 'process-rejected';
  if (focusedState.value) return 'state';
  return 'none';
});

// ── Данные для «завершения отказом» ─────────────────────────────────────
interface RejectedInfo {
  transition: Transition;
  action: ContractAction | undefined;
  virtualState: Standard['states'][number] | undefined;
}
function parseRejectedId(id: string): { from: string; actionShort: string } | null {
  if (!id.startsWith(REJECTED_PREFIX)) return null;
  const rest = id.slice(REJECTED_PREFIX.length);
  const idx = rest.indexOf('__');
  if (idx < 0) return null;
  return { from: rest.slice(0, idx), actionShort: rest.slice(idx + 2) };
}
const rejectedInfo = computed<RejectedInfo | null>(() => {
  const id = props.focusStatus;
  if (!id) return null;
  const parsed = parseRejectedId(id);
  if (!parsed) return null;
  const transition = props.standard.transitions.find((t) => {
    const from = t.from === INITIAL_MARKER ? 'start' : t.from;
    return from === parsed.from && actionShort(t.action) === parsed.actionShort;
  });
  if (!transition) return null;
  const action = props.standard.actions.find((a) => a.name === transition.action);
  const virtualState = props.standard.states.find((s) => s.name === transition.to);
  return { transition, action, virtualState };
});

// ── Данные для «конца процесса» ─────────────────────────────────────────
const terminalStates = computed(() => {
  const vset = virtualStates.value;
  return props.standard.states.filter((s) => {
    if (s.virtual || s.kind === 'virtual') return false;
    if (s.kind === 'final') return true;
    const outs = props.standard.transitions.filter(
      (t) => t.from === s.name && !vset.has(t.to),
    );
    return outs.length === 0;
  });
});

function accountTitle(code: number | null | undefined): string {
  if (code == null) return 'Счёт не задан';
  const meta = getAccount(code);
  if (!meta) return `${code} (нет в реестре)`;
  const kind = meta.kind === 'active' ? 'актив' : meta.kind === 'passive' ? 'пассив' : 'актив/пассив';
  return `${code} · ${meta.name} · ${kind}`;
}

function walletTitle(name: string | null | undefined, op: Ledger2Operation['wallet_op']): string {
  if (name == null || name === '') {
    // пусто допустимо только для ISSUE (из ниоткуда) или CONSUME (в никуда)
    if (op === 'ISSUE') return 'Выпуск средств извне системы';
    return 'Кошелёк не задан';
  }
  const meta = getWallet(name);
  if (!meta) return `${name} (нет в реестре)`;
  return `${name} · ${meta.human_name}`;
}

function walletDisplayId(name: string | null | undefined): string {
  return name == null || name === '' ? '∅' : name;
}

</script>

<template>
  <section
    v-if="focusMode !== 'none' && focusMode !== 'process-start'"
    class="focus-bar"
    :class="{
      'focus-bar--edge': focusMode === 'action',
      'focus-bar--doc': focusMode === 'document',
      'focus-bar--op': focusMode === 'operation',
      'focus-bar--process': focusMode === 'process-end',
      'focus-bar--rejected': focusMode === 'process-rejected',
    }"
  >

    <!-- Завершение отказом -->
    <template v-if="focusMode === 'process-rejected' && rejectedInfo">
      <div class="focus-bar__col focus-bar__col--main">
        <div class="focus-bar__kicker">Завершение отказом</div>
        <div class="focus-bar__title-row">
          <span class="focus-bar__human">
            {{ rejectedInfo.action?.human ?? actionShort(rejectedInfo.transition.action) }}
          </span>
          <code class="focus-bar__code">{{ rejectedInfo.transition.action }}</code>
          <span class="focus-bar__actor">· {{ roleHuman(rejectedInfo.transition.actor) }}</span>
        </div>
        <p v-if="rejectedInfo.action?.purpose" class="focus-bar__desc">
          {{ rejectedInfo.action.purpose }}
        </p>
        <p v-if="rejectedInfo.virtualState" class="focus-bar__desc">
          <span class="focus-bar__kicker-mini">Результат:</span>
          виртуальный статус
          <code class="focus-bar__inline-code">{{ rejectedInfo.virtualState.name }}</code>
          <template v-if="rejectedInfo.virtualState.human">
            — <strong>{{ rejectedInfo.virtualState.human }}</strong>
          </template>.
          {{ rejectedInfo.virtualState.description }}
        </p>
      </div>
    </template>

    <!-- Конец процесса -->
    <template v-else-if="focusMode === 'process-end'">
      <div class="focus-bar__col focus-bar__col--main">
        <div class="focus-bar__kicker">Конец процесса</div>
        <div class="focus-bar__title-row">
          <template v-for="(s, i) in terminalStates" :key="i">
            <span v-if="i > 0" class="focus-bar__sep">·</span>
            <code class="focus-bar__code focus-bar__code--state">{{ s.name }}</code>
            <span v-if="s.human" class="focus-bar__human">{{ s.human }}</span>
          </template>
          <span class="focus-bar__badge">финал</span>
        </div>
      </div>
    </template>

    <!-- Действие -->
    <template v-if="focusMode === 'action' && focusedTransition">
      <div class="focus-bar__col focus-bar__col--main">
        <div class="focus-bar__kicker">Действие</div>
        <div class="focus-bar__title-row">
          <span class="focus-bar__human">{{ focusedAction?.human ?? actionShort(focusedTransition.action) }}</span>
          <code class="focus-bar__code">{{ focusedTransition.action }}</code>
          <span class="focus-bar__actor">· {{ roleHuman(focusedTransition.actor) }}</span>
        </div>
        <p v-if="focusedAction?.purpose" class="focus-bar__desc">{{ focusedAction.purpose }}</p>
        <div v-if="focusedTransition.guards && focusedTransition.guards.length" class="focus-bar__guards">
          <span class="focus-bar__kicker-mini">Условия:</span>
          <span class="focus-bar__guard-list">
            <span v-for="(g, i) in focusedTransition.guards" :key="i" class="focus-bar__guard">{{ g }}</span>
          </span>
        </div>
        <div v-if="focusedAction?.links && focusedAction.links.length" class="focus-bar__links">
          <span class="focus-bar__kicker-mini">Перейти:</span>
          <div class="focus-bar__link-list">
            <button
              v-for="(lnk, i) in focusedAction.links"
              :key="i"
              type="button"
              class="focus-bar__link-btn"
              @click="openLink(lnk.process_type)"
            >
              <span>{{ linkTitle(lnk.process_type, lnk.label) }}</span>
              <ArrowRight :size="13" />
            </button>
          </div>
        </div>
      </div>

      <div v-if="docsForFocusedAction.length" class="focus-bar__col focus-bar__col--docs">
        <div class="focus-bar__kicker-mini">Документы</div>
        <div class="focus-bar__doc-list">
          <div v-for="(d, i) in docsForFocusedAction" :key="i" class="focus-bar__doc-chip">
            <FileText :size="14" class="focus-bar__doc-icon" />
            <div class="focus-bar__doc-body">
              <div class="focus-bar__doc-title">{{ d.title }}</div>
              <div class="focus-bar__doc-meta">
                <code class="focus-bar__doc-code">{{ docCode(d) }}</code>
                <span v-if="d.signed_by && d.signed_by.length" class="focus-bar__doc-signers">
                  подписывает: {{ d.signed_by.map(roleHuman).join(', ') }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="opsForFocusedAction.length" class="focus-bar__col focus-bar__col--ops">
        <div class="focus-bar__kicker-mini">Операция</div>
        <div class="focus-bar__ops">
          <div v-for="op in opsForFocusedAction" :key="op.ledger_code" class="focus-bar__op-block">
            <div class="focus-bar__op-name">{{ op.human_name }}</div>

            <div class="focus-bar__op-subs">
              <div
                v-if="op.debit != null || op.credit != null"
                class="focus-bar__op-sub"
              >
                <div class="focus-bar__op-sub-label">Проводки</div>
                <div class="focus-bar__op-sub-body">
                  <span class="tooltip" :data-tip="accountTitle(op.debit)">
                    Дт <code>{{ op.debit ?? '—' }}</code>
                  </span>
                  <span class="focus-bar__op-sep">/</span>
                  <span class="tooltip" :data-tip="accountTitle(op.credit)">
                    Кт <code>{{ op.credit ?? '—' }}</code>
                  </span>
                </div>
              </div>

              <div
                v-if="op.wallet_op !== 'WALLET_ONLY' && (!!op.wallet_from || !!op.wallet_to)"
                class="focus-bar__op-sub"
              >
                <div class="focus-bar__op-sub-label">Переводы</div>
                <div class="focus-bar__op-sub-body">
                  <span class="tooltip" :data-tip="walletTitle(op.wallet_from, op.wallet_op)">
                    <code>{{ walletDisplayId(op.wallet_from) }}</code>
                  </span>
                  <span class="focus-bar__arrow">→</span>
                  <span class="tooltip" :data-tip="walletTitle(op.wallet_to, op.wallet_op)">
                    <code>{{ walletDisplayId(op.wallet_to) }}</code>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Документ -->
    <template v-else-if="focusMode === 'document' && focusedDocument">
      <div class="focus-bar__col focus-bar__col--main">
        <div class="focus-bar__kicker">Документ</div>
        <div class="focus-bar__title-row">
          <span class="focus-bar__human">{{ focusedDocument.title }}</span>
          <code class="focus-bar__code">{{ docCode(focusedDocument) }}</code>
        </div>
        <p class="focus-bar__desc">
          Подписывает: <strong>{{ focusedDocument.signed_by.map(roleHuman).join(', ') }}</strong>.
          <template v-if="focusedDocument.stored_in">
            Хранится в <code class="focus-bar__inline-code">{{ focusedDocument.stored_in }}</code>.
          </template>
          <span v-if="focusedDocument.note" class="focus-bar__note">{{ focusedDocument.note }}</span>
        </p>
      </div>
    </template>

    <!-- Операция -->
    <template v-else-if="focusMode === 'operation' && focusedOperation">
      <div class="focus-bar__col focus-bar__col--main">
        <div class="focus-bar__kicker">Операция</div>
        <div class="focus-bar__title-row">
          <span class="focus-bar__human">{{ focusedOperation.human_name }}</span>
          <code class="focus-bar__code">{{ focusedOperation.ledger_code }}</code>
        </div>
        <p v-if="focusedOperation.description" class="focus-bar__desc">{{ focusedOperation.description }}</p>
      </div>

      <div class="focus-bar__col focus-bar__col--meta">
        <div
          v-if="focusedOperation.debit != null || focusedOperation.credit != null"
          class="focus-bar__op-sub"
        >
          <div class="focus-bar__op-sub-label">Проводки</div>
          <div class="focus-bar__op-sub-body">
            <span class="tooltip" :data-tip="accountTitle(focusedOperation.debit)">
              Дт <code>{{ focusedOperation.debit ?? '—' }}</code>
            </span>
            <span class="focus-bar__op-sep">/</span>
            <span class="tooltip" :data-tip="accountTitle(focusedOperation.credit)">
              Кт <code>{{ focusedOperation.credit ?? '—' }}</code>
            </span>
          </div>
        </div>

        <div
          v-if="focusedOperation.wallet_op !== 'WALLET_ONLY'
                && (!!focusedOperation.wallet_from || !!focusedOperation.wallet_to)"
          class="focus-bar__op-sub"
        >
          <div class="focus-bar__op-sub-label">Переводы</div>
          <div class="focus-bar__op-sub-body">
            <span class="tooltip" :data-tip="walletTitle(focusedOperation.wallet_from, focusedOperation.wallet_op)">
              <code>{{ walletDisplayId(focusedOperation.wallet_from) }}</code>
            </span>
            <span class="focus-bar__arrow">→</span>
            <span class="tooltip" :data-tip="walletTitle(focusedOperation.wallet_to, focusedOperation.wallet_op)">
              <code>{{ walletDisplayId(focusedOperation.wallet_to) }}</code>
            </span>
          </div>
        </div>

        <div class="focus-bar__op-sub">
          <div class="focus-bar__op-sub-label">Сумма</div>
          <div class="focus-bar__op-sub-body"><code>{{ focusedOperation.amount_ref }}</code></div>
        </div>
      </div>
    </template>

    <!-- Статус -->
    <template v-else-if="focusMode === 'state' && focusedState">
      <div class="focus-bar__col focus-bar__col--main">
        <div class="focus-bar__kicker">
          Статус<template v-if="standard.entity_human"> · {{ standard.entity_human }}</template>
        </div>
        <div class="focus-bar__title-row">
          <code class="focus-bar__code focus-bar__code--state">{{ focusedState.label }}</code>
          <span v-if="focusedState.human" class="focus-bar__human">{{ focusedState.human }}</span>
          <span v-if="focusedState.kind === 'final'" class="focus-bar__badge">финал</span>
          <span v-else-if="focusedState.kind === 'initial'" class="focus-bar__badge">старт</span>
        </div>
        <p class="focus-bar__desc">{{ focusedState.description }}</p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.focus-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 18px 28px;
  align-items: flex-start;
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg);
}
.focus-bar--edge    { background: var(--edge-focus-soft); border-color: var(--edge-focus-border); }
.focus-bar--doc     { background: var(--accent-soft);     border-color: var(--accent-border); }
.focus-bar--op      { background: var(--edge-focus-soft); border-color: var(--edge-focus-border); }
.focus-bar--process { background: var(--accent-soft);     border-color: var(--accent-border); }
.focus-bar--process .focus-bar__kicker { color: var(--accent); }
.focus-bar--process .focus-bar__code   { color: var(--accent); border-color: var(--accent-border); }
.focus-bar--rejected { background: var(--reject-soft); border-color: var(--reject); }
.focus-bar--rejected .focus-bar__kicker { color: var(--reject); }
.focus-bar--rejected .focus-bar__code   { color: var(--reject); border-color: var(--reject); }
.focus-bar__desc--hint {
  color: var(--text-subtle);
  font-style: italic;
  font-size: 11.5px;
}
.focus-bar__desc--lead {
  color: var(--text);
  font-size: 13px;
  line-height: 1.55;
}
.focus-bar__entry {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.focus-bar__entry + .focus-bar__entry {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed var(--border);
}

.focus-bar__col { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.focus-bar__col--main { flex: 1 1 280px; }
.focus-bar__col--meta { flex: 0 0 auto; }
.focus-bar__col--ops  { flex: 1.5 1 320px; min-width: 280px; }
.focus-bar__col--docs { flex: 1 1 220px; min-width: 200px; }

.focus-bar__doc-list { display: flex; flex-direction: column; gap: 6px; margin-top: 2px; }
.focus-bar__doc-chip {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 8px 10px;
  background: var(--accent-soft);
  border: 1px solid var(--accent-border);
  border-radius: 6px;
}
.focus-bar__doc-icon { color: var(--accent); flex: 0 0 auto; margin-top: 1px; }
.focus-bar__doc-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.focus-bar__doc-title { font-size: 12.5px; font-weight: 600; color: var(--text); line-height: 1.3; }
.focus-bar__doc-meta {
  display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
  font-size: 11px; color: var(--text-muted);
}
.focus-bar__doc-code {
  font-family: var(--font-mono); font-size: 10.5px;
  padding: 1px 5px; border-radius: 3px;
  background: var(--bg); border: 1px solid var(--accent-border); color: var(--accent); font-weight: 600;
}
.focus-bar__doc-signers { font-style: italic; }

.focus-bar__links { margin-top: 6px; display: flex; flex-direction: column; gap: 4px; }
.focus-bar__link-list { display: flex; flex-wrap: wrap; gap: 6px; }
.focus-bar__link-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px 4px 12px;
  font: inherit; font-size: 11.5px; font-weight: 500; color: var(--edge-focus);
  background: var(--bg);
  border: 1px solid var(--edge-focus-border);
  border-radius: 14px;
  cursor: pointer;
  transition: background 100ms ease, border-color 100ms ease;
}
.focus-bar__link-btn:hover {
  background: var(--edge-focus-soft);
  border-color: var(--edge-focus);
}

.focus-bar__kicker,
.focus-bar__kicker-mini {
  font-size: 10px; font-weight: 600; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--text-subtle);
}
.focus-bar__kicker-mini { letter-spacing: 0.06em; }
.focus-bar--edge .focus-bar__kicker,
.focus-bar--op   .focus-bar__kicker { color: var(--edge-focus); }
.focus-bar--doc  .focus-bar__kicker { color: var(--accent); }

.focus-bar__title-row {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
}
.focus-bar__human {
  font-size: 15px; font-weight: 600; color: var(--text);
}
.focus-bar__code {
  font-family: var(--font-mono); font-size: 11px;
  padding: 2px 6px; border-radius: 4px;
  background: var(--bg); border: 1px solid var(--border); color: var(--text-muted);
}
.focus-bar__code--state {
  font-size: 14px; padding: 2px 8px; color: var(--text); font-weight: 500;
}
.focus-bar--edge .focus-bar__code,
.focus-bar--op   .focus-bar__code { color: var(--edge-focus); border-color: var(--edge-focus-border); }
.focus-bar--doc  .focus-bar__code { color: var(--accent);     border-color: var(--accent-border); }

.focus-bar__actor { font-size: 12px; color: var(--text-muted); }
.focus-bar__kind-chip {
  font-family: var(--font-mono); font-size: 10px;
  padding: 1px 6px; border: 1px solid var(--edge-focus-border); border-radius: 3px;
  color: var(--edge-focus);
}
.focus-bar__badge {
  font-size: 10px; padding: 2px 8px;
  background: var(--accent-soft); color: var(--accent);
  border: 1px solid var(--accent-border); border-radius: 10px;
  font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
}
.focus-bar__desc {
  margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--text-muted);
  white-space: pre-line;
}
.focus-bar__inline-code {
  font-family: var(--font-mono); font-size: 11px;
  background: var(--bg); padding: 1px 4px; border-radius: 3px; border: 1px solid var(--border);
}
.focus-bar__note {
  display: inline-block; margin-left: 6px; color: var(--text-subtle); font-style: italic;
}

.focus-bar__arrow { color: var(--text-subtle); }

.focus-bar__guards { margin-top: 4px; display: flex; flex-direction: column; gap: 3px; font-size: 12px; color: var(--text); }
.focus-bar__guard-list { display: flex; flex-direction: column; gap: 2px; }
.focus-bar__guard::before { content: '· '; color: var(--text-subtle); }

.focus-bar__ops {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  margin-top: 2px;
}
.focus-bar__op-block {
  display: flex; flex-direction: column; gap: 6px;
  min-width: 0;
}
.focus-bar__op-subs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 6px;
}
.focus-bar__op-name {
  font-size: 13px; font-weight: 600; color: var(--text);
  line-height: 1.3;
}
.focus-bar__op-sub {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 10px;
  background: var(--bg);
  border: 1px solid var(--edge-focus-border);
  border-radius: 6px;
}
.focus-bar__op-sub-label {
  font-size: 10px; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--text-subtle);
}
.focus-bar__op-sub-body {
  display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap;
  font-size: 12px; color: var(--text);
}
.focus-bar__op-sub-body code {
  font-family: var(--font-mono); font-size: 11px;
  padding: 1px 6px; border-radius: 3px;
  background: var(--edge-focus-soft); border: 1px solid var(--edge-focus-border);
  color: var(--edge-focus); font-weight: 600;
}
.focus-bar__op-sep { color: var(--text-subtle); }
.focus-bar__sep { color: var(--text-subtle); }

/* ── CSS-tooltip, надёжный (title часто блокируется) ─────────────────────── */
.tooltip { position: relative; display: inline-flex; align-items: center; gap: 4px; cursor: help; }
.tooltip[data-tip]:hover::after,
.tooltip[data-tip]:focus-visible::after {
  content: attr(data-tip);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  padding: 5px 9px;
  background: var(--text);
  color: var(--bg);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.35;
  white-space: nowrap;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
  z-index: 1000;
  pointer-events: none;
}
.tooltip[data-tip]:hover::before,
.tooltip[data-tip]:focus-visible::before {
  content: '';
  position: absolute;
  bottom: calc(100% + 1px);
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: var(--text);
  z-index: 1000;
  pointer-events: none;
}

.focus-bar__opdata {
  margin: 2px 0 0; display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 3px 18px;
}
.focus-bar__opdata > div { display: flex; gap: 8px; font-size: 11.5px; }
.focus-bar__opdata dt { color: var(--text-muted); min-width: 60px; }
.focus-bar__opdata dd {
  margin: 0; color: var(--text); font-family: var(--font-mono); font-size: 11.5px;
}
</style>
