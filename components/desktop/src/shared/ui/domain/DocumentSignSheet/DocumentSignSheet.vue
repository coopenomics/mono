<template lang="pug">
//- Документ на подпись: текст занимает всю высоту от своего начала до низа
//- экрана и прокручивается внутри, кнопка подписи стоит под ним и всегда на
//- виду. Страница даёт листу высоту — сама она до низа экрана (q-page со
//- style-fn), лист растягивается на остаток.
.doc-sign
  BaseCard.doc-sign__card(:title='title', :subtitle='subtitle')
    .doc-sign__state(v-if='loading')
      q-spinner(color='primary', size='28px')
      span {{ loadingText }}
    .doc-sign__state.doc-sign__state--error(v-else-if='error')
      .banner.banner--neg
        q-icon.banner__icon(name='error', size='20px')
        .banner__body {{ errorText }}
      div
        BaseButton(variant='primary', @click='emit("retry")')
          template(#icon-left)
            q-icon(name='refresh', size='18px')
          | {{ $t('common.action.retry') }}
    .doc-sign__text(v-else-if='html')
      DocumentHtmlReader(:html='html')
  .doc-sign__foot
    BaseButton(
      variant='primary',
      size='lg',
      :loading='signing',
      :disabled='signing || loading || error || !html',
      @click='emit("sign")'
    )
      template(#icon-left)
        q-icon(name='draw', size='18px')
      | {{ signLabel }}
</template>

<script setup lang="ts">
import { BaseButton, BaseCard } from 'src/shared/ui/base';
import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader';
import type { DocumentSignSheetProps } from './DocumentSignSheet.types';

withDefaults(defineProps<DocumentSignSheetProps>(), {
  subtitle: undefined,
  html: null,
  loading: false,
  error: false,
  signing: false,
  loadingText: '',
  errorText: '',
});

const emit = defineEmits<{ sign: []; retry: [] }>();
</script>

<style scoped>
.doc-sign {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.doc-sign__card {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.doc-sign__card :deep(.base-card__body) {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.doc-sign__text {
  flex: 1 1 auto;
  /* На низком экране текст не сжимается в щель: тогда прокручивается страница. */
  min-height: 240px;
  overflow: auto;
  padding: var(--p-4);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-sm);
  color: var(--p-ink);
}

.doc-sign__state {
  display: flex;
  align-items: center;
  gap: var(--p-3);
  color: var(--p-ink-2);
}

.doc-sign__state--error {
  flex-direction: column;
  align-items: stretch;
}

.doc-sign__foot {
  position: sticky;
  bottom: 0;
  z-index: 10;
  flex: 0 0 auto;
  display: flex;
  justify-content: flex-end;
  gap: var(--p-3);
  padding: var(--p-3) 0;
  background: var(--p-canvas);
  border-top: 1px solid var(--p-line);
}
</style>
