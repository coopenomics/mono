<template lang="pug">
//- Один шаг подписи: документ целиком на странице, флажок согласия и кнопка,
//- которая подписывает ровно прочитанный экземпляр. Отдельного окна просмотра
//- нет — прочитать нужно до флажка. Образец — шлюз стола образования.
.doc-sign-step
  .text-body2.q-mb-md(v-if='description') {{ description }}
  BaseBanner.q-mb-md(v-if='notice', variant='neg')
    template(#icon)
      q-icon(name='block')
    | {{ notice }}

  CardListSkeleton(v-if='!content && !loadError', :count='1')
  BaseBanner(v-else-if='loadError', variant='neg')
    template(#icon)
      q-icon(name='error_outline')
    | {{ loadError }}
    .q-mt-sm(v-if='build')
      BaseButton(variant='ghost', size='sm', @click='load') {{ $t('ui.documentSignStep.retry') }}
  template(v-else)
    .doc-sign-step__doc
      DocumentHtmlReader(:html='content', profile='document')
    .q-mt-md
      slot(name='before-agree')
    BaseCheckbox.q-mt-md(:model-value='agreed', block, :disabled='busy', @update:model-value='(v) => (agreed = Boolean(v))')
      | {{ agreeLabel ?? $t('ui.documentSignStep.agreeLabel') }}
    .row.justify-end.q-gutter-sm.q-mt-md
      BaseButton(v-if='backLabel', variant='ghost', :disabled='busy', @click='emit("back")') {{ backLabel }}
      BaseButton(variant='primary', :disabled='!agreed || signDisabled', :loading='busy', @click='emit("sign")')
        | {{ actionLabel ?? $t('ui.documentSignStep.signLabel') }}
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader';
import { BaseBanner, BaseButton, BaseCheckbox, CardListSkeleton } from 'src/shared/ui/base';
import { t } from 'src/shared/i18n';
import type { DocumentSignStepProps } from './DocumentSignStep.types';

const props = defineProps<DocumentSignStepProps>();
const emit = defineEmits<{ sign: []; back: [] }>();

const content = ref(props.html ?? '');
const loadError = ref('');
const agreed = ref(false);

async function load(): Promise<void> {
  loadError.value = '';
  agreed.value = false;
  if (!props.build) {
    content.value = props.html ?? '';
    return;
  }
  content.value = '';
  try {
    content.value = await props.build();
  } catch (e) {
    loadError.value = (e as Error)?.message || t('ui.documentSignStep.buildError');
  }
}

watch(() => props.html, () => void load());
// realtime: нет источника — экземпляр документа собирается при открытии шага и подписывается прочитанным.
onMounted(load);
</script>

<style scoped lang="scss">
.doc-sign-step__doc {
  max-height: 60vh;
  overflow: auto;
  padding: var(--p-4);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface);
}
</style>
