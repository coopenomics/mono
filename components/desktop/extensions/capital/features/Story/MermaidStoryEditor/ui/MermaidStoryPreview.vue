<template lang="pug">
.mermaid-story-preview
  .text-negative.text-body2.q-mb-sm(v-if="errorText") {{ errorText }}
  .mermaid-story-preview__host(
    ref="host"
    :style="{ minHeight: `${minHeight}px` }"
  )
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import debounce from 'lodash/debounce';
import { t } from '../../../../i18n';

const props = withDefaults(
  defineProps<{
    source: string;
    isDark: boolean;
    minHeight?: number;
  }>(),
  {
    minHeight: 320,
  },
);

const host = ref<HTMLElement | null>(null);
const errorText = ref<string | null>(null);

let mermaidInstance: typeof import('mermaid').default | null = null;

async function ensureMermaid(): Promise<typeof import('mermaid').default> {
  if (!mermaidInstance) {
    const mod = await import('mermaid');
    mermaidInstance = mod.default;
  }
  return mermaidInstance;
}

const runRender = async (): Promise<void> => {
  const el = host.value;
  if (!el || typeof window === 'undefined') {
    return;
  }
  errorText.value = null;
  el.innerHTML = '';
  const text = (props.source || '').trim();
  if (!text) {
    const empty = document.createElement('span');
    empty.className = 'text-grey-6 text-body2';
    empty.textContent = t('capital.mermaidStoryPreview.emptySource');
    el.appendChild(empty);
    return;
  }
  try {
    const mermaid = await ensureMermaid();
    mermaid.initialize({
      startOnLoad: false,
      theme: props.isDark ? 'dark' : 'default',
      securityLevel: 'strict',
    });
    const id = `mmd-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const { svg } = await mermaid.render(id, text);
    el.innerHTML = svg;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errorText.value = msg;
    el.innerHTML = '';
  }
};

const debouncedRender = debounce(() => {
  void runRender();
}, 300);

watch(
  () => [props.source, props.isDark] as const,
  () => {
    debouncedRender();
  },
  { immediate: true },
);

onMounted(() => {
  debouncedRender();
});

onBeforeUnmount(() => {
  debouncedRender.cancel();
});
</script>

<style lang="scss" scoped>
.mermaid-story-preview__host {
  overflow: auto;
  border: 1px solid rgba(127, 127, 127, 0.22);
  border-radius: 4px;
  padding: 12px;
  background: rgba(127, 127, 127, 0.06);
}

.mermaid-story-preview__host :deep(svg) {
  max-width: 100%;
  height: auto;
}
</style>
