<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { VueFlow, type EdgeMouseEvent, type NodeMouseEvent, type VueFlowStore } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls, ControlButton } from '@vue-flow/controls';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-vue-next';

import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';

import type { Standard } from '@/types/standard';
import {
  layoutStandard,
  computeProcessFlow,
  NODE_TYPES,
  START_ID,
  END_ID,
  INITIAL_MARKER,
} from '@/graph/layout';
import { useTheme } from '@/composables/useTheme';

import StartNode from '@/components/nodes/StartNode.vue';
import StateNode from '@/components/nodes/StateNode.vue';
import EndNode from '@/components/nodes/EndNode.vue';
import RejectedNode from '@/components/nodes/RejectedNode.vue';
import ActionNode from '@/components/nodes/ActionNode.vue';
import FocusBar from '@/components/FocusBar.vue';

const props = defineProps<{
  standard: Standard;
  focusStatus: string | null;
  focusAction: string | null;
  focusDocument: string | null;
  focusOperation: string | null;
}>();

const router = useRouter();
const { theme } = useTheme();
// containerRef — внешняя обёртка (включает FocusBar + канву), на неё навешен fullscreen.
// canvasRef — только канва VueFlow, по её размерам считается центрирование/zoom,
// чтобы FocusBar не «съедал» центр и активный узел реально оказывался по центру видимой области.
const containerRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLElement | null>(null);

const gridColor = computed(() => (theme.value === 'dark' ? '#23232a' : '#e5e5e5'));

const nodeTypes = {
  [NODE_TYPES.START]: markRaw(StartNode),
  [NODE_TYPES.STATE]: markRaw(StateNode),
  [NODE_TYPES.END]: markRaw(EndNode),
  [NODE_TYPES.REJECTED]: markRaw(RejectedNode),
  [NODE_TYPES.ACTION]: markRaw(ActionNode),
} as unknown as Record<string, object>;

const layout = computed(() =>
  layoutStandard(
    props.standard,
    props.focusStatus,
    props.focusAction,
    props.focusDocument,
    props.focusOperation,
  ),
);

// ── Fit view ─────────────────────────────────────────────────────────────
const vfInstance = ref<VueFlowStore | null>(null);
const minZoom = 0.15;
const maxZoom = 3.0;
// Стартовый zoom — константа, единая для всех стандартов. Раньше считали как
// fittedZoom × boost, и масштаб скакал между стандартами (большой граф →
// мелкий fitted, маленький → крупный). Берём фикс — пользователь видит
// одинаковый стартовый кадр независимо от размера графа.
const START_ZOOM = 1.2;

function doFit(): void {
  if (!vfInstance.value) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!vfInstance.value) return;
      const vf = vfInstance.value;
      // Ставим круглешок-старт в центре канвы с фиксированным zoom.
      const canvas = canvasRef.value;
      const cw = canvas?.clientWidth ?? 800;
      const ch = canvas?.clientHeight ?? 600;
      const startN = vf.findNode(START_ID);
      if (startN) {
        const w = (startN.dimensions?.width ?? 48);
        const h = (startN.dimensions?.height ?? 48);
        const nx = startN.position.x + w / 2;
        const ny = startN.position.y + h / 2;
        vf.setViewport({
          x: cw * 0.5 - nx * START_ZOOM,
          y: ch * 0.5 - ny * START_ZOOM,
          zoom: START_ZOOM,
        });
      } else {
        // Fallback (нет start-узла): fitView, чтобы хоть что-то показать.
        vf.fitView({ padding: 0.18 });
      }
    });
  });
}

function onPaneReady(instance: VueFlowStore) {
  vfInstance.value = instance;
  doFit();
}

watch(() => props.standard.process_type, doFit);

// ── Авто-пан: держим фокусный узел в видимой области ──────────────────
function focusedNodeId(): string | null {
  if (props.focusAction && vfInstance.value) {
    const nodes = vfInstance.value.getNodes ?? [];
    const found = (nodes as Array<{ id: string; type?: string; data?: unknown }>).find(
      (n) =>
        n.type === NODE_TYPES.ACTION &&
        (n.data as { actionName?: string } | undefined)?.actionName === props.focusAction,
    );
    if (found) return found.id;
  }
  if (props.focusStatus) return props.focusStatus;
  return null;
}

