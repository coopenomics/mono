<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useSessionStore } from 'src/entities/Session';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { DigitalDocument } from 'src/shared/lib/document';
import { BaseButton } from 'src/shared/ui/base';
import {
  confirmWriteoff,
  getWriteoffServiceMemoSignablePayload,
  type MarketplaceWriteoffConfirmationGroupView,
  type MarketplaceWriteoffServiceMemoDocumentView,
} from '../api';

/**
 * Эпик 8: диалог подтверждения списания председателем кооперативного участка.
 * Председатель смотрит preview Служебной записки о списании (registry 1111),
 * подписывает приватным ключом — backend выполняет confirmwroff: имущество
 * этого КУ фактически выбывает со склада.
 */
const props = defineProps<{
  modelValue: boolean;
  group: MarketplaceWriteoffConfirmationGroupView | null;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'confirmed'): void;
}>();

const session = useSessionStore();
const previewDoc = ref<MarketplaceWriteoffServiceMemoDocumentView | null>(null);
const loading = ref(false);
const submitting = ref(false);

watch(
  () => props.modelValue,
  async (open) => {
    if (!open || !props.group) {
      previewDoc.value = null;
      return;
    }
    loading.value = true;
    try {
      previewDoc.value = await getWriteoffServiceMemoSignablePayload({
        proposal_id: props.group.proposal_id,
        braname: props.group.braname,
      });
    } catch (e) {
      FailAlert(e, 'Не удалось сформировать Служебную записку о списании');
      emit('update:modelValue', false);
    } finally {
      loading.value = false;
    }
  },
);

async function signAndConfirm(): Promise<void> {
  if (!previewDoc.value || !props.group) return;
  submitting.value = true;
  try {
    const digital = new DigitalDocument(previewDoc.value);
    const signed = await digital.sign(session.username);
    await confirmWriteoff({
      proposal_id: props.group.proposal_id,
      braname: props.group.braname,
      signed_memo: signed,
    });
    SuccessAlert('Списание подтверждено — имущество выбыло со склада');
    emit('confirmed');
    emit('update:modelValue', false);
  } catch (e) {
    FailAlert(e, 'Не удалось подтвердить списание');
  } finally {
    submitting.value = false;
  }
}
</script>

<template lang="pug">
q-dialog(
  :model-value="modelValue",
  @update:model-value="(v) => emit('update:modelValue', v)",
  full-width,
  persistent
)
  q-card
    q-card-section.row.items-center
      .text-h6 Подтверждение списания со склада
      q-space
      q-btn(flat, round, icon="close", @click="emit('update:modelValue', false)")

    q-card-section(v-if="loading")
      q-spinner(size="24px")
      span.q-ml-md.text-grey-7 Формируем Служебную записку…

    q-card-section(v-else-if="previewDoc")
      .text-body2.text-grey-7.q-mb-md
        | Подписав эту Служебную записку, вы подтверждаете фактическое списание имущества со склада участка «{{ group?.branch_name }}». Имущество выбудет со склада и будет снято с учёта.
      q-card(flat, bordered).q-pa-md(style="max-height: 50vh; overflow: auto")
        div(v-html="previewDoc.html")

    q-card-section.row.items-center.q-gutter-sm(v-if="previewDoc")
      q-space
      BaseButton(variant="secondary", @click="emit('update:modelValue', false)") Отмена
      BaseButton(variant="primary", :loading="submitting", @click="signAndConfirm")
        template(#icon-left)
          q-icon(name="task_alt", size="18px")
        | Подписать и списать
</template>
