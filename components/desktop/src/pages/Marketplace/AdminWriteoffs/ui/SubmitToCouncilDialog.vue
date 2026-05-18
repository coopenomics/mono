<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useStore } from 'src/shared/store';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { DigitalDocument } from 'src/shared/lib/document';
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

const store = useStore() as { account: { username: string } };

const previewDoc = ref<MarketplaceWriteoffStatementDocumentView | null>(null);
const loading = ref(false);
const submitting = ref(false);

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
);

async function signAndSubmit(): Promise<void> {
  if (!previewDoc.value) return;
  submitting.value = true;
  try {
    const digital = new DigitalDocument(previewDoc.value);
    const signed = await digital.sign(store.account.username);
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
q-dialog(
  :model-value="modelValue"
  @update:model-value="(v) => emit('update:modelValue', v)"
  full-width persistent
)
  q-card
    q-card-section.row.items-center
      .text-h6 Подписание Заявления о списании скоропорта
      q-space
      q-btn(flat round icon="close" @click="emit('update:modelValue', false)")

    q-card-section(v-if="loading")
      q-spinner-tabs(indeterminate)
      .text-grey.q-ml-md Формируем Заявление…

    q-card-section(v-else-if="previewDoc")
      .text-body2.text-grey.q-mb-md
        | Подписав это Заявление, вы инициируете повестку совета о списании имущества со складов кооперативных участков. Совет рассматривает проект и подписывает Протокол списания через стандартный sov.decision flow.
      q-card(flat bordered).q-pa-md(style="max-height: 50vh; overflow: auto")
        div(v-html="previewDoc.html")

    q-card-section.row.items-center.q-gutter-sm(v-if="previewDoc")
      q-space
      q-btn(flat no-caps label="Отмена" @click="emit('update:modelValue', false)")
      q-btn(
        unelevated no-caps color="primary"
        icon="fa-solid fa-signature"
        label="Подписать и отправить в совет"
        :loading="submitting"
        @click="signAndSubmit"
      )
</template>
