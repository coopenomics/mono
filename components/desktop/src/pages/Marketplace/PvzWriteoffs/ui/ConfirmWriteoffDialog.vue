<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useSessionStore } from 'src/entities/Session';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { DigitalDocument } from 'src/shared/lib/document';
import { BaseButton, BaseDialog } from 'src/shared/ui/base';
import { Loader } from 'src/shared/ui/Loader';
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
BaseDialog(
  :model-value="modelValue",
  title="Подтверждение списания со склада",
  maximized,
  :close-on-backdrop="false",
  @update:model-value="(v) => emit('update:modelValue', v)"
)
  Loader(v-if="loading", text="Формируем Служебную записку…")

  template(v-else-if="previewDoc")
    .t-muted.confirm-writeoff__intro
      | Подписав эту Служебную записку, вы подтверждаете фактическое списание имущества со склада участка «{{ group?.branch_name }}». Имущество выбудет со склада и будет снято с учёта.
    //- Документ — листом фиксированной ширины (как остальные документы), высоту
    //- не режем: длинный документ прокручивается вместе с телом диалога.
    .confirm-writeoff__sheet
      //- eslint-disable-next-line vue/no-v-html
      .confirm-writeoff__doc(v-html="previewDoc.html")

  template(#footer, v-if="previewDoc")
    BaseButton(variant="secondary", @click="emit('update:modelValue', false)") Отмена
    BaseButton(variant="primary", :loading="submitting", @click="signAndConfirm")
      template(#icon-left)
        q-icon(name="task_alt", size="18px")
      | Подписать и списать
</template>

<style lang="scss" scoped>
.confirm-writeoff {
  &__intro {
    margin-bottom: var(--p-4, 16px);
  }

  // Лист документа: ограничен по ширине и центрирован (как страница А4), на
  // узких экранах — во всю ширину. Высоту НЕ ограничиваем — документ
  // прокручивается вместе с телом диалога, без обрезки.
  &__sheet {
    width: 100%;
    max-width: 820px;
    margin: 0 auto;
    background: var(--p-surface);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    padding: var(--p-7, 40px);
  }

  &__doc {
    color: var(--p-ink);
  }
}

@media (max-width: 700px) {
  .confirm-writeoff__sheet {
    padding: var(--p-4, 16px);
  }
}
</style>
