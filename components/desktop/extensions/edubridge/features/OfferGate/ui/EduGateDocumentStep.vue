<template lang="pug">
.edu-gate-step
  .text-body2.q-mb-md(v-if="description") {{ description }}
  BaseBanner.q-mb-md(v-if="notice" variant="neg")
    template(#icon)
      q-icon(name="block")
    | {{ notice }}

  CardListSkeleton(v-if="!html && !loadError" :count="1")
  BaseBanner(v-else-if="loadError" variant="neg")
    template(#icon)
      q-icon(name="error_outline")
    | {{ loadError }}
    .q-mt-sm
      BaseButton(variant="ghost" size="sm" @click="load") Попробовать снова
  template(v-else)
    //- Документ разворачивается целиком, как на подключении «Благороста»: сначала читают, потом соглашаются.
    .edu-gate-step__doc
      DocumentHtmlReader(:html="html" :sanitize="false")
    BaseCheckbox.q-mt-md(:model-value="agreed" block :disabled="busy" @update:model-value="(v) => (agreed = v)")
      | {{ agreeLabel }}
    .row.justify-end.q-mt-md
      BaseButton(variant="primary" :disabled="!agreed" :loading="busy" @click="submit") {{ actionLabel }}
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { FailAlert } from 'src/shared/api';
import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader';
import { BaseBanner, BaseButton, BaseCheckbox, CardListSkeleton } from 'src/shared/ui/base';

/**
 * Один шаг шлюза: документ целиком на странице, галочка согласия и кнопка,
 * которая подписывает ровно прочитанный экземпляр. Отдельного окна просмотра
 * нет — прочитать нужно до галочки.
 */
const props = defineProps<{
  /** Ключ шага — при смене документ формируется заново. */
  stepKey: string;
  description?: string;
  /** Предупреждение над документом, например причина отказа председателя. */
  notice?: string;
  agreeLabel: string;
  actionLabel: string;
  /** Сформировать экземпляр документа; возвращает HTML для чтения. */
  build: () => Promise<string>;
  /** Подписать сформированный экземпляр и отправить. */
  sign: () => Promise<void>;
}>();
const emit = defineEmits<{ signed: [] }>();

const html = ref('');
const loadError = ref('');
const agreed = ref(false);
const busy = ref(false);

async function load(): Promise<void> {
  html.value = '';
  loadError.value = '';
  agreed.value = false;
  try {
    html.value = await props.build();
  } catch (e) {
    loadError.value = (e as Error)?.message || 'Не удалось сформировать документ';
  }
}

async function submit(): Promise<void> {
  busy.value = true;
  try {
    await props.sign();
    emit('signed');
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

watch(() => props.stepKey, load);
onMounted(load);
</script>

<style scoped>
.edu-gate-step__doc {
  max-height: 60vh;
  overflow: auto;
  padding: var(--p-4);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface);
}
</style>
