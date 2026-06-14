<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useSessionStore } from 'src/entities/Session';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { DigitalDocument } from 'src/shared/lib/document';
import { BaseButton, BaseDialog } from 'src/shared/ui/base';
import {
  getWriteoffStatementSignablePayload,
  submitWriteoffDraft,
  type MarketplaceWriteoffProposalView,
  type MarketplaceWriteoffStatementDocumentView,
} from '../api';

/**
 * Эпик 8: диалог подписания Заявления о списании скоропорта (registry
 * 1106). Председатель смотрит preview-документ, подписывает приватным
 * ключом, и отправляет в backend. Backend сам выполняет propwroff +
 * soviet::createagenda(mktwroff), переводит проект из DRAFT в ON_AGENDA.
 */

const props = defineProps<{
  modelValue: boolean;
  draft: MarketplaceWriteoffProposalView;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'submitted'): void;
}>();

const session = useSessionStore();

const previewDoc = ref<MarketplaceWriteoffStatementDocumentView | null>(null);
const loading = ref(false);
const submitting = ref(false);

// immediate: диалог может смонтироваться уже открытым (modelValue=true задаётся
// одновременно с появлением draft) — без immediate watch не сработал бы и
// документ не загрузился бы (пустой экран без кнопок).
watch(
  () => props.modelValue,
  async (open) => {
    if (!open) {
      previewDoc.value = null;
      return;
    }
    loading.value = true;
    try {
      previewDoc.value = await getWriteoffStatementSignablePayload({ draft_id: props.draft.id });
    } catch (e) {
      FailAlert(e, 'Не удалось сформировать Заявление о списании');
      emit('update:modelValue', false);
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

async function signAndSubmit(): Promise<void> {
  if (!previewDoc.value) return;
  submitting.value = true;
  try {
    const digital = new DigitalDocument(previewDoc.value);
    const signed = await digital.sign(session.username);
    await submitWriteoffDraft({
      draft_id: props.draft.id,
      signed_statement: signed,
    });
    SuccessAlert('Проект отправлен в совет');
    emit('submitted');
    emit('update:modelValue', false);
  } catch (e) {
    FailAlert(e, 'Не удалось отправить проект в совет');
  } finally {
    submitting.value = false;
  }
}
</script>

<template lang="pug">
BaseDialog(
  :model-value="modelValue",
  title="Подписание Заявления о списании скоропорта",
  maximized,
  :close-on-backdrop="false",
  @update:model-value="(v) => emit('update:modelValue', v)"
)
  .submit-council(v-if="loading")
    q-spinner(size="24px")
    span.text-grey-7 Формируем Заявление…

  template(v-else-if="previewDoc")
    .t-muted.submit-council__intro
      | Подписав это Заявление, вы выносите на повестку совета вопрос о списании имущества со складов кооперативных участков. Совет рассматривает проект и подписывает Протокол списания.
    .submit-council__doc
      div(v-html="previewDoc.html")

  template(#footer, v-if="previewDoc")
    BaseButton(variant="secondary", @click="emit('update:modelValue', false)") Отмена
    BaseButton(variant="primary", :loading="submitting", @click="signAndSubmit")
      template(#icon-left)
        q-icon(name="draw", size="18px")
      | Подписать и отправить в совет
</template>

<style lang="scss" scoped>
.submit-council {
  display: flex;
  align-items: center;
  gap: var(--p-3, 12px);

  &__intro {
    margin-bottom: var(--p-4, 16px);
  }

  &__doc {
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    padding: var(--p-4, 16px);
    max-height: 60vh;
    overflow: auto;
  }
}
</style>
