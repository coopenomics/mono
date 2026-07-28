<template lang="pug">
.sp-timeline(
  role='group',
  :aria-label='ariaLabel'
)
  BaseButton.sp-timeline__step(
    variant='ghost',
    size='sm',
    :icon-only='true',
    type='button',
    :disabled='modelValue <= 0',
    aria-label='Шаг назад по времени',
    @click='step(-1)'
  )
    template(#icon-left)
      q-icon(name='chevron_left', size='20px')

  .sp-timeline__wheel(
    ref='wheelRef',
    tabindex='0',
    role='slider',
    :aria-valuemin='0',
    :aria-valuemax='maxIndex',
    :aria-valuenow='modelValue',
    :aria-valuetext='label',
    @pointerdown='onPointerDown',
    @keydown='onKeydown'
  )
    .sp-timeline__tip(v-if='showTip', :style='tipStyle') {{ label }}
    .sp-timeline__rail
      .sp-timeline__ticks(aria-hidden='true')
        span.sp-timeline__tick(
          v-for='(tick, i) in tickMarks',
          :key='i',
          :class='{ "sp-timeline__tick--major": tick.major }',
          :style='{ left: tick.left }'
        )
      .sp-timeline__caret(:style='caretStyle')

  BaseButton.sp-timeline__step(
    variant='ghost',
    size='sm',
    :icon-only='true',
    type='button',
    :disabled='modelValue >= maxIndex',
    aria-label='Шаг вперёд по времени',
    @click='step(1)'
  )
    template(#icon-left)
      q-icon(name='chevron_right', size='20px')
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { BaseButton } from 'src/shared/ui/base';

const props = defineProps<{
  modelValue: number;
  maxIndex: number;
  label: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: number];
}>();

const wheelRef = ref<HTMLElement | null>(null);
const showTip = ref(false);
const tipTimer = ref<ReturnType<typeof setTimeout> | null>(null);

const dragging = ref(false);
const coasting = ref(false);
const pointerId = ref<number | null>(null);
const lastX = ref(0);
const lastT = ref(0);
/** Кадров за кадр анимации (~16ms) */
const velocity = ref(0);
const coastRaf = ref<number | null>(null);
const floatIndex = ref(props.modelValue);

/** Последние сэмплы dx/dt для флика (не гасим скорость на pointerup) */
const samples: { t: number; x: number }[] = [];

const ariaLabel = 'Таймлайн суперпозиции';

const maxIndex = computed(() => Math.max(0, props.maxIndex));

const visualIndex = computed(() => {
  if (dragging.value || coasting.value) return floatIndex.value;
  return props.modelValue;
});

const progress = computed(() => {
  if (maxIndex.value <= 0) return 0;
  return Math.max(0, Math.min(1, visualIndex.value / maxIndex.value));
});

const caretStyle = computed(() => ({
  left: `${progress.value * 100}%`,
}));

const tipStyle = computed(() => ({
  left: `${progress.value * 100}%`,
}));

const tickMarks = computed(() => {
  const n = maxIndex.value;
  if (n <= 0) return [{ left: '0%', major: true }];
  const count = Math.min(n + 1, 48);
  const marks: { left: string; major: boolean }[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const major = i === 0 || i === count - 1 || i % Math.max(1, Math.round(count / 6)) === 0;
    marks.push({ left: `${t * 100}%`, major });
  }
  return marks;
});

const clampIndex = (v: number) => Math.max(0, Math.min(maxIndex.value, Math.round(v)));

const setIndex = (v: number, withTip = true) => {
  const next = clampIndex(v);
  if (next !== props.modelValue) {
    emit('update:modelValue', next);
  }
  floatIndex.value = next;
  if (withTip) revealTip();
};

const revealTip = () => {
  showTip.value = true;
  if (tipTimer.value) clearTimeout(tipTimer.value);
  tipTimer.value = setTimeout(() => {
    if (!dragging.value && !coasting.value) showTip.value = false;
  }, 900);
};

const step = (dir: number) => {
  cancelCoast();
  coasting.value = false;
  velocity.value = 0;
  setIndex(props.modelValue + dir, true);
};

const pxPerFrame = () => {
  const el = wheelRef.value;
  if (!el || maxIndex.value <= 0) return 24;
  // шире «ступень» → флик сильнее ощущается по кадрам
  return Math.max(12, el.clientWidth / Math.max(maxIndex.value, 1));
};

const cancelCoast = () => {
  if (coastRaf.value != null) {
    cancelAnimationFrame(coastRaf.value);
    coastRaf.value = null;
  }
};

const releaseVelocity = (): number => {
  const now = performance.now();
  // свежие сэмплы за ~100ms
  const recent = samples.filter((s) => now - s.t <= 100);
  if (recent.length < 2) return 0;
  const first = recent[0];
  const last = recent[recent.length - 1];
  const dt = Math.max(1, last.t - first.t);
  // если рука уже остановилась — инерции нет
  if (now - last.t > 60) return 0;
  const dx = last.x - first.x;
  // px/ms → кадров за ~16ms; знак как при драге (вправо = назад по времени)
  const framesPerMs = -dx / pxPerFrame() / dt;
  return framesPerMs * 16;
};

const startCoast = (releaseV: number) => {
  cancelCoast();
  let v = releaseV;
  // слабый толчок / остановка на месте — без инерции
  if (Math.abs(v) < 0.12) {
    coasting.value = false;
    velocity.value = 0;
    setIndex(floatIndex.value, true);
    return;
  }
  // чуть усиливаем флик, чтобы «докатывалось»
  v *= 1.35;
  const maxV = Math.max(2.5, maxIndex.value * 0.35);
  v = Math.max(-maxV, Math.min(maxV, v));
  velocity.value = v;
  coasting.value = true;
  showTip.value = true;

  const friction = 0.955;
  const minV = 0.04;

  const tick = () => {
    floatIndex.value += v;
    v *= friction;
    velocity.value = v;

    if (floatIndex.value < 0) {
      floatIndex.value = 0;
      v = 0;
    } else if (floatIndex.value > maxIndex.value) {
      floatIndex.value = maxIndex.value;
      v = 0;
    }

    const snapped = clampIndex(floatIndex.value);
    if (snapped !== props.modelValue) {
      emit('update:modelValue', snapped);
    }

    if (Math.abs(v) < minV) {
      coastRaf.value = null;
      coasting.value = false;
      velocity.value = 0;
      setIndex(floatIndex.value, true);
      return;
    }
    coastRaf.value = requestAnimationFrame(tick);
  };
  coastRaf.value = requestAnimationFrame(tick);
};

const onPointerDown = (e: PointerEvent) => {
  if (maxIndex.value <= 0) return;
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  cancelCoast();
  coasting.value = false;
  dragging.value = true;
  showTip.value = true;
  pointerId.value = e.pointerId;
  lastX.value = e.clientX;
  lastT.value = performance.now();
  velocity.value = 0;
  floatIndex.value = props.modelValue;
  samples.length = 0;
  samples.push({ t: lastT.value, x: e.clientX });
  wheelRef.value?.setPointerCapture(e.pointerId);
  wheelRef.value?.addEventListener('pointermove', onPointerMove);
  wheelRef.value?.addEventListener('pointerup', onPointerUp);
  wheelRef.value?.addEventListener('pointercancel', onPointerUp);
  e.preventDefault();
};

const onPointerMove = (e: PointerEvent) => {
  if (!dragging.value || e.pointerId !== pointerId.value) return;
  const now = performance.now();
  const dx = e.clientX - lastX.value;
  const deltaFrames = -dx / pxPerFrame();
  floatIndex.value = Math.max(0, Math.min(maxIndex.value, floatIndex.value + deltaFrames));
  lastX.value = e.clientX;
  lastT.value = now;
  samples.push({ t: now, x: e.clientX });
  while (samples.length > 12 || (samples.length > 2 && now - samples[0].t > 120)) {
    samples.shift();
  }
  const snapped = clampIndex(floatIndex.value);
  if (snapped !== props.modelValue) {
    emit('update:modelValue', snapped);
  }
};

const onPointerUp = (e: PointerEvent) => {
  if (e.pointerId !== pointerId.value) return;
  dragging.value = false;
  pointerId.value = null;
  const el = wheelRef.value;
  el?.removeEventListener('pointermove', onPointerMove);
  el?.removeEventListener('pointerup', onPointerUp);
  el?.removeEventListener('pointercancel', onPointerUp);
  try {
    el?.releasePointerCapture(e.pointerId);
  } catch {
    /* already released */
  }
  const v = releaseVelocity();
  velocity.value = v;
  startCoast(v);
};

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
    e.preventDefault();
    step(-1);
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
    e.preventDefault();
    step(1);
  } else if (e.key === 'Home') {
    e.preventDefault();
    cancelCoast();
    coasting.value = false;
    setIndex(0, true);
  } else if (e.key === 'End') {
    e.preventDefault();
    cancelCoast();
    coasting.value = false;
    setIndex(maxIndex.value, true);
  }
};

