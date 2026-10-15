<script setup lang="ts">
/**
 * Диаграмма последовательности процесса (Mermaid).
 *
 * Схема всегда растянута по ширине окна — это наименьший масштаб, мельче
 * уменьшить нельзя: лишние движения «отдалить-приблизить» не нужны. Вниз
 * схема листается обычной прокруткой.
 *
 * Управление:
 *   • прокрутка (колесо, два пальца на тачпаде) — листать схему;
 *   • щипок на тачпаде / Ctrl + колесо, кнопки «+» и «−» — увеличить место
 *     под курсором; уменьшение останавливается на ширине окна;
 *   • лупа — увеличенный фрагмент под курсором, без смены масштаба;
 *   • перетаскивание мышью — сдвиг увеличенной схемы;
 *   • щелчок по схеме — шаг под курсором.
 *
 * Связь с текстом: подпись каждого шага начинается с его номера («3. …»).
 * После отрисовки ищем такие подписи и запоминаем их высоту на схеме —
 * по ней подсвечиваем текущий шаг и находим шаг под щелчком.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useTheme } from '@/composables/useTheme';
import type { DiagramTarget } from '@/data/sequence-diagram';

// Id отрисовки mermaid общий для документа: на странице бывает две схемы.
let renderId = 0;

const props = defineProps<{
  code: string;
  anchors: Record<string, string>;
  targets: DiagramTarget[];
  active: string | null;
  follow: boolean;
  /** Прокрутить к активному шагу сразу после отрисовки. */
  focusOnRender?: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', number: string, anchor: string): void;
}>();

const { theme } = useTheme();

const viewport = ref<HTMLDivElement | null>(null);
const host = ref<HTMLDivElement | null>(null);
const error = ref<string | null>(null);
const rendering = ref(true);
const expanded = ref(false);

/** Размер схемы при масштабе 1. */
const base = ref({ w: 0, h: 0 });
const k = ref(1);
const fitK = ref(1);
const scrollX = ref(0);
const scrollY = ref(0);
const viewportW = ref(0);

/** Подпись на схеме, ведущая в описание: шаг, смена статуса, операция, документ. */
interface Mark { number: string; anchor: string; kind: DiagramTarget['kind']; y: number }
const marks = ref<Mark[]>([]);
/** Только начала шагов — для подсветки читаемого шага и прокрутки к нему. */
const stepMarks = computed(() => marks.value.filter((m) => m.kind === 'step'));
const hover = ref<{ mark: Mark; next: number } | null>(null);

interface HeadActor { label: string; x: number }
const headActors = ref<HeadActor[]>([]);
const headBottom = ref(0);
/** Высота нижнего ряда участников (зеркало верхнего). */
const footerH = computed(() => Math.max(0, headBottom.value - 12));

let renderSeq = 0;

async function render(): Promise<void> {
  const seq = ++renderSeq;
  rendering.value = true;
  error.value = null;
  const { default: mermaid } = await import('mermaid');
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: theme.value === 'dark' ? 'dark' : 'neutral',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    sequence: {
      useMaxWidth: false,
      messageFontSize: 15,
      noteFontSize: 14,
      actorFontSize: 15,
      mirrorActors: true,
      actorMargin: 70,
      boxMargin: 8,
      messageMargin: 34,
      noteMargin: 8,
      wrap: false,
    },
  });
  try {
    const { svg } = await mermaid.render(`seq-${++renderId}`, props.code);
    if (seq !== renderSeq || !host.value) return;
    host.value.innerHTML = svg;
    await nextTick();
    measure();
    fit();
    applyScale();
    await nextTick();
    if (props.focusOnRender && props.active) focusOn(props.active, false);
    else viewport.value?.scrollTo({ top: 0, left: 0 });
    buildLens();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.error('[sequence]', e, props.code);
  } finally {
    if (seq === renderSeq) rendering.value = false;
  }
}

function svgEl(): SVGSVGElement | null {
  return host.value?.querySelector('svg') ?? null;
}