function ensureInView(nodeId: string | null): void {
  if (!nodeId || !vfInstance.value || !canvasRef.value) return;
  const vf = vfInstance.value;
  const node = vf.findNode(nodeId);
  if (!node) return;
  const vp = vf.getViewport();
  const cw = canvasRef.value.clientWidth;
  const ch = canvasRef.value.clientHeight;
  const w = node.dimensions?.width ?? 120;
  const h = node.dimensions?.height ?? 80;
  const left = vp.x + node.position.x * vp.zoom;
  const top = vp.y + node.position.y * vp.zoom;
  const right = left + w * vp.zoom;
  const bottom = top + h * vp.zoom;
  const pad = 48;
  const outX = left < pad || right > cw - pad;
  const outY = top < pad || bottom > ch - pad;
  if (!outX && !outY) return;
  const cx = node.position.x + w / 2;
  const cy = node.position.y + h / 2;
  vf.setCenter(cx, cy, { zoom: vp.zoom, duration: 280 });
}

watch(
  () => [props.focusStatus, props.focusAction, props.focusDocument, props.focusOperation],
  () => {
    // Ждём обновления слоя VueFlow с новым isFocus, затем корректируем viewport.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => ensureInView(focusedNodeId()));
    });
  },
);

let resizeObserver: ResizeObserver | null = null;
watch(canvasRef, (el) => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (!el || typeof ResizeObserver === 'undefined') return;
  resizeObserver = new ResizeObserver(() => doFit());
  resizeObserver.observe(el);
});
onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});

// ── Fullscreen рабочей области ────────────────────────────────────────
const isFullscreen = ref(false);

function onFsChange(): void {
  isFullscreen.value = document.fullscreenElement === containerRef.value;
  // После смены размера — перепосчитать viewport.
  requestAnimationFrame(() => doFit());
}

if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', onFsChange);
}
onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('fullscreenchange', onFsChange);
  }
});

function toggleFullscreen(): void {
  const el = containerRef.value;
  if (!el) return;
  if (document.fullscreenElement === el) {
    void document.exitFullscreen();
  } else {
    void el.requestFullscreen();
  }
}

function onNodeClick({ node }: NodeMouseEvent) {
  switch (node.type) {
    case NODE_TYPES.START:
    case NODE_TYPES.STATE:
    case NODE_TYPES.END:
    case NODE_TYPES.REJECTED:
      router.push({ query: { s: node.id } });
      break;
    case NODE_TYPES.ACTION: {
      const actionName = (node.data as { actionName?: string })?.actionName;
      if (actionName) router.push({ query: { a: actionName } });
      break;
    }
    default:
      break;
  }
}

function onEdgeClick(_: EdgeMouseEvent) {
  // Рёбра больше не являются фокусируемыми единицами — действия теперь узлы.
}

// ── Навигация prev / next по happy-path (state ↔ edge) ────────────────────
const flow = computed(() => computeProcessFlow(props.standard));

const currentIndex = computed(() => {
  const fa = props.focusAction;
  if (fa) return flow.value.findIndex((it) => it.kind === 'action' && it.actionName === fa);
  const fs = props.focusStatus;
  if (fs) return flow.value.findIndex((it) => it.kind === 'state' && it.id === fs);
  return -1;
});

type Nav = { status: string } | { action: string } | null;

const prevItem = computed<Nav>(() => {
  const i = currentIndex.value;
  if (i <= 0) return null;
  const it = flow.value[i - 1];
  if (it.kind === 'state') return { status: it.id };
  return it.actionName ? { action: it.actionName } : null;
});

const nextItem = computed<Nav>(() => {
  const i = currentIndex.value;
  if (i < 0 || i >= flow.value.length - 1) return null;
  const it = flow.value[i + 1];
  if (it.kind === 'state') return { status: it.id };
  return it.actionName ? { action: it.actionName } : null;
});