watch(
  () => props.modelValue,
  (v) => {
    if (!dragging.value && !coasting.value) {
      floatIndex.value = v;
    }
  },
);

onBeforeUnmount(() => {
  cancelCoast();
  if (tipTimer.value) clearTimeout(tipTimer.value);
  const el = wheelRef.value;
  el?.removeEventListener('pointermove', onPointerMove);
  el?.removeEventListener('pointerup', onPointerUp);
  el?.removeEventListener('pointercancel', onPointerUp);
});
</script>

<style lang="scss" scoped>
.sp-timeline {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--p-1);
  padding-right: var(--p-2);
}

.sp-timeline__step {
  flex-shrink: 0;
}

.sp-timeline__wheel {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 36px;
  display: flex;
  align-items: center;
  cursor: grab;
  touch-action: none;
  user-select: none;
  outline: none;
  border-radius: var(--p-r-sm);
  -webkit-tap-highlight-color: transparent;
}

.sp-timeline__wheel:active {
  cursor: grabbing;
}

.sp-timeline__wheel:focus-visible {
  box-shadow: 0 0 0 2px var(--p-primary-soft);
}

.sp-timeline__tip {
  position: absolute;
  bottom: calc(100% + var(--p-1));
  transform: translateX(-50%);
  z-index: 2;
  padding: var(--p-1) var(--p-2);
  border-radius: var(--p-r-sm);
  border: 1px solid var(--p-line);
  background: var(--p-surface);
  color: var(--p-ink);
  font-size: var(--p-fs-caption);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  white-space: nowrap;
  box-shadow: var(--p-shadow-pop, 0 8px 24px rgba(0, 0, 0, 0.18));
  pointer-events: none;
}

.sp-timeline__rail {
  position: relative;
  width: 100%;
  height: 28px;
  border-radius: var(--p-r-sm);
  background: var(--p-surface-2);
  border: 1px solid var(--p-line);
  overflow: hidden;
}

.sp-timeline__ticks {
  position: absolute;
  inset: 0;
}

.sp-timeline__tick {
  position: absolute;
  top: 50%;
  width: 1px;
  height: 8px;
  transform: translate(-50%, -50%);
  background: var(--p-line-2, var(--p-line));
  opacity: 0.7;
}

.sp-timeline__tick--major {
  height: 14px;
  background: var(--p-ink-3);
  opacity: 0.55;
}

.sp-timeline__caret {
  position: absolute;
  top: 50%;
  width: 2px;
  height: 18px;
  transform: translate(-50%, -50%);
  border-radius: 1px;
  background: var(--p-primary);
  box-shadow: 0 0 0 3px var(--p-primary-soft);
  pointer-events: none;
}
</style>
