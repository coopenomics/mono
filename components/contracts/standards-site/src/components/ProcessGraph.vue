<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { VueFlow, type EdgeMouseEvent, type NodeMouseEvent, type VueFlowStore } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';

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
const containerRef = ref<HTMLElement | null>(null);

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
const maxZoom = 2.0;
// Во сколько раз сильнее, чем fitView (≈ 4 нажатия «+» в зум-контролах).
const START_ZOOM_BOOST = 2.0;

function doFit(): void {
  if (!vfInstance.value) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!vfInstance.value) return;
      const vf = vfInstance.value;
      // 1) Сперва fit — чтобы понять базовый zoom, при котором граф влезает.
      vf.fitView({ padding: 0.18 });
      const fittedZoom = vf.getViewport().zoom;
      const targetZoom = Math.min(fittedZoom * START_ZOOM_BOOST, maxZoom);

      // 2) Сдвигаем viewport так, чтобы круглешок-старт встал слева ~15%,
      //    по вертикали — по центру.
      const container = containerRef.value;
      const cw = container?.clientWidth ?? 800;
      const ch = container?.clientHeight ?? 600;
      const startN = vf.findNode(START_ID);
      if (startN) {
        const w = (startN.dimensions?.width ?? 48);
        const h = (startN.dimensions?.height ?? 48);
        const nx = startN.position.x + w / 2;
        const ny = startN.position.y + h / 2;
        vf.setViewport({
          x: cw * 0.32 - nx * targetZoom,
          y: ch * 0.5 - ny * targetZoom,
          zoom: targetZoom,
        });
      } else {
        // Fallback: просто увеличим текущий zoom относительно fit.
        const vp = vf.getViewport();
        vf.setViewport({ x: vp.x, y: vp.y, zoom: targetZoom });
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
  if (!nodeId || !vfInstance.value || !containerRef.value) return;
  const vf = vfInstance.value;
  const node = vf.findNode(nodeId);
  if (!node) return;
  const vp = vf.getViewport();
  const cw = containerRef.value.clientWidth;
  const ch = containerRef.value.clientHeight;
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
watch(containerRef, (el) => {
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
      <VueFlow
        :nodes="layout.nodes"
        :edges="layout.edges"
        :node-types="nodeTypes"
        :nodes-draggable="false"
        :nodes-connectable="false"
        :elements-selectable="false"
        :zoom-on-scroll="false"
        :zoom-on-pinch="false"
        :zoom-on-double-click="false"
        :pan-on-scroll="false"
        :pan-on-drag="true"
        :prevent-scrolling="false"
        :min-zoom="minZoom"
        :max-zoom="maxZoom"
        @pane-ready="onPaneReady"
        @node-click="onNodeClick"
        @edge-click="onEdgeClick"
      >
        <Background :pattern-color="gridColor" :gap="16" :size="1" />
        <Controls position="top-right" :show-interactive="false" />
      </VueFlow>

      <!-- Горизонтальная полоса деталей фокуса, прилипшая к низу рабочей области. -->
      <div class="focus-bar-slot">
        <FocusBar
          :standard="standard"
          :focus-status="focusStatus"
          :focus-action="focusAction"
          :focus-document="focusDocument"
          :focus-operation="focusOperation"
        />
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
  min-height: 520px;
  height: calc(100vh - 240px);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg);
  overflow: hidden;
  position: relative;
}

/* Полоса деталей фокуса — приклеена к низу рабочей области изнутри */
.focus-bar-slot {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 12px;
  z-index: 10;
  pointer-events: auto;
}
.focus-bar-slot :deep(.focus-bar) {
  margin-bottom: 0;
  background: var(--bg);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
  max-height: 42%;
  overflow-y: auto;
}
.focus-bar-slot :deep(.focus-bar--edge) {
  background: var(--edge-focus-soft);
}

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
