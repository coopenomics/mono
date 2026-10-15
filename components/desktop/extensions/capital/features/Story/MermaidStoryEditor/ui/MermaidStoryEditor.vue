<template lang="pug">
.mermaid-story-editor
  .row.q-col-gutter-md
    .col-12.col-md-6
      q-input(
        :model-value="modelValue"
        @update:model-value="onInput"
        type="textarea"
        outlined
        :readonly="readonly"
        :label="$t('capital.mermaidStoryEditor.sourceLabel')"
        :input-style="{ minHeight: `${minHeight}px`, fontFamily: 'monospace', fontSize: '13px' }"
      )
    .col-12.col-md-6
      .text-caption.text-grey-7.q-mb-xs {{ $t('capital.mermaidStoryEditor.previewLabel') }}
      ClientOnly
        template(#fallback)
          .mermaid-story-editor__fallback.flex.flex-center
            q-spinner(color="primary" size="40px")
        MermaidStoryPreview(
          :source="modelValue"
          :is-dark="isAppDark"
          :min-height="minHeight"
        )
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useQuasar } from 'quasar';
import { ClientOnly } from 'src/shared/ui';
import MermaidStoryPreview from './MermaidStoryPreview.vue';

const $q = useQuasar();
const isAppDark = computed(() => $q.dark.isActive);

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

function onInput(value: string | number | null): void {
  if (props.readonly) return;
  emit('update:modelValue', value === null || value === undefined ? '' : String(value));
}
</script>

<style lang="scss" scoped>
.mermaid-story-editor__fallback {
  min-height: 200px;
  border: 1px solid rgba(127, 127, 127, 0.22);
  border-radius: 4px;
}
</style>
