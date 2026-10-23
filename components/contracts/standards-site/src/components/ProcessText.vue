<script setup lang="ts">
/**
 * Стандарт как текст плюс схема — два режима на всю ширину.
 *
 * «Описание» — читаемый документ: назначение, сводки (проводки, движение по
 * кошелькам, документы) в порядке процесса и ход процесса по шагам. Кнопка
 * «на схеме» у шага выдвигает справа панель со схемой, сфокусированной на
 * этом шаге; место чтения не теряется.
 * «Схема» — диаграмма последовательности всего процесса во всю рабочую
 * область. Щелчок по шагу на схеме открывает этот шаг в описании.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';
import type { Standard } from '@/types/standard';
import { buildProcessModel, type ProcessPoint } from '@/data/process-model';
import {
  findAction,
  foreignOpsFor,
  modelOf,
  relatedDocs,
  relatedOf,
  triggerActions,
  type ForeignPlace,
} from '@/data/cross';
import type { Ledger2Operation } from '@/types/standard';
import { getAccount, getWallet } from '@/data/registries';
import { useRoute } from 'vue-router';
import PlaceCell from '@/components/PlaceCell.vue';
import BlankPanel from '@/components/BlankPanel.vue';
import { hasBlank } from '@/data/blanks';
import { buildSequenceDiagram, type EmbeddedProcess } from '@/data/sequence-diagram';
import { WALLET_OP_HUMAN, contractHuman, roleHuman } from '@/data/labels';
import { standardsIndex } from '@/data/loader';
import ProcessPointBlock from '@/components/ProcessPointBlock.vue';
import SequenceDiagram from '@/components/SequenceDiagram.vue';

const props = defineProps<{ standard: Standard; mode: 'text' | 'scheme' }>();
const emit = defineEmits<{ (e: 'mode', value: 'text' | 'scheme'): void }>();

const model = computed(() => buildProcessModel(props.standard));

const showLedger = ref(true);
const showDocs = ref(true);

/**
 * Процесс, в который шаг передаёт управление: у действия есть переход
 * (`links`) на стандарт, который этот процесс использует (`related: consumes`).
 * Его шаги встраиваются в схему сразу после шага.
 */
function embedFor(point: ProcessPoint): EmbeddedProcess | null {
  if (!point.action) return null;
  const consumes = new Set(
    (props.standard.related ?? []).filter((r) => r.relation === 'consumes').map((r) => r.process_type),
  );
  const action = (props.standard.actions ?? []).find((a) => a.name === point.action);
  for (const l of action?.links ?? []) {
    if (!consumes.has(l.process_type)) continue;
    const target = standardsIndex.byProcessType[l.process_type];
    if (!target) continue;
    return {
      title: target.title,
      contractHuman: `Контракт: ${contractHuman(target.contract)}`,
      model: modelOf(target),
      hostOps: (a: string) =>
        (props.standard.operations ?? []).filter((op) => triggerActions(op).includes(a)),
    };
  }
  return null;
}

const diagram = computed(() =>
  buildSequenceDiagram(model.value, {
    contractHuman: `Контракт: ${contractHuman(props.standard.contract)}`,
    showLedger: showLedger.value && props.standard.operations.length > 0,
    showDocs: showDocs.value,
    embed: embedFor,
  }),
);

const article = ref<HTMLElement | null>(null);
const drawerSeq = ref<InstanceType<typeof SequenceDiagram> | null>(null);
const active = ref<string | null>(null);
const drawerOpen = ref(false);

/** Подпись под записью сводки: на каком шаге (шагах) она возникает. */
function placeText(points: ProcessPoint[], fallback: string): string {
  if (!points.length) return fallback;
  const titles = [...new Set(points.map((p) => p.title))];
  return titles.length > 2 ? `${titles.slice(0, 2).join('; ')} и ещё ${titles.length - 2}` : titles.join('; ');
}

function scrollToNumber(number: string, anchor?: string): void {
  const id = anchor ?? diagram.value.anchors[number];
  const el = id ? article.value?.querySelector<HTMLElement>(`#${CSS.escape(id)}`) : null;
  if (!el) return;
  active.value = number;
  suppressUntil = performance.now() + 900;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // Вспышка показывает, куда именно привёл переход.
  const cls = el.classList.contains('pt') ? 'pt--flash' : 'pt__fact--flash';
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  window.setTimeout(() => el.classList.remove(cls), 1700); // timing: animation — снять класс вспышки
}