/** Высоты шагов и положения участников — в координатах схемы при масштабе 1. */
function measure(): void {
  const svg = svgEl();
  if (!svg) return;
  const vb = svg.viewBox.baseVal;
  const w = vb && vb.width ? vb.width : svg.getBoundingClientRect().width;
  const h = vb && vb.height ? vb.height : svg.getBoundingClientRect().height;
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  svg.style.maxWidth = 'none';
  base.value = { w, h };

  const box = svg.getBoundingClientRect();
  const sc = box.width / w || 1;
  // Подписи сопоставляем с целями по первой строке текста. Одинаковые строки
  // (операция на двух шагах) разбираем по порядку сверху вниз.
  const queue = new Map<string, DiagramTarget[]>();
  for (const t of props.targets) {
    const list = queue.get(t.line) ?? [];
    list.push(t);
    queue.set(t.line, list);
  }
  const texts = [...svg.querySelectorAll<SVGTextElement>('text.messageText, text.noteText')]
    .map((t) => ({ text: (t.textContent ?? '').replace(/\s+/g, ' ').trim(), y: (t.getBoundingClientRect().top - box.top) / sc }))
    .sort((a, b) => a.y - b.y);
  const found: Mark[] = [];
  for (const t of texts) {
    const target = queue.get(t.text)?.shift();
    if (target) found.push({ number: target.number, anchor: target.anchor, kind: target.kind, y: t.y });
  }
  marks.value = found;

  // Верхний ряд участников — для липкой шапки.
  const actors: HeadActor[] = [];
  let bottom = 0;
  svg.querySelectorAll<SVGTextElement>('text.actor').forEach((t) => {
    const r = t.getBoundingClientRect();
    if ((r.top - box.top) / sc > 200) return;
    const label = (t.textContent ?? '').trim();
    if (!label || actors.some((a) => a.label === label)) return;
    actors.push({ label, x: (r.left - box.left + r.width / 2) / sc });
    bottom = Math.max(bottom, (r.bottom - box.top) / sc);
  });
  headActors.value = actors;
  headBottom.value = bottom + 12;
}

// ── Масштаб ─────────────────────────────────────────────────────────────────
const MAX_K = 4;

/** true — пользователь увеличивал схему; при смене ширины окна масштаб не сбрасываем. */
const scaled = ref(false);

/** Ширина окна — наименьший масштаб. Узкую схему больше чем в 1,3 раза не растягиваем. */
function fit(): void {
  const vp = viewport.value;
  if (!vp || !base.value.w) return;
  viewportW.value = vp.clientWidth;
  fitK.value = Math.min(1.3, (vp.clientWidth - 2) / base.value.w);
  if (k.value < fitK.value || !scaled.value) k.value = fitK.value;
}

function applyScale(): void {
  const svg = svgEl();
  if (!svg) return;
  svg.setAttribute('width', String(base.value.w * k.value));
  svg.setAttribute('height', String(base.value.h * k.value));
}

/** Масштаб вокруг точки (cx, cy) в координатах окна схемы. */
function zoomAt(next: number, cx: number, cy: number): void {
  const vp = viewport.value;
  if (!vp) return;
  const nk = Math.min(MAX_K, Math.max(fitK.value, next));
  if (Math.abs(nk - k.value) < 0.0005) return;
  const px = (vp.scrollLeft + cx) / k.value;
  const py = (vp.scrollTop + cy) / k.value;
  k.value = nk;
  scaled.value = nk > fitK.value + 0.001;
  applyScale();
  vp.scrollLeft = px * nk - cx;
  vp.scrollTop = py * nk - cy;
  syncScroll();
}

function zoomButton(factor: number): void {
  const vp = viewport.value;
  if (!vp) return;
  zoomAt(k.value * factor, vp.clientWidth / 2, vp.clientHeight / 3);
}

function resetZoom(): void {
  const vp = viewport.value;
  if (!vp) return;
  zoomAt(fitK.value, 0, vp.clientHeight / 3);
}

function focusOn(number: string, smooth = true): void {
  const vp = viewport.value;
  const mark = stepMarks.value.find((m) => m.number === number);
  if (!vp || !mark) return;
  vp.scrollTo({
    top: Math.max(0, mark.y * k.value - 56),
    behavior: smooth ? 'smooth' : 'auto',
  });
}

function onWheel(e: WheelEvent): void {
  const vp = viewport.value;
  if (!vp) return;
  if (!(e.ctrlKey || e.metaKey)) return; // обычная прокрутка — листаем
  e.preventDefault();
  const rect = vp.getBoundingClientRect();
  zoomAt(k.value * Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top);
}

