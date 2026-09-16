<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useSessionStore } from 'src/entities/Session';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { DigitalDocument } from 'src/shared/lib/document';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseButton, BaseDialog, BaseInput } from 'src/shared/ui/base';
import { Loader } from 'src/shared/ui/Loader';
import {
  cancelWriteoffDraft,
  createWriteoffDraft,
  getWriteoffStatementSignablePayload,
  submitWriteoffDraft,
  type MarketplaceWriteoffCandidateView,
  type MarketplaceWriteoffProposalView,
  type MarketplaceWriteoffStatementDocumentView,
} from '../api';

/**
 * Эпик 8: отправка списания скоропорта в совет — два шага в одном окне.
 *
 * Шаг первый: причина списания. Она одна на всю подборку и обязательна —
 * бэкенд её не угадывает (2026-07-29: угаданный дефолт молча уходил в
 * документы как заявленная причина). Раньше поле висело на самой странице
 * над таблицей и мозолило глаза всё время, хотя нужно один раз на отправку.
 *
 * Шаг второй: Заявление 1106 — председатель читает документ и подписывает
 * ключом. Дальше бэкенд сам выполняет propwroff + повестку совета и переводит
 * проект из черновика на повестку.
 */

const props = defineProps<{
  modelValue: boolean;
  /** Выбранные на складах позиции — из них собирается проект списания. */
  items: MarketplaceWriteoffCandidateView[];
  /** Висящий черновик прошлой попытки: снимается перед сбором нового. */
  openDraft?: MarketplaceWriteoffProposalView | null;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'submitted'): void;
}>();

const session = useSessionStore();

const reason = ref('');
const draft = ref<MarketplaceWriteoffProposalView | null>(null);
const previewDoc = ref<MarketplaceWriteoffStatementDocumentView | null>(null);
const loading = ref(false);
const submitting = ref(false);

const totalAmount = computed(() =>
  props.items.reduce((sum, c) => sum + (Number.parseFloat(c.amount) || 0), 0),
);

const reasonValid = computed(() => reason.value.trim().length > 0);

// Каждое открытие начинается с чистого листа: причина прошлой отправки к новой
// подборке отношения не имеет. Закрыли окно, не подписав, — собранный черновик
// снимаем сразу: иначе он висел бы до следующей отправки и держал позиции,
// которые председатель уже передумал списывать.
watch(
  () => props.modelValue,
  (open) => {
    if (open) return;
    const abandoned = draft.value;
    reason.value = '';
    draft.value = null;
    previewDoc.value = null;
    if (abandoned) void cancelWriteoffDraft(abandoned.id).catch(() => undefined);
  },
);

/** Шаг 1 → 2: собрать проект из выбора и показать Заявление к подписи. */
async function buildStatement(): Promise<void> {
  if (!reasonValid.value || loading.value) return;
  loading.value = true;
  try {
    // Снимаем возможный висящий черновик (от прерванной подписи или
    // крон-сервиса), чтобы собрать свежий ровно из текущего выбора — один
    // черновик за раз.
    if (props.openDraft) await cancelWriteoffDraft(props.openDraft.id);

    const created = await createWriteoffDraft({
      items: props.items.map((c) => ({
        braname: c.braname,
        asset_title: c.asset_title,
        quantity: c.quantity,
        amount: c.amount,
        reason: reason.value.trim(),
        // Агрегат партий: одна строка Заявления покрывает все партии товара.
        inventory_ids: c.inventory_ids,
      })),
    });
    draft.value = created;
    previewDoc.value = await getWriteoffStatementSignablePayload({ draft_id: created.id });
  } catch (e) {
    FailAlert(e, 'Не удалось сформировать Заявление о списании');
  } finally {
    loading.value = false;
  }
}

async function signAndSubmit(): Promise<void> {
  if (!previewDoc.value || !draft.value) return;
  submitting.value = true;
  try {
    const digital = new DigitalDocument(previewDoc.value);
    const signed = await digital.sign(session.username);
    await submitWriteoffDraft({
      draft_id: draft.value.id,
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
  :title="previewDoc ? 'Заявление о списании' : 'Отправка списания в совет'",
  :maximized="!!previewDoc",
  :size="previewDoc ? undefined : 'sm'",
  :close-on-backdrop="false",
  @update:model-value="(v) => emit('update:modelValue', v)"
)
  Loader(v-if="loading", text="Формируем Заявление…")

  //- Шаг 1: причина списания — одна на всю подборку.
  .submit-council__reason(v-else-if="!previewDoc")
    .t-muted
      | Выбрано позиций: {{ items.length }} на сумму {{ formatAsset2Digits(String(totalAmount)) }}.
      | Причина попадёт в Заявление и в протокол совета.
    BaseInput(
      v-model="reason",
      label="Причина списания",
      placeholder="Например: истёк срок годности, порча, использование",
      autofocus
    )

  template(v-else)
    .t-muted.submit-council__intro
      | Подписав это Заявление, вы выносите на повестку совета вопрос о списании имущества со складов кооперативных участков. Совет рассматривает проект и подписывает Протокол списания.
    //- Документ — листом фиксированной ширины (как остальные документы), на
    //- мобильном во всю ширину; высоту не режем — прокручивается весь диалог.
    //- Рендерим html КАК ЕСТЬ (как все канон-документы — 1106 и пр.): шаблон
    //- самодостаточен (свой <style> + инлайн-выравнивание + pre-wrap-ритм),
    //- поэтому и здесь, и в повестке совета (BaseDocument) выглядит одинаково.
    //- НИКАКОГО класса `.statement` — он тянет глобальный h1{line-height:4.5rem}
    //- из DocumentHtmlReader; и никакого нормализатора, который ломает pre-wrap.
    .submit-council__sheet
      //- eslint-disable-next-line vue/no-v-html
      .submit-council__doc(v-html="previewDoc.html")

  template(#footer)
    BaseButton(variant="secondary", @click="emit('update:modelValue', false)") Отмена
    BaseButton(
      v-if="!previewDoc",
      variant="primary",
      :disabled="!reasonValid",
      :loading="loading",
      @click="buildStatement"
    ) Далее
    BaseButton(v-else, variant="primary", :loading="submitting", @click="signAndSubmit")
      template(#icon-left)
        q-icon(name="draw", size="18px")
      | Подписать
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

  &__reason {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
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

/* Документ рендерится со СВОИМИ стилями (внутри html есть <style>), как и в
   повестке совета. Здесь только наследуем канон-цвет текста — остальное
   (выравнивание, отступы, таблица) задаёт сам шаблон документа. */
.submit-council__doc {
  color: var(--p-ink);
}
</style>
