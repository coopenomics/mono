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
  .submit-council__loading(v-if="loading")
    q-spinner(color="primary", size="42px")
    .t-muted Формируем Заявление…

  template(v-else-if="previewDoc")
    .t-muted.submit-council__intro
      | Подписав это Заявление, вы выносите на повестку совета вопрос о списании имущества со складов кооперативных участков. Совет рассматривает проект и подписывает Протокол списания.
    //- Документ — листом фиксированной ширины (как остальные документы), на
    //- мобильном во всю ширину; высоту не режем — прокручивается весь диалог.
    //- Рендер и нормализация бекенд-HTML — 1-в-1 с эталоном заявления на
    //- вступление (Registrator/SignUp/ReadStatement): класс `.statement` +
    //- :deep-стили ниже приводят разнородный HTML к канон-типографике.
    //- DocumentHtmlReader здесь НЕ годится — он форсит h1 line-height 4.5rem и
    //- DOMPurify срезает <style> документа («заявление разлетается»).
    .submit-council__sheet
      //- eslint-disable-next-line vue/no-v-html
      .statement(v-html="previewDoc.html")

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

  &__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--p-3, 12px);
    min-height: 60vh;
  }

  &__intro {
    margin-bottom: var(--p-4, 16px);
  }

  // Лист документа: ограничен по ширине и центрирован (как страница А4),
  // на узких экранах занимает всю ширину. Высоту не ограничиваем — длинный
  // документ прокручивается вместе с телом диалога, без «обрубка».
  &__sheet {
    width: 100%;
    max-width: 820px;
    margin: 0 auto;
    background: var(--p-surface);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    padding: var(--p-7, 40px);
  }
}

@media (max-width: 700px) {
  .submit-council__sheet {
    padding: var(--p-4, 16px);
  }
}

/* Нормализатор бекенд-HTML заявления — копия канон-стилей из
   Registrator/SignUp/ReadStatement.vue: приводим разнородный документ
   (inline-стили, Quasar text-h*, собственные margin'ы) к канон-типографике с
   компактным вертикальным ритмом. :deep + !important — документ приходит
   из v-html. */
.statement {
  color: var(--p-ink);
  font-size: var(--p-fs-body, 14px);
  line-height: var(--p-lh-body, 1.55);
}
.statement :deep(h1),
.statement :deep(.text-h1),
.statement :deep(.text-h2),
.statement :deep(.text-h3) {
  font-size: var(--p-fs-h3, 20px) !important;
  line-height: var(--p-lh-h3, 1.3) !important;
  letter-spacing: 0 !important;
  font-weight: 600 !important;
  color: var(--p-ink) !important;
  text-align: center !important;
  margin: var(--p-6, 24px) 0 var(--p-2, 8px) !important;
}
.statement :deep(h2),
.statement :deep(.text-h4) {
  font-size: var(--p-fs-h4, 16px) !important;
  line-height: var(--p-lh-h4, 1.4) !important;
  font-weight: 600 !important;
  color: var(--p-ink) !important;
  margin: var(--p-5, 20px) 0 var(--p-2, 8px) !important;
}
.statement :deep(h3),
.statement :deep(h4),
.statement :deep(.text-h5),
.statement :deep(.text-h6) {
  font-size: var(--p-fs-body, 14px) !important;
  line-height: var(--p-lh-body, 1.55) !important;
  font-weight: 600 !important;
  color: var(--p-ink) !important;
  margin: var(--p-4, 16px) 0 var(--p-1, 4px) !important;
}
.statement :deep(p) {
  margin: 0 0 var(--p-3, 12px) !important;
  font-size: var(--p-fs-body, 14px) !important;
  line-height: var(--p-lh-body, 1.55) !important;
  color: var(--p-ink) !important;
}
.statement :deep(p:last-child) {
  margin-bottom: 0 !important;
}
.statement :deep(.addressee),
.statement :deep(.place) {
  text-align: right;
}
.statement :deep(.addressee) {
  margin-bottom: var(--p-5, 20px);
}
.statement :deep(.title-block) {
  text-align: center;
  margin-bottom: var(--p-5, 20px);
}
.statement :deep(strong),
.statement :deep(b) {
  font-weight: 600;
  color: var(--p-ink);
}
.statement :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: var(--p-4, 16px) 0;
  font-size: var(--p-fs-body-sm, 13px);
}
.statement :deep(td),
.statement :deep(th) {
  padding: var(--p-2, 8px) var(--p-3, 12px);
  border: 1px solid var(--p-line);
  vertical-align: top;
  text-align: left;
  white-space: normal;
  overflow-wrap: break-word;
}
.statement :deep(.sign) {
  margin-top: var(--p-6, 24px);
}
</style>