// Safari: щипок на тачпаде приходит жестом, а не колесом с Ctrl.
let gestureStartK = 1;
function onGestureStart(e: Event): void {
  e.preventDefault();
  gestureStartK = k.value;
}
function onGestureChange(e: Event): void {
  e.preventDefault();
  const vp = viewport.value;
  const ge = e as Event & { scale: number; clientX: number; clientY: number };
  if (!vp) return;
  const rect = vp.getBoundingClientRect();
  zoomAt(gestureStartK * ge.scale, ge.clientX - rect.left, ge.clientY - rect.top);
}

// ── Перетаскивание и щелчок ─────────────────────────────────────────────────
let dragging = false;
let dragMoved = 0;
let last = { x: 0, y: 0 };

function onPointerDown(e: PointerEvent): void {
  if (e.pointerType === 'touch' || e.button !== 0) return;
  dragging = true;
  dragMoved = 0;
  last = { x: e.clientX, y: e.clientY };
}

function onPointerMove(e: PointerEvent): void {
  if (dragging && viewport.value) {
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    last = { x: e.clientX, y: e.clientY };
    dragMoved += Math.abs(dx) + Math.abs(dy);
    if (dragMoved > 5) {
      viewport.value.scrollLeft -= dx;
      viewport.value.scrollTop -= dy;
    }
  }
  moveLens(e);
  const vp = viewport.value;
  if (vp && !dragging) {
    const rect = vp.getBoundingClientRect();
    hover.value = markAt(e.clientY - rect.top + vp.scrollTop);
  }
}

function onPointerUp(e: PointerEvent): void {
  if (!dragging) return;
  dragging = false;
  if (dragMoved > 5) return;
  const vp = viewport.value;
  if (!vp) return;
  const rect = vp.getBoundingClientRect();
  if (e.clientY < rect.top || e.clientY > rect.bottom) return;
  const hit = markAt(e.clientY - rect.top + vp.scrollTop);
  if (hit) emit('select', hit.mark.number, hit.mark.anchor);
}

/** Низ последнего шага — верх нижнего ряда участников схемы. */
function lastStepBottom(): number {
  return Math.max(0, base.value.h - footerH.value);
}

/** Подпись под точкой (y — в пикселях окна схемы от верха содержимого). */
function markAt(yPx: number): { mark: Mark; next: number } | null {
  const y = yPx / k.value;
  // Только шаги: строка операции или документа принадлежит шагу над ней.
  const list = stepMarks.value;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].y - 18 <= y) {
      const next = list[i + 1]?.y ?? lastStepBottom();
      // Ниже последней подписи блока — пустое место, не цель.
      if (y > next - 18 + 4 && i === list.length - 1) return null;
      return { mark: list[i], next };
    }
  }
  return null;
}

function syncScroll(): void {
  const vp = viewport.value;
  if (!vp) return;
  scrollX.value = vp.scrollLeft;
  scrollY.value = vp.scrollTop;
}

// ── Лупа ────────────────────────────────────────────────────────────────────
const LENS_W = 420;
const LENS_H = 200;
const lensOn = ref(false);
const lensVisible = ref(false);
const lensPos = ref({ left: 0, top: 0, ix: 0, iy: 0 });
const lensHost = ref<HTMLDivElement | null>(null);
/** Лупа показывает схему в полтора раза крупнее текущего масштаба, но не мельче 1,1. */
const lensK = computed(() => Math.max(1.1, k.value * 1.5));

function buildLens(): void {
  const svg = svgEl();
  if (!svg || !lensHost.value) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  lensHost.value.replaceChildren(clone);
  sizeLens();
}

function sizeLens(): void {
  const clone = lensHost.value?.querySelector('svg');
  if (!clone) return;
  clone.setAttribute('width', String(base.value.w * lensK.value));
  clone.setAttribute('height', String(base.value.h * lensK.value));
}

function moveLens(e: PointerEvent): void {
  const vp = viewport.value;
  if (!lensOn.value || !vp || (dragging && dragMoved > 5)) {
    lensVisible.value = false;
    return;
  }
  const rect = vp.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;
  // Точка схемы под курсором при масштабе 1.
  const px = (vp.scrollLeft + cx - canvasOffset()) / k.value;
  const py = (vp.scrollTop + cy) / k.value;
  lensPos.value = {
    left: Math.min(Math.max(cx - LENS_W / 2, 4), Math.max(4, vp.clientWidth - LENS_W - 4)),
    top: cy + 28 + LENS_H > vp.clientHeight ? Math.max(4, cy - LENS_H - 28) : cy + 28,
    ix: LENS_W / 2 - px * lensK.value,
    iy: LENS_H / 2 - py * lensK.value,
  };
  lensVisible.value = true;
}