function pushNav(n: Nav) {
  if (!n) return;
  if ('status' in n) router.push({ query: { s: n.status } });
  else router.push({ query: { a: n.action } });
}

function labelForNav(n: Nav): string {
  if (!n) return '';
  if ('status' in n) {
    if (n.status === START_ID) return INITIAL_MARKER;
    if (n.status === END_ID) return '●';
    return n.status;
  }
  const human = props.standard.actions.find((a) => a.name === n.action)?.human;
  return human ?? n.action.split('::').pop() ?? 'действие';
}
</script>

<template>
  <div class="graph-row">
    <button
      type="button"
      class="graph-nav graph-nav--prev"
      :disabled="!prevItem"
      :aria-label="prevItem ? `Назад: ${labelForNav(prevItem)}` : 'Назад (нет)'"
      :title="prevItem ? `Назад: ${labelForNav(prevItem)}` : ''"
      @click="pushNav(prevItem)"
    >
      <ChevronLeft :size="20" />
    </button>

    <div ref="containerRef" class="process-graph">
      <!-- Левая колонка: панель деталей фокуса. Соседняя с канвой,
           не перекрывает её — центрирование на канве честное. -->
      <aside class="focus-panel">
        <FocusBar
          :standard="standard"
          :focus-status="focusStatus"
          :focus-action="focusAction"
          :focus-document="focusDocument"
          :focus-operation="focusOperation"
        />
      </aside>

      <!-- Правая колонка: канва VueFlow. -->
      <div ref="canvasRef" class="process-graph__canvas">
        <VueFlow
          :nodes="layout.nodes"
          :edges="layout.edges"
          :node-types="nodeTypes"
          :nodes-draggable="false"
          :nodes-connectable="false"
          :elements-selectable="false"
          :zoom-on-scroll="false"
          :zoom-on-pinch="true"
          :zoom-on-double-click="false"
          :pan-on-scroll="true"
          :pan-on-drag="true"
          :prevent-scrolling="true"
          :min-zoom="minZoom"
          :max-zoom="maxZoom"
          @pane-ready="onPaneReady"
          @node-click="onNodeClick"
          @edge-click="onEdgeClick"
        >
          <Background :pattern-color="gridColor" :gap="16" :size="1" />
          <Controls position="top-right" :show-interactive="false">
            <ControlButton
              :title="isFullscreen ? 'Свернуть из полноэкранного режима' : 'Развернуть на весь экран'"
              :aria-label="isFullscreen ? 'Свернуть' : 'Развернуть на весь экран'"
              @click="toggleFullscreen"
            >
              <Minimize2 v-if="isFullscreen" :size="14" />
              <Maximize2 v-else :size="14" />
            </ControlButton>
          </Controls>
        </VueFlow>

        <!-- Дублирующие prev/next в виде оверлеев — видны только в fullscreen,
             где внешние кнопки .graph-nav скрыты за пределами экрана. -->
        <button
          type="button"
          class="graph-nav graph-nav--floating graph-nav--floating-prev"
          :disabled="!prevItem"
          :aria-label="prevItem ? `Назад: ${labelForNav(prevItem)}` : 'Назад (нет)'"
          :title="prevItem ? `Назад: ${labelForNav(prevItem)}` : ''"
          @click="pushNav(prevItem)"
        >
          <ChevronLeft :size="20" />
        </button>
        <button
          type="button"
          class="graph-nav graph-nav--floating graph-nav--floating-next"
          :disabled="!nextItem"
          :aria-label="nextItem ? `Вперёд: ${labelForNav(nextItem)}` : 'Вперёд (нет)'"
          :title="nextItem ? `Вперёд: ${labelForNav(nextItem)}` : ''"
          @click="pushNav(nextItem)"
        >
          <ChevronRight :size="20" />
        </button>
      </div>
    </div>

    <button
      type="button"
      class="graph-nav graph-nav--next"
      :disabled="!nextItem"
      :aria-label="nextItem ? `Вперёд: ${labelForNav(nextItem)}` : 'Вперёд (нет)'"
      :title="nextItem ? `Вперёд: ${labelForNav(nextItem)}` : ''"
      @click="pushNav(nextItem)"
    >
      <ChevronRight :size="20" />
    </button>
  </div>