/** Выдвинуть панель со схемой и показать на ней шаг. */
function showOnDiagram(number: string | null): void {
  if (number) active.value = number;
  if (drawerOpen.value) {
    if (number) drawerSeq.value?.focusOn(number);
    return;
  }
  drawerOpen.value = true;
}

/**
 * Щелчок по схеме во вкладке «Схема» — открыть это место в описании.
 * Вкладка переключается через адрес, асинхронно: прокручиваем, когда
 * описание уже видно.
 */
const pending = ref<{ number: string; anchor: string } | null>(null);
function openInText(number: string, anchor: string): void {
  pending.value = { number, anchor };
  if (props.mode === 'text') flushPending();
  else emit('mode', 'text');
}
function flushPending(): void {
  const p = pending.value;
  if (!p) return;
  pending.value = null;
  nextTick(() => requestAnimationFrame(() => scrollToNumber(p.number, p.anchor)));
}
watch(
  () => props.mode,
  (m) => {
    if (m === 'text') flushPending();
  },
);

/** Щелчок по схеме в панели — закрыть панель, чтобы было видно, куда привёл переход. */
function openFromDrawer(number: string, anchor: string): void {
  drawerOpen.value = false;
  nextTick(() => scrollToNumber(number, anchor));
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && drawerOpen.value) drawerOpen.value = false;
}