/** Узкая схема стоит по центру окна — сдвиг её левого края. */
function canvasOffset(): number {
  const free = viewportW.value - base.value.w * k.value;
  return free > 0 ? free / 2 : 0;
}

// ── Подсветка ───────────────────────────────────────────────────────────────
// Под курсором — подпись, на которую ведёт щелчок; без курсора — шаг,
// который читается в описании (только в панели рядом с текстом).
const band = computed(() => {
  if (hover.value) {
    const { mark, next } = hover.value;
    const top = mark.y - 18;
    return {
      top: top * k.value,
      height: Math.max(24, next - 18 - top) * k.value,
      width: base.value.w * k.value,
      hover: true,
      label: `шаг ${mark.number} — открыть в описании`,
    };
  }
  if (!props.active) return null;
  const list = stepMarks.value;
  const i = list.findIndex((m) => m.number === props.active);
  if (i < 0) return null;
  const top = list[i].y - 18;
  const next = list[i + 1];
  const bottom = next ? next.y - 18 : lastStepBottom() - 18;
  return {
    top: top * k.value,
    height: Math.max(28, bottom - top) * k.value,
    width: base.value.w * k.value,
    hover: false,
    label: '',
  };
});

const showHead = computed(() => scrollY.value > headBottom.value * k.value);

const canvasStyle = computed(() => ({ marginLeft: `${canvasOffset()}px` }));

function toggleExpanded(): void {
  expanded.value = !expanded.value;
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && expanded.value) toggleExpanded();
}

let resizeObs: ResizeObserver | null = null;

watch(() => [props.code, theme.value], render);
watch(
  () => props.active,
  (n) => {
    if (n && props.follow) focusOn(n);
  },
);
watch(lensK, sizeLens);

onMounted(() => {
  render();
  const vp = viewport.value;
  if (vp) {
    vp.addEventListener('wheel', onWheel, { passive: false });
    vp.addEventListener('gesturestart', onGestureStart as EventListener);
    vp.addEventListener('gesturechange', onGestureChange as EventListener);
    resizeObs = new ResizeObserver(() => {
      fit();
      applyScale();
    });
    resizeObs.observe(vp);
  }
  window.addEventListener('keydown', onKey);
  window.addEventListener('pointerup', onPointerUp);
});

onBeforeUnmount(() => {
  const vp = viewport.value;
  if (vp) {
    vp.removeEventListener('wheel', onWheel);
    vp.removeEventListener('gesturestart', onGestureStart as EventListener);
    vp.removeEventListener('gesturechange', onGestureChange as EventListener);
  }
  resizeObs?.disconnect();
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('pointerup', onPointerUp);
});

defineExpose({ focusOn });
</script>

