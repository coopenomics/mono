<template lang="pug">
.bpmn-story-editor(
  ref='rootEl'
  :class='{ "bpmn-story-editor--app-dark": isAppDark }'
  :style='rootStyle'
)
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  onBeforeUnmount,
  onMounted,
  nextTick,
} from 'vue';
import { useQuasar } from 'quasar';
import { EMPTY_BPMN_STORY_XML, decodeBpmnXmlIfEscaped } from 'app/extensions/capital/shared/lib';

const $q = useQuasar();
const isAppDark = computed(() => $q.dark.isActive);

/** Отступ снизу до края вьюпорта (скроллбар / safe area) */
const VIEWPORT_BOTTOM_GAP_PX = 16;

/** Повторный замер после mount: diagram-js иногда создаёт DOM позже layout */
const LAYOUT_RETRY_DELAYS_MS = [0, 80, 200, 450] as const;

interface BpmnToolkit {
  destroy: () => void;
  importXML: (xml: string) => Promise<unknown>;
  on: (event: string, fn: () => void) => void;
  off?: (event: string, fn: () => void) => void;
  saveXML: (options: { format?: boolean }) => Promise<{ xml?: string }>;
  get?: (service: string) => unknown;
}

function notifyDiagramResize(instance: unknown): void {
  if (!instance || typeof instance !== 'object') {
    return;
  }
  const inst = instance as { get?: (name: string) => unknown };
  if (typeof inst.get !== 'function') {
    return;
  }
  try {
    const canvas = inst.get('canvas') as { resized?: () => void } | undefined;
    if (canvas && typeof canvas.resized === 'function') {
      canvas.resized();
    }
  } catch {
    /* сервис недоступен */
  }
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    readonly?: boolean;
    minHeight?: number;
  }>(),
  {
    readonly: false,
    minHeight: 400,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const rootEl = ref<HTMLElement | null>(null);
const toolkit = ref<BpmnToolkit | null>(null);
const internalXml = ref(props.modelValue || EMPTY_BPMN_STORY_XML);
let suppressXmlEmit = false;
let resizeObserver: ResizeObserver | null = null;
let layoutRetryTimers: number[] = [];
let windowResizeHandler: (() => void) | null = null;
let visualViewportHandler: (() => void) | null = null;

const rootStyle = computed(() => ({
  minHeight: `${props.minHeight}px`,
}));

function getViewportHeightPx(): number {
  if (typeof window === 'undefined') {
    return props.minHeight;
  }
  const q = $q.screen.height;
  if (typeof q === 'number' && q > 0) {
    return q;
  }
  return window.innerHeight;
}

/** Высота области диаграммы: от верхнего края редактора до низа экрана (Quasar Screen / innerHeight). */
function computeDiagramHeightPx(): number {
  const root = rootEl.value;
  if (!root || typeof window === 'undefined') {
    return props.minHeight;
  }
  const top = root.getBoundingClientRect().top;
  const vh = getViewportHeightPx();
  const raw = vh - top - VIEWPORT_BOTTOM_GAP_PX;
  return Math.max(props.minHeight, Math.floor(raw));
}

function applyExplicitHeightsAndResize(): void {
  const root = rootEl.value;
  if (!root || typeof window === 'undefined') {
    return;
  }
  const h = computeDiagramHeightPx();
  root.style.height = `${h}px`;

  const bjs = root.querySelector('.bjs-container') as HTMLElement | null;
  if (bjs) {
    bjs.style.height = `${h}px`;
    bjs.style.minHeight = `${h}px`;
  }
  const djs = root.querySelector('.djs-container.djs-parent') as HTMLElement | null;
  if (djs) {
    djs.style.height = `${h}px`;
    djs.style.minHeight = `${h}px`;
  }

  notifyDiagramResize(toolkit.value);
  requestAnimationFrame(() => {
    notifyDiagramResize(toolkit.value);
  });
}

let applyHeightsRafPending = false;
function scheduleApplyHeights(): void {
  if (applyHeightsRafPending) {
    return;
  }
  applyHeightsRafPending = true;
  requestAnimationFrame(() => {
    applyHeightsRafPending = false;
    void nextTick(() => {
      applyExplicitHeightsAndResize();
    });
  });
}

function scheduleLayoutRetries(): void {
  for (const id of layoutRetryTimers) {
    window.clearTimeout(id);
  }
  layoutRetryTimers = [];
  for (const ms of LAYOUT_RETRY_DELAYS_MS) {
    layoutRetryTimers.push(
      // timing: ui — повторная подгонка высоты холста BPMN после отрисовки.
      window.setTimeout(() => {
        scheduleApplyHeights();
      }, ms),
    );
  }
}

function teardownResizeObserver(): void {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
}

function setupResizeObserver(): void {
  teardownResizeObserver();
  const el = rootEl.value;
  if (!el || typeof ResizeObserver === 'undefined') {
    return;
  }
  resizeObserver = new ResizeObserver(() => {
    scheduleApplyHeights();
  });
  resizeObserver.observe(el);
  const parent = el.parentElement;
  if (parent) {
    resizeObserver.observe(parent);
  }
}

function setupWindowListeners(): void {
  teardownWindowListeners();
  windowResizeHandler = () => scheduleApplyHeights();
  window.addEventListener('resize', windowResizeHandler);
  const vv = window.visualViewport;
  if (vv) {
    visualViewportHandler = () => scheduleApplyHeights();
    vv.addEventListener('resize', visualViewportHandler);
    vv.addEventListener('scroll', visualViewportHandler);
  }
}

function teardownWindowListeners(): void {
  if (windowResizeHandler && typeof window !== 'undefined') {
    window.removeEventListener('resize', windowResizeHandler);
    windowResizeHandler = null;
  }
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  if (vv && visualViewportHandler) {
    vv.removeEventListener('resize', visualViewportHandler);
    vv.removeEventListener('scroll', visualViewportHandler);
    visualViewportHandler = null;
  }
}

function clearLayoutRetryTimers(): void {
  for (const id of layoutRetryTimers) {
    window.clearTimeout(id);
  }
  layoutRetryTimers = [];
}

async function afterDiagramLayout(instance: unknown): Promise<void> {
  await nextTick();
  scheduleApplyHeights();
  scheduleLayoutRetries();
  notifyDiagramResize(instance);
  requestAnimationFrame(() => notifyDiagramResize(instance));
}

async function loadStyles(): Promise<void> {
  await import('bpmn-js/dist/assets/diagram-js.css');
  await import('bpmn-js/dist/assets/bpmn-font/css/bpmn.css');
}

async function initToolkit(): Promise<void> {
  const el = rootEl.value;
  if (!el || typeof window === 'undefined') return;

  await loadStyles();

  const xml = props.modelValue?.trim() ? props.modelValue : EMPTY_BPMN_STORY_XML;
  internalXml.value = xml;

  if (props.readonly) {
    const { default: NavigatedViewer } = await import('bpmn-js/lib/NavigatedViewer');
    const viewer = new NavigatedViewer({ container: el }) as unknown as BpmnToolkit;
    toolkit.value = viewer;
    suppressXmlEmit = true;
    try {
      await viewer.importXML(xml);
    } finally {
      suppressXmlEmit = false;
    }
    setupResizeObserver();
    setupWindowListeners();
    await afterDiagramLayout(viewer);
    return;
  }

  const { default: BpmnModeler } = await import('bpmn-js/lib/Modeler');
  const modeler = new BpmnModeler({ container: el }) as unknown as BpmnToolkit;
  toolkit.value = modeler;

  const onChange = (): void => {
    if (props.readonly || suppressXmlEmit) return;
    void modeler.saveXML({ format: true }).then(({ xml: out }) => {
      if (out === undefined) return;
      if (out === internalXml.value) return;
      internalXml.value = out;
      emit('update:modelValue', out);
    });
  };

  modeler.on('commandStack.changed', onChange);
  suppressXmlEmit = true;
  try {
    await modeler.importXML(xml);
  } finally {
    suppressXmlEmit = false;
  }
  setupResizeObserver();
  setupWindowListeners();
  await afterDiagramLayout(modeler);
}

function clearInlineHeights(): void {
  const root = rootEl.value;
  if (root) {
    root.style.removeProperty('height');
    root.style.removeProperty('min-height');
  }
  const bjs = root?.querySelector('.bjs-container') as HTMLElement | null;
  if (bjs) {
    bjs.style.removeProperty('height');
    bjs.style.removeProperty('min-height');
  }
  const djs = root?.querySelector('.djs-container.djs-parent') as HTMLElement | null;
  if (djs) {
    djs.style.removeProperty('height');
    djs.style.removeProperty('min-height');
  }
}

function destroyToolkit(): void {
  clearLayoutRetryTimers();
  teardownResizeObserver();
  teardownWindowListeners();
  clearInlineHeights();
  const t = toolkit.value;
  if (t) {
    t.destroy();
    toolkit.value = null;
  }
}

// realtime: нет источника — редактор: живое перечитывание затёрло бы ввод; чужие правки ловит проверка версии при сохранении.
onMounted(() => {
  void initToolkit();
});

onBeforeUnmount(() => {
  destroyToolkit();
});

watch(
  () => props.readonly,
  async () => {
    destroyToolkit();
    await nextTick();
    void initToolkit();
  },
);

watch(
  () => props.modelValue,
  async (next) => {
    const t = toolkit.value;
    if (!t) return;
    const raw = next?.trim() ? next : EMPTY_BPMN_STORY_XML;
    const normalized = decodeBpmnXmlIfEscaped(raw);
    if (normalized === internalXml.value) return;
    internalXml.value = normalized;
    suppressXmlEmit = true;
    try {
      await t.importXML(normalized);
    } finally {
      suppressXmlEmit = false;
    }
    void afterDiagramLayout(t);
  },
);

watch(
  () => [props.minHeight, $q.screen.width, $q.screen.height] as const,
  () => {
    scheduleApplyHeights();
  },
);

watch(
  () => $q.dark.isActive,
  () => {
    scheduleApplyHeights();
  },
);
</script>

<style lang="scss" scoped>
/* bpmn-js рассчитан на светлую схему; при body--dark Quasar даёт светлый color — наследуется
   direct-editing (contenteditable) → невидимый текст на светлом холсте. */
.bpmn-story-editor {
  --bpmn-story-fg: hsl(225, 10%, 15%);

  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  box-sizing: border-box;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
  color: var(--bpmn-story-fg);
  color-scheme: light;
  isolation: isolate;

  &.bpmn-story-editor--app-dark {
    border-color: rgba(255, 255, 255, 0.14);
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.35);
  }

  :deep(.bjs-container) {
    box-sizing: border-box;
    width: 100%;
    min-height: 0;
  }

  :deep(.djs-container.djs-parent) {
    box-sizing: border-box;
    min-height: 0;
  }

  :deep([contenteditable='true']) {
    color: var(--bpmn-story-fg) !important;
    caret-color: var(--bpmn-story-fg);
  }

  :deep(textarea),
  :deep(input[type='text']),
  :deep(input[type='search']) {
    color: var(--bpmn-story-fg);
    caret-color: var(--bpmn-story-fg);
  }
}

</style>