function scrollToSection(id: string): void {
  article.value?.querySelector(`#${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Какой шаг читается сейчас ───────────────────────────────────────────────
// Текущий — последний шаг, чья верхняя граница прошла верхнюю треть колонки.
let suppressUntil = 0;
let raf = 0;
function onScroll(): void {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    if (performance.now() < suppressUntil) return;
    const root = article.value;
    if (!root) return;
    const limit = root.getBoundingClientRect().top + root.clientHeight * 0.33;
    let current: string | null = null;
    root.querySelectorAll<HTMLElement>('.pt[data-number]').forEach((el) => {
      const n = el.dataset.number;
      if (!n) return;
      if (el.getBoundingClientRect().top <= limit) current = n;
    });
    if (current !== active.value) active.value = current;
  });
}

onMounted(() => {
  article.value?.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('keydown', onKey);
  nextTick(onScroll);
  nextTick(() => requestAnimationFrame(scrollToQueryAnchor));
});
onBeforeUnmount(() => {
  article.value?.removeEventListener('scroll', onScroll);
  window.removeEventListener('keydown', onKey);
  if (raf) cancelAnimationFrame(raf);
});

const states = computed(() => props.standard.states ?? []);
// ── Связи с другими процессами ──────────────────────────────────────────────
const related = computed(() => relatedOf(props.standard));
const foreignDocs = computed(() => relatedDocs(props.standard));

/** Все точки процесса в порядке чтения — для сортировки строк сводок. */
const orderedPoints = computed<ProcessPoint[]>(() => {
  const out: ProcessPoint[] = [];
  for (const st of model.value.steps) out.push(st, ...st.alternatives);
  out.push(...model.value.extra);
  return out;
});

/** Где возникает операция, у которой нет шага здесь: действие другого процесса. */
function externalFor(op: Ledger2Operation): ForeignPlace | null {
  for (const a of triggerActions(op)) {
    const place = findAction(a, props.standard.process_type);
    if (place) return place;
  }
  return null;
}

interface OpRow {
  key: string;
  op: Ledger2Operation;
  points: ProcessPoint[];
  external: ForeignPlace | null;
  /** Операция чужого процесса, которую проводит действие этого. */
  program: { title: string; processType: string; contract: string } | null;
  order: number;
}

/** Операции других процессов, которые порождают действия этого (по шагам). */
const foreignRows = computed<OpRow[]>(() => {
  const rows: OpRow[] = [];
  orderedPoints.value.forEach((p, idx) => {
    if (!p.action) return;
    for (const f of foreignOpsFor(p.action, props.standard.process_type)) {
      rows.push({
        key: `${f.standard.process_type}:${f.op.ledger_code}:${p.anchor}`,
        op: f.op,
        points: [p],
        external: null,
        program: { title: f.standard.title, processType: f.standard.process_type, contract: f.standard.contract },
        order: idx,
      });
    }
  });
  return rows;
});

/** Точки в чужом процессе группируем: одна операция может идти на нескольких шагах. */
function mergeRows(rows: OpRow[]): OpRow[] {
  const byKey = new Map<string, OpRow>();
  for (const r of rows) {
    const k = r.program ? `${r.program.processType}:${r.op.ledger_code}` : r.key;
    const prev = byKey.get(k);
    if (prev) prev.points.push(...r.points.filter((p) => !prev.points.includes(p)));
    else byKey.set(k, { ...r, points: [...r.points] });
  }
  return [...byKey.values()].sort((a, b) => a.order - b.order);
}

function ownRow(op: Ledger2Operation, points: ProcessPoint[]): OpRow {
  const idx = points.length ? orderedPoints.value.indexOf(points[0]) : Number.MAX_SAFE_INTEGER;
  return {
    key: op.ledger_code,
    op,
    points,
    external: points.length ? null : externalFor(op),
    program: null,
    order: idx,
  };
}

const postingRows = computed(() =>
  mergeRows([
    ...model.value.postings.map((r) => ownRow(r.op, r.points)),
    ...foreignRows.value.filter((r) => r.op.debit != null || r.op.credit != null),
  ]),
);
const walletRows = computed(() =>
  mergeRows([
    ...model.value.wallets.map((r) => ownRow(r.op, r.points)),
    ...foreignRows.value.filter(
      (r) => r.op.wallet_op && r.op.wallet_op !== 'NONE' && (r.op.wallet_from || r.op.wallet_to),
    ),
  ]),
);

function accountLabel(code: number | null): { code: string; name: string } {
  if (code == null) return { code: '—', name: '' };
  return { code: String(code), name: getAccount(code)?.name ?? '' };
}
function walletLabel(id: string | null, empty: string): string {
  if (!id) return empty;
  return getWallet(id)?.human_name ?? id;
}

/** Переход по ссылке из другого процесса: ?at=<якорь шага>. */
const route = useRoute();

// ── Бланк документа ─────────────────────────────────────────────────────────
// Название документа в описании открывает его бланк в панели справа.
const blankId = ref<number | null>(null);
function openBlank(registryId: number | undefined | null): void {
  if (hasBlank(registryId)) blankId.value = registryId!;
}
provide('openBlank', openBlank);
function scrollToQueryAnchor(): void {
  const at = route.query.at;
  if (typeof at !== 'string' || !at) return;
  const el = article.value?.querySelector<HTMLElement>(`#${CSS.escape(at)}`);
  const number = el?.dataset.number;
  if (number) scrollToNumber(number, at);
}
watch(() => route.query.at, () => nextTick(scrollToQueryAnchor));

const actorLabels = computed(() => [...new Set(model.value.actors.map((a) => a.human || a.id))]);
</script>

<template>
  <div class="ptx">
    <article v-show="mode === 'text'" ref="article" class="ptx__text">
     <div class="ptx__inner">
      <p class="ptx__purpose">{{ standard.purpose }}</p>

      <div class="ptx__roles">
        <span class="ptx__roles-label">Участники:</span>
        <span v-for="label in actorLabels" :key="label" class="ptx__chip">{{ label }}</span>
      </div>

      <section v-if="related.length" id="sec-related" class="ptx__links">
        <div class="ptx__links-title">Связанные процессы</div>
        <ul>
          <li v-for="(r, i) in related" :key="i">
            <span class="ptx__links-rel">{{ r.relation }}</span>
            <RouterLink
              v-if="r.standard"
              :to="{ name: 'process', params: { contract: r.standard.contract, processType: r.standard.process_type } }"
            >«{{ r.standard.title }}»</RouterLink>
            <code v-else-if="r.processType">{{ r.processType }}</code>
            <span v-if="r.note" class="ptx__links-note">{{ r.note }}</span>
          </li>
        </ul>
      </section>

      <nav class="ptx__toc">
        <button type="button" @click="scrollToSection('sec-postings')">
          Проводки <b>{{ postingRows.length }}</b>
        </button>
        <button type="button" @click="scrollToSection('sec-wallets')">
          Кошельки <b>{{ walletRows.length }}</b>
        </button>
        <button type="button" @click="scrollToSection('sec-docs')">
          Документы <b>{{ model.documents.length + foreignDocs.length }}</b>
        </button>
        <button type="button" @click="scrollToSection('sec-flow')">
          Ход процесса <b>{{ model.steps.length }}</b>
        </button>
        <button type="button" @click="scrollToSection('sec-states')">
          Статусы <b>{{ states.length }}</b>
        </button>
      </nav>

      <!-- ── Проводки ─────────────────────────────────────────────────────── -->
      <section id="sec-postings" class="ptx__sec">
        <h2>Проводки</h2>
        <p v-if="!postingRows.length" class="ptx__empty">Процесс не формирует бухгалтерских проводок.</p>
        <table v-else class="ptx__table">
          <thead>
            <tr><th>Шаг</th><th>Операция</th><th>Дебет</th><th>Кредит</th><th>Сумма</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in postingRows" :key="r.key">
              <td><PlaceCell :points="r.points" :external="r.external" @go="scrollToNumber" /></td>
              <td>
                {{ r.op.human_name }}
                <div v-if="r.program" class="ptx__sub">
                  операция процесса
                  <RouterLink :to="{ name: 'process', params: { contract: r.program.contract, processType: r.program.processType } }">«{{ r.program.title }}»</RouterLink>
                </div>
                <div v-else-if="r.external" class="ptx__sub">
                  проводит действие «{{ r.external.point?.title ?? r.op.triggered_by }}» процесса
                  «{{ r.external.standard.title }}»
                </div>
                <div v-else class="ptx__sub">{{ placeText(r.points, r.op.triggered_by) }}</div>
              </td>
              <td><b>{{ accountLabel(r.op.debit).code }}</b> <span class="ptx__sub">{{ accountLabel(r.op.debit).name }}</span></td>
              <td><b>{{ accountLabel(r.op.credit).code }}</b> <span class="ptx__sub">{{ accountLabel(r.op.credit).name }}</span></td>
              <td><code>{{ r.op.amount_ref }}</code></td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- ── Кошельки ─────────────────────────────────────────────────────── -->
      <section id="sec-wallets" class="ptx__sec">
        <h2>Движение по кошелькам</h2>
        <p v-if="!walletRows.length" class="ptx__empty">Процесс не двигает средства по кошелькам.</p>
        <table v-else class="ptx__table">
          <thead>
            <tr><th>Шаг</th><th>Операция</th><th>Откуда</th><th>Куда</th><th>Вид</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in walletRows" :key="r.key">
              <td><PlaceCell :points="r.points" :external="r.external" @go="scrollToNumber" /></td>
              <td>
                {{ r.op.human_name }}
                <div v-if="r.program" class="ptx__sub">
                  операция процесса
                  <RouterLink :to="{ name: 'process', params: { contract: r.program.contract, processType: r.program.processType } }">«{{ r.program.title }}»</RouterLink>
                </div>
                <div v-else-if="r.external" class="ptx__sub">
                  проводит действие «{{ r.external.point?.title ?? r.op.triggered_by }}» процесса
                  «{{ r.external.standard.title }}»
                </div>
                <div v-else class="ptx__sub">{{ placeText(r.points, r.op.triggered_by) }}</div>
              </td>
              <td>{{ walletLabel(r.op.wallet_from, 'извне') }}</td>
              <td>{{ walletLabel(r.op.wallet_to, 'наружу') }}</td>
              <td class="ptx__muted">{{ WALLET_OP_HUMAN[r.op.wallet_op] ?? r.op.wallet_op }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- ── Документы ────────────────────────────────────────────────────── -->
      <section id="sec-docs" class="ptx__sec">
        <h2>Документы</h2>
        <p v-if="!model.documents.length && !foreignDocs.length" class="ptx__empty">Документы в процессе не оформляются.</p>
        <p v-else-if="!model.documents.length" class="ptx__empty">
          В самом процессе документы не оформляются — они оформляются в связанном процессе.
        </p>
        <table v-if="model.documents.length || foreignDocs.length" class="ptx__table">
          <thead>
            <tr><th>Шаг</th><th>Документ</th><th>Подписывает</th><th>№</th></tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in model.documents" :key="`own${i}`">
              <td><PlaceCell :points="r.points" @go="scrollToNumber" /></td>
              <td>
                <button v-if="hasBlank(r.doc.registry_id)" type="button" class="ptx__doclink" title="Открыть бланк" @click="openBlank(r.doc.registry_id)">{{ r.doc.title }}</button>
                <template v-else>{{ r.doc.title }}</template>
                <div class="ptx__sub">{{ placeText(r.points, r.doc.action ?? '') }}</div>
              </td>
              <td>{{ r.doc.signed_by.map(roleHuman).join(', ') }}</td>
              <td class="ptx__muted">{{ r.doc.registry_id ?? '' }}</td>
            </tr>
            <tr v-for="(r, i) in foreignDocs" :key="`rel${i}`">
              <td><PlaceCell :points="[]" :external="{ standard: r.standard, point: r.point }" /></td>
              <td>
                <button v-if="hasBlank(r.doc.registry_id)" type="button" class="ptx__doclink" title="Открыть бланк" @click="openBlank(r.doc.registry_id)">{{ r.doc.title }}</button>
                <template v-else>{{ r.doc.title }}</template>
                <div class="ptx__sub">
                  в процессе
                  <RouterLink :to="{ name: 'process', params: { contract: r.standard.contract, processType: r.standard.process_type } }">«{{ r.standard.title }}»</RouterLink>
                  <template v-if="r.point">, шаг «{{ r.point.title }}»</template>
                </div>
              </td>
              <td>{{ r.doc.signed_by.map(roleHuman).join(', ') }}</td>
              <td class="ptx__muted">{{ r.doc.registry_id ?? '' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- ── Ход процесса ─────────────────────────────────────────────────── -->
      <section id="sec-flow" class="ptx__sec">
        <h2>Ход процесса</h2>
        <p v-if="model.derivedFromTransitions" class="ptx__note">
          Сценарий в стандарте не описан — шаги собраны по переходам статусов.
        </p>
        <ProcessPointBlock
          v-for="s in model.steps"
          :key="s.anchor"
          :point="s"
          :self="standard.process_type"
          :active="active === s.number"
          @show="showOnDiagram"
        >
          <ProcessPointBlock
            v-for="a in s.alternatives"
            :key="a.anchor"
            :point="a"
            :self="standard.process_type"
            :active="active === a.number"
            nested
            @show="showOnDiagram"
          />
        </ProcessPointBlock>

        <template v-if="model.extra.length">
          <h3 class="ptx__h3">Действия без шага в сценарии</h3>
          <p class="ptx__note">
            Эти действия объявлены в стандарте, но в шагах сценария не участвуют:
            служебные действия, повторные варианты шагов или действия, которые
            вызывает другой процесс.
          </p>
          <ProcessPointBlock v-for="p in model.extra" :key="p.anchor" :point="p" :self="standard.process_type" />
        </template>
      </section>

      <!-- ── Статусы ──────────────────────────────────────────────────────── -->
      <section id="sec-states" class="ptx__sec">
        <h2>Статусы {{ standard.entity_human ? `«${standard.entity_human}»` : '' }}</h2>
        <dl class="ptx__states">
          <template v-for="st in states" :key="st.name">
            <dt>{{ st.human ?? st.name }} <code>{{ st.name }}</code></dt>
            <dd>{{ st.description }}</dd>
          </template>
        </dl>
      </section>

     </div>
    </article>

    <button
      v-if="mode === 'text' && !drawerOpen"
      type="button"
      class="ptx__fab"
      title="Показать схему справа, не уходя из текста"
      @click="showOnDiagram(active)"
    >Схема ▸</button>

    <section v-if="mode === 'scheme'" class="ptx__scheme">
      <div class="ptx__diagram-opts">
        <label><input v-model="showLedger" type="checkbox" /> операции на схеме</label>
        <label><input v-model="showDocs" type="checkbox" /> документы на схеме</label>
        <span class="ptx__hint">Наведите на строку схемы и щёлкните — откроется это место в описании</span>
      </div>
      <SequenceDiagram
        :code="diagram.code"
        :anchors="diagram.anchors"
        :targets="diagram.targets"
        :active="null"
        :follow="false"
        @select="openInText"
      />
    </section>

    <BlankPanel :registry-id="blankId" @close="blankId = null" />

    <Transition name="fade">
      <div
        v-if="drawerOpen && mode === 'text'"
        class="ptx__backdrop"
        title="Закрыть схему"
        @click="drawerOpen = false"
      />
    </Transition>
    <Transition name="drawer">
      <aside v-if="drawerOpen && mode === 'text'" class="ptx__drawer">
        <header class="ptx__drawer-head">
          <b>Схема процесса</b>
          <label><input v-model="showLedger" type="checkbox" /> операции</label>
          <label><input v-model="showDocs" type="checkbox" /> документы</label>
          <button type="button" class="ptx__close" title="Закрыть (Esc)" @click="drawerOpen = false">×</button>
        </header>
        <SequenceDiagram
          ref="drawerSeq"
          :follow="true"
          focus-on-render
          :code="diagram.code"
          :anchors="diagram.anchors"
          :targets="diagram.targets"
          :active="active"
          @select="openFromDrawer"
        />
      </aside>
    </Transition>
  </div>
</template>

<style scoped>
.ptx {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
}
.ptx__text {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}
.ptx__inner {
  max-width: 980px;
  padding: 4px 14px 120px 2px;
}
.ptx__scheme {
  display: flex;
  flex-direction: column;
  gap: 6px;
  height: 100%;
  min-height: 0;
}
.ptx__diagram-opts {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 12px;
  color: var(--text-muted);
}
.ptx__diagram-opts label,
.ptx__drawer-head label { display: inline-flex; gap: 4px; align-items: center; cursor: pointer; }
.ptx__hint { margin-left: auto; color: var(--text-subtle); }
.ptx__fab {
  position: absolute;
  right: 18px;
  bottom: 18px;
  z-index: 5;
  padding: 8px 16px;
  border: 1px solid var(--accent-border);
  border-radius: 20px;
  background: var(--accent);
  color: var(--bg);
  font-weight: 600;
  font-size: 13px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
}
.ptx__drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  width: min(1100px, 72vw);
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px 12px;
  background: var(--bg);
  border-left: 1px solid var(--border);
  box-shadow: -16px 0 40px rgba(0, 0, 0, 0.18);
}
.ptx__drawer-head {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 12.5px;
  color: var(--text-muted);
}
.ptx__drawer-head b { color: var(--text); font-size: 14px; }
.ptx__close {
  margin-left: auto;
  width: 30px;
  height: 30px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  font-size: 18px;
  line-height: 1;
  color: var(--text);
}
.ptx__backdrop {
  position: fixed;
  inset: 0;
  z-index: 39;
  background: rgba(0, 0, 0, 0.18);
  cursor: pointer;
}
.fade-enter-active,
.fade-leave-active { transition: opacity 200ms ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }
.drawer-enter-active,
.drawer-leave-active { transition: transform 200ms ease; }
.drawer-enter-from,
.drawer-leave-to { transform: translateX(100%); }
.ptx__purpose {
  font-size: 15px;
  line-height: 1.65;
  margin: 4px 0 12px;
}
.ptx__roles {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
}
.ptx__roles-label { color: var(--text-muted); }
.ptx__chip {
  padding: 1px 9px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
}
.ptx__toc {
  position: sticky;
  top: -4px;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 14px 0 0;
  padding: 8px 0;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}
.ptx__toc button {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: var(--radius);
  padding: 3px 10px;
  font-size: 12.5px;
  color: var(--text);
}
.ptx__toc button:hover { border-color: var(--accent-border); }
.ptx__toc b { color: var(--accent); margin-left: 2px; }
.ptx__sec { scroll-margin-top: 48px; }
.ptx__sec h2 { margin-top: 26px; }
.ptx__h3 { font-size: 14px; margin: 22px 0 10px; color: var(--text-muted); }
.ptx__empty, .ptx__note { color: var(--text-muted); font-size: 13px; }
.ptx__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.ptx__table th {
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-subtle);
  padding: 4px 8px 6px;
  border-bottom: 1px solid var(--border);
}
.ptx__table td {
  vertical-align: top;
  overflow-wrap: anywhere;
  padding: 7px 8px;
  border-bottom: 1px solid var(--border);
}
.ptx__table td:first-child { width: 1%; white-space: nowrap; }
.ptx__table code { font-size: 11px; }
.ptx__sub { font-size: 11.5px; color: var(--text-muted); }
.ptx__muted { color: var(--text-muted); }
.ptx__steps { display: inline-flex; flex-wrap: wrap; gap: 3px; max-width: 120px; }
.ptx__step {
  min-width: 34px;
  padding: 1px 8px;
  border: 1px solid var(--accent-border);
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
  font-size: 12px;
}
.ptx__states {
  margin: 0;
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 14px;
  font-size: 13px;
}
.ptx__states dt { font-weight: 600; }
.ptx__states dt code { font-size: 10.5px; font-weight: 400; margin-left: 4px; }
.ptx__states dd { margin: 0; color: var(--text-muted); }
.ptx__doclink {
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
.ptx__doclink:hover { text-decoration-color: var(--accent); }
.ptx__links {
  margin-top: 14px;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  font-size: 13px;
}
.ptx__links-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-subtle);
  margin-bottom: 4px;
}
.ptx__links ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
.ptx__links a, .ptx__sub a { color: var(--accent); }
.ptx__links-rel { color: var(--text-muted); margin-right: 6px; }
.ptx__links-note { display: block; color: var(--text-muted); font-size: 12px; margin-left: 2px; }
</style>