<template>
  <div class="seq" :class="{ 'seq--expanded': expanded, 'seq--lens': lensOn }">
    <div class="seq__frame" :class="{ 'seq__frame--pan': scaled, 'seq__frame--target': !!hover }">
      <div
        ref="viewport"
        class="seq__viewport"
        @scroll="syncScroll"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerleave="lensVisible = false; hover = null"
      >
        <div class="seq__canvas" :style="canvasStyle">
          <div
            v-if="band"
            class="seq__band"
            :class="{ 'seq__band--hover': band.hover }"
            :style="{ top: `${band.top}px`, height: `${band.height}px`, width: `${band.width}px` }"
          >
            <span v-if="band.label" class="seq__band-label">{{ band.label }}</span>
          </div>
          <div ref="host" class="seq__svg" />
        </div>
      </div>

      <div v-if="showHead" class="seq__head">
        <span
          v-for="a in headActors"
          :key="a.label"
          class="seq__head-actor"
          :style="{ transform: `translateX(${canvasOffset() + a.x * k - scrollX}px) translateX(-50%)` }"
        >{{ a.label }}</span>
      </div>

      <div
        v-show="lensOn && lensVisible"
        class="seq__lens"
        :style="{ left: `${lensPos.left}px`, top: `${lensPos.top}px`, width: `${LENS_W}px`, height: `${LENS_H}px` }"
      >
        <div
          ref="lensHost"
          class="seq__lens-inner"
          :style="{ transform: `translate(${lensPos.ix}px, ${lensPos.iy}px)` }"
        />
      </div>

      <div v-if="rendering" class="seq__status">Рисую схему…</div>
      <div v-if="error" class="seq__status seq__status--error">
        Схема не построилась: {{ error }}
      </div>
    </div>

    <div class="seq__tools">
      <button
        type="button"
        title="Уменьшить (не мельче ширины окна)"
        :disabled="k <= fitK + 0.001"
        @click="zoomButton(1 / 1.25)"
      >−</button>
      <span class="seq__zoom">{{ Math.round(k * 100) }}%</span>
      <button type="button" title="Увеличить" @click="zoomButton(1.25)">+</button>
      <button type="button" title="По ширине окна" :disabled="k <= fitK + 0.001" @click="resetZoom">↔</button>
      <button
        type="button"
        class="seq__lens-btn"
        :class="{ 'seq__lens-btn--on': lensOn }"
        title="Лупа: увеличивает место под курсором"
        @click="lensOn = !lensOn"
      >лупа</button>
      <button type="button" class="seq__expand" @click="toggleExpanded">
        {{ expanded ? 'Свернуть' : 'На весь экран' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.seq {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg);
  overflow: hidden;
}
.seq--expanded {
  position: fixed;
  inset: 12px;
  z-index: 50;
  height: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
}
.seq__frame {
  position: relative;
  flex: 1;
  min-height: 0;
}
.seq__viewport {
  position: absolute;
  inset: 0;
  overflow: auto;
  cursor: default;
  user-select: none;
}
/* Рука — только когда схема увеличена и её есть куда двигать. */
.seq__frame--pan .seq__viewport { cursor: grab; }
.seq__frame--pan .seq__viewport:active { cursor: grabbing; }
.seq__frame--target .seq__viewport { cursor: pointer; }
.seq--lens .seq__viewport { cursor: zoom-in; }
.seq__canvas {
  position: relative;
  width: max-content;
}
.seq__svg {
  position: relative;
  z-index: 1;
}
.seq__svg :deep(svg) { display: block; }
.seq__band {
  position: absolute;
  left: 0;
  z-index: 0;
  background: var(--accent-soft);
  border-top: 2px solid var(--accent-border);
  border-bottom: 2px solid var(--accent-border);
  pointer-events: none;
}
.seq__band--hover {
  background: color-mix(in srgb, var(--accent-soft) 70%, transparent);
  border-top-width: 1px;
  border-bottom-width: 1px;
}
.seq__band-label {
  position: sticky;
  left: 8px;
  display: inline-block;
  margin: 2px 0 0 8px;
  padding: 1px 8px;
  border-radius: 4px;
  background: var(--accent);
  color: var(--bg);
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
}
.seq__head {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 32px;
  z-index: 3;
  overflow: hidden;
  background: color-mix(in srgb, var(--bg) 92%, transparent);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(4px);
  pointer-events: none;
}
.seq__head-actor {
  position: absolute;
  top: 6px;
  left: 0;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  padding: 0 8px;
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  background: var(--surface);
}
.seq__lens {
  position: absolute;
  z-index: 4;
  overflow: hidden;
  border: 2px solid var(--accent);
  border-radius: 10px;
  background: var(--bg);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  pointer-events: none;
}
.seq__lens-inner {
  position: absolute;
  left: 0;
  top: 0;
}
.seq__lens-inner :deep(svg) { display: block; }
.seq__status {
  position: absolute;
  inset: auto 12px 12px 12px;
  z-index: 5;
  font-size: 12px;
  color: var(--text-muted);
}
.seq__status--error { color: var(--reject); }
.seq__tools {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-top: 1px solid var(--border);
  background: var(--surface);
  font-size: 12px;
}
.seq__tools button {
  min-width: 28px;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  color: var(--text);
}
.seq__tools button:hover:not(:disabled) { background: var(--surface-hover); }
.seq__tools button:disabled { opacity: 0.4; cursor: default; }
.seq__lens-btn--on {
  background: var(--accent-soft) !important;
  border-color: var(--accent-border) !important;
  color: var(--accent) !important;
}
.seq__zoom {
  min-width: 42px;
  text-align: center;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.seq__follow {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 6px;
  color: var(--text-muted);
  cursor: pointer;
}
.seq__expand { margin-left: auto; }
</style>
