<template lang="pug">
svg.sp-target(
  :viewBox='`0 0 ${size} ${size}`',
  role='img',
  :aria-label='ariaLabel'
)
  defs
    radialGradient(
      v-for='sector in sectors',
      :key='sector.gradientId',
      :id='gradPrefix + sector.gradientId',
      :cx='cx',
      :cy='cy',
      :r='sector.radius',
      :fx='cx',
      :fy='cy',
      gradientUnits='userSpaceOnUse'
    )
      stop(offset='0%', :stop-color='sector.stopInner')
      stop(offset='45%', :stop-color='sector.stopMid')
      stop(offset='100%', :stop-color='sector.stopOuter')
  circle.sp-target__rim(
    :cx='cx',
    :cy='cy',
    :r='maxR',
    fill='none'
  )
  path.sp-target__sector(
    v-for='sector in sectors',
    :key='sector.key',
    :d='sector.path',
    :fill='`url(#${gradPrefix}${sector.gradientId})`',
    tabindex='-1',
    @mouseenter='emit("sector-enter", sector)',
    @click.stop='emit("sector-enter", sector)'
  )
  circle.sp-target__core(
    :cx='cx',
    :cy='cy',
    :r='coreR',
    :fill='coreFill',
    tabindex='-1',
    @mouseenter='emit("core-enter")',
    @click.stop='emit("core-enter")'
  )
</template>

<script setup lang="ts">
import type { PolarSector } from '../lib/superpositionPolar';

withDefaults(
  defineProps<{
    sectors: PolarSector[];
    size?: number;
    cx?: number;
    cy?: number;
    maxR?: number;
    coreR?: number;
    coreFill?: string;
    /** Уникальный префикс id градиентов (несколько мишеней на странице). */
    gradPrefix?: string;
    ariaLabel?: string;
  }>(),
  {
    size: 320,
    cx: 160,
    cy: 160,
    maxR: 118,
    coreR: 18,
    coreFill: 'var(--p-surface)',
    gradPrefix: '',
    ariaLabel: 'Мишень суперпозиции',
  },
);

const emit = defineEmits<{
  'sector-enter': [sector: PolarSector];
  'core-enter': [];
}>();
</script>

<style lang="scss" scoped>
.sp-target {
  width: 100%;
  height: auto;
  overflow: visible;
  display: block;
  -webkit-tap-highlight-color: transparent;
}

.sp-target__rim {
  stroke: var(--p-line-2, var(--p-line));
  stroke-width: 1.25;
}

.sp-target__sector {
  stroke: var(--p-ink);
  stroke-opacity: 0.55;
  stroke-width: 1.25;
  cursor: pointer;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  transition: filter 200ms ease;

  &:hover {
    filter: brightness(1.08);
  }

  &:focus,
  &:focus-visible,
  &:active {
    outline: none;
  }
}

:global([data-theme='dark']) .sp-target__sector {
  stroke: #fff;
  stroke-opacity: 0.55;
}

.sp-target__core {
  stroke: var(--p-ink);
  stroke-opacity: 0.35;
  stroke-width: 1.25;
  cursor: pointer;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  transition: fill 400ms ease;

  &:focus,
  &:focus-visible,
  &:active {
    outline: none;
  }
}

:global([data-theme='dark']) .sp-target__core {
  stroke: #fff;
  stroke-opacity: 0.45;
}
</style>