</template>

<style scoped>
.graph-row {
  display: flex;
  align-items: stretch;
  gap: 10px;
  width: 100%;
  height: 100%;
  min-height: 0;
  min-width: 0;
}

.graph-nav {
  flex: 0 0 44px;
  width: 44px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 80ms ease, color 80ms ease, border-color 80ms ease;
}
.graph-nav:not(:disabled):hover {
  background: var(--accent-soft);
  color: var(--accent);
  border-color: var(--accent-border);
}
.graph-nav:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.process-graph {
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: row;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg);
  overflow: hidden;
  position: relative;
}

/* Левая колонка — панель деталей фокуса. Соседняя с канвой, не наложение. */
.focus-panel {
  flex: 0 0 360px;
  max-width: 38%;
  min-width: 260px;
  border-right: 1px solid var(--border);
  background: var(--bg);
  overflow-y: auto;
  padding: 12px;
  box-sizing: border-box;
}
.focus-panel :deep(.focus-bar) {
  margin-bottom: 0;
  background: transparent;
  box-shadow: none;
  height: auto;
  flex-direction: column;
  flex-wrap: nowrap;
  gap: 14px;
}
.focus-panel :deep(.focus-bar__col) {
  flex: 0 0 auto;
  width: 100%;
}
.focus-panel :deep(.focus-bar--edge) {
  background: var(--edge-focus-soft);
}

/* Правая колонка — канва VueFlow. */
.process-graph__canvas {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  height: 100%;
  position: relative;
}

/* В полноэкранном режиме рабочая зона занимает весь экран. */
.process-graph:fullscreen {
  border: none;
  border-radius: 0;
  height: 100vh;
  width: 100vw;
}

/* Floating prev/next: пара кнопок у нижнего края канвы в fullscreen. */
.graph-nav--floating {
  display: none;
  position: absolute;
  bottom: 16px;
  height: 44px;
  z-index: 11;
  background: var(--surface);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.14);
}
.graph-nav--floating-prev { right: 68px; }
.graph-nav--floating-next { right: 16px; }
.process-graph:fullscreen .graph-nav--floating { display: flex; }

:deep(.vue-flow__edge) {
  cursor: pointer;
}
:deep(.vue-flow__edge-path) {
  stroke-width: 1.5;
}
:deep(.edge-focused .vue-flow__edge-path) {
  stroke: var(--edge-focus) !important;
  stroke-width: 2.5 !important;
}
:deep(.edge-focused .vue-flow__edge-text) {
  fill: var(--edge-focus) !important;
  font-weight: 700;
}
:deep(.edge-focused .vue-flow__edge-textbg) {
  fill: var(--edge-focus-soft) !important;
  stroke: var(--edge-focus) !important;
  stroke-width: 1.5 !important;
}
:deep(.vue-flow__edge:hover .vue-flow__edge-path) {
  stroke: var(--edge-focus);
  opacity: 0.8;
}
:deep(.vue-flow__edge-textbg) {
  fill: var(--bg);
  stroke: var(--border);
  stroke-width: 1;
}
:deep(.vue-flow__edge-text) {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
}
:deep(.vue-flow__edge),
:deep(.vue-flow__edge-textwrapper),
:deep(.vue-flow__edge-label) {
  z-index: 5 !important;
}
:deep(.vue-flow__attribution) {
  display: none;
}

/* Controls — подгонка под тему */
:deep(.vue-flow__controls) {
  box-shadow: none;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  margin: 10px;
}
:deep(.vue-flow__controls-button) {
  background: var(--bg);
  border: none;
  border-bottom: 1px solid var(--border);
  color: var(--text-muted);
  fill: currentColor;
  width: 28px;
  height: 28px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
:deep(.vue-flow__controls-button:last-child) {
  border-bottom: none;
}
:deep(.vue-flow__controls-button:hover) {
  background: var(--surface-hover);
  color: var(--text);
}
:deep(.vue-flow__controls-button svg) {
  width: 12px;
  height: 12px;
}
:deep(.vue-flow__controls-button:disabled) {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
