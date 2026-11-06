<script lang="ts" setup>
import { computed } from 'vue';

/**
 * Обложка по умолчанию — рисуется из учётного имени, пока поставщик не
 * загрузил свою. Слои холмов: каждый — сумма двух синусоид со своими
 * амплитудами, частотами и фазами, слои плотнеют книзу. Фазы, амплитуды и
 * плотность выводятся из хэша имени, поэтому у каждого поставщика обложка
 * своя, а стиль у всех один. Цвет — основной цвет платформы из токенов
 * `--p-primary*`: сменится цвет или тема — сменятся и обложки.
 */
const props = defineProps<{
  seed: string;
}>();

const WIDTH = 1200;
const HEIGHT = 200;
const LAYERS = 5;
const STEP = 12;

/** FNV-1a: имя → 32-битное число. */
function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32: детерминированный поток чисел в [0, 1). */
function makeRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const art = computed(() => {
  const seed = hash(props.seed);
  const random = makeRandom(seed);
  const layers: { d: string; opacity: number; strong: boolean }[] = [];
  for (let i = 0; i < LAYERS; i++) {
    const base = HEIGHT * (0.38 + (i / LAYERS) * 0.55);
    const amp1 = 12 + random() * 26;
    const amp2 = 4 + random() * 12;
    const freq1 = ((1.5 + random() * 1.5) * Math.PI * 2) / WIDTH;
    const freq2 = ((4 + random() * 5) * Math.PI * 2) / WIDTH;
    const phase1 = random() * Math.PI * 2;
    const phase2 = random() * Math.PI * 2;
    let d = `M0 ${HEIGHT}`;
    for (let x = 0; x <= WIDTH; x += STEP) {
      const y = base + amp1 * Math.sin(freq1 * x + phase1) + amp2 * Math.sin(freq2 * x + phase2);
      d += ` L${x} ${y.toFixed(1)}`;
    }
    d += ` L${WIDTH} ${HEIGHT} Z`;
    // Плотность растёт книзу с небольшим разбросом; нижний слой — тёмным оттенком.
    const opacity = Math.min(1, 0.12 + i * 0.16 + random() * 0.06);
    layers.push({ d, opacity, strong: i === LAYERS - 1 });
  }
  return { id: `cover-${seed.toString(36)}`, layers };
});

</script>

<template lang="pug">
svg.generated-cover(:viewBox="`0 0 ${WIDTH} ${HEIGHT}`", preserveAspectRatio="xMidYMid slice", aria-hidden="true")
  defs
    linearGradient(:id="art.id", x1="0", y1="0", x2="1", y2="1")
      stop.generated-cover__sky-start(offset="0")
      stop.generated-cover__sky-end(offset="1")
  rect(:width="WIDTH", :height="HEIGHT", :fill="`url(#${art.id})`")
  path.generated-cover__layer(
    v-for="(layer, i) in art.layers",
    :key="i",
    :class="{ 'generated-cover__layer--strong': layer.strong }",
    :d="layer.d",
    :fill-opacity="layer.opacity"
  )
</template>

<style scoped lang="scss">
// Цвета — токены платформы: обложка следует за основным цветом и темой.
.generated-cover {
  display: block;
  width: 100%;
  height: 100%;

  &__sky-start {
    stop-color: var(--p-surface);
  }

  &__sky-end {
    stop-color: var(--p-primary-soft);
  }

  &__layer {
    fill: var(--p-primary);

    &--strong {
      fill: var(--p-primary-strong);
    }
  }
}
</style>
