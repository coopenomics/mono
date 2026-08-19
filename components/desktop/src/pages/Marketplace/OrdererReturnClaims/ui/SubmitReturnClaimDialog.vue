<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { Classes } from '@coopenomics/sdk';
import { useGlobalStore } from 'src/shared/store';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { signingKeyOrAlert } from 'src/shared/lib/utils/signingKey';
import { BaseButton, BaseCard, BaseInput } from 'src/shared/ui/base';
import { FileUploader, type FileUploaderError } from 'src/shared/ui/domain';
import { TakeoverDialog } from 'src/widgets/Marketplace/TakeoverDialog';
import { fileToBase64 } from 'src/shared/lib/utils';
import { marketplaceOrderUnitLabel, marketplaceQuantityLabel } from 'src/shared/lib/consts/marketplace-units';
import {
  createReturnClaim,
  getReturnClaimSignablePayload,
  type ICreateReturnClaimInput,
} from '../api';

type ReturnClaimPhotoUploadInput = ICreateReturnClaimInput['photos'][number];

/**
 * Story 7.1 / FR29: full-screen takeover для подачи заявления на гарантийный
 * возврат имущества. Шаги:
 *
 *  1. Описание (reason_text, actual_quantity — не больше фактически
 *     выданного). Категория дефекта убрана из MVP: причина описывается
 *     свободным текстом, структурированную категоризацию добавим при
 *     реальной необходимости (см. review 2026-07-27).
 *  2. Загрузка фото (1-10 файлов, image/jpeg|png|webp до 10 МБ каждое) —
 *     файлы копятся как `File[]` через канон `FileUploader`; в base64 (для
 *     bucket `stol-zakazov:images` + sha256 on-chain `photos[]` submretrn)
 *     кодируются одним пакетом непосредственно перед подписью.
 *  3. Подпись заявления (registry_id=1106, MarketplaceReturnStatement):
 *     backend возвращает preview HTML + hash; пайщик подписывает
 *     приватным ключом из useGlobalStore и шлёт результат вместе с
 *     reason_text + photos.
 *
 * `request_hash` детерминирован: backend хеширует
 * `return:<order_hash>:<orderer>:<actual_quantity>`; одно и то же значение
 * становится якорным `hash` подписываемого документа и `request_hash` в
 * параметре submretrn → двусторонняя сверка backend ↔ on-chain.
 */

const props = defineProps<{
  modelValue: boolean;
  orderId: string;
  /** Фактически выданное количество (базовые единицы) — backend отклонит запрос сверх него. */
  maxQuantity: number;
  unitOfMeasure: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'submitted'): void;
}>();

const globalStore = useGlobalStore();

const STEP_DESCRIBE = 'describe' as const;
const STEP_PHOTOS = 'photos' as const;
const STEP_SIGN = 'sign' as const;
type Step = typeof STEP_DESCRIBE | typeof STEP_PHOTOS | typeof STEP_SIGN;

const step = ref<Step>(STEP_DESCRIBE);

const reasonText = ref<string>('');
const actualQuantity = ref<number | null>(null);
const selectedFiles = ref<File[]>([]);
const previewHtml = ref<string>('');
const previewLoading = ref(false);
// Документ, который реально подписывается — генерируется ОДИН раз вместе с
// preview (с полными reason_text/actual_quantity). При confirm() подписываем
// именно его — гарантия, что пайщик подписал то, что видел.
type GeneratedDocumentSnapshot = Awaited<ReturnType<typeof getReturnClaimSignablePayload>>;
const signableDocument = ref<GeneratedDocumentSnapshot | null>(null);
const submitting = ref(false);

const unitLabel = computed(() => marketplaceOrderUnitLabel(props.unitOfMeasure));
const maxQuantityLabel = computed(() =>
  marketplaceQuantityLabel(props.maxQuantity, props.unitOfMeasure),
);
const quantityError = computed(() => {
  const q = actualQuantity.value;
  if (q === null) return '';
  if (q <= 0) return 'Должно быть больше нуля.';
  if (q > props.maxQuantity) return `Нельзя больше выданного — ${maxQuantityLabel.value}.`;
  return '';
});

watch(
  () => [props.modelValue, props.orderId],
  ([visible]) => {
    if (visible) {
      step.value = STEP_DESCRIBE;
      reasonText.value = '';
      actualQuantity.value = null;
      selectedFiles.value = [];
      previewHtml.value = '';
      signableDocument.value = null;
    }
  },
  { immediate: false },
);

function onQuantityInput(value: string | number | null): void {
  actualQuantity.value = value === null || value === '' ? null : Number(value);
}

function onUploadError(error: FileUploaderError): void {
  FailAlert(new Error(error.message));
}

async function loadPreview(): Promise<void> {
  if (!props.orderId) return;
  previewLoading.value = true;
  try {
    // Генерируем и preview, и подписываемый документ одним вызовом со ВСЕМИ
    // полями (reason_text, actual_quantity). Hash документа зависит от полей —
    // если позднее их изменить, нужно загрузить заново; подписываем именно
    // сохранённый snapshot, чтобы пайщик не подписал документ, отличный от
    // показанного preview.
    const doc = await getReturnClaimSignablePayload({
      order_id: props.orderId,
      actual_quantity: actualQuantity.value ?? undefined,
      reason_text: reasonText.value,
    });
    previewHtml.value = doc.html;
    signableDocument.value = doc;
  } catch (e) {
    FailAlert(e, 'Не удалось сформировать предварительное заявление');
    step.value = STEP_PHOTOS;
  } finally {
    previewLoading.value = false;
  }
}

function goToPhotos(): void {
  if (!reasonText.value.trim()) {
    FailAlert(new Error('Опишите причину возврата.'));
    return;
  }
  if (reasonText.value.length > 2000) {
    FailAlert(new Error('Причина возврата не должна превышать 2000 символов.'));
    return;
  }
  if (quantityError.value) {
    FailAlert(new Error(quantityError.value));
    return;
  }
  step.value = STEP_PHOTOS;
}

async function goToSign(): Promise<void> {
  if (selectedFiles.value.length === 0) {
    FailAlert(new Error('Приложите хотя бы одну фотографию товара.'));
    return;
  }
  step.value = STEP_SIGN;
  await loadPreview();
}

async function confirm(): Promise<void> {
  if (step.value === STEP_DESCRIBE) {
    goToPhotos();
    return;
  }
  if (step.value === STEP_PHOTOS) {
    await goToSign();
    return;
  }
  if (!signableDocument.value) {
    FailAlert(new Error('Заявление ещё формируется, подождите.'));
    return;
  }
  const wifKey = await signingKeyOrAlert('Не удалось получить ключ для подписи');
  if (!wifKey) return;

  submitting.value = true;
  try {
    const signer = new Classes.Document(wifKey);
    const signed = await signer.signDocument(signableDocument.value, globalStore.username, 1);
    const photos: ReturnClaimPhotoUploadInput[] = await Promise.all(
      selectedFiles.value.map(async (file) => ({
        base64: await fileToBase64(file),
        mime_type: file.type,
      })),
    );

    await createReturnClaim({
      order_id: props.orderId,
      reason_text: reasonText.value,
      actual_quantity: actualQuantity.value ?? undefined,
      signed_statement: signed,
      photos,
    });

    SuccessAlert('Заявление подано. Обращение рассмотрит оператор пункта выдачи.');
    emit('submitted');
    emit('update:modelValue', false);
  } catch (e) {
    FailAlert(e, 'Не удалось подать заявление на возврат');
  } finally {
    submitting.value = false;
  }
}

function cancel(): void {
  emit('update:modelValue', false);
}

function backStep(): void {
  if (step.value === STEP_PHOTOS) step.value = STEP_DESCRIBE;
  else if (step.value === STEP_SIGN) step.value = STEP_PHOTOS;
}

const confirmLabel = computed(() => {
  if (step.value === STEP_DESCRIBE) return 'К загрузке фото';
  if (step.value === STEP_PHOTOS) return 'К подписи заявления';
  return 'Подписать и подать';
});

const confirmDisabled = computed(() => {
  if (submitting.value) return true;
  if (step.value === STEP_DESCRIBE) return !reasonText.value.trim() || !!quantityError.value;
  if (step.value === STEP_PHOTOS) return selectedFiles.value.length === 0;
  return !signableDocument.value;
});
</script>

<template lang="pug">
TakeoverDialog(
  :model-value="modelValue"
  title="Заявление на гарантийный возврат"
  kind="info"
  :confirm-label="confirmLabel"
  cancel-label="Закрыть"
  :loading="submitting"
  :disable-confirm="confirmDisabled"
  @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  @confirm="confirm"
  @cancel="cancel"
)
  template(#default)
    .mp-return-submit
      q-stepper(
        :model-value="step"
        flat bordered animated
        active-color="primary" done-color="positive"
      )
        q-step(:name="STEP_DESCRIBE" title="Описание" icon="edit" :done="step !== STEP_DESCRIBE")
          .banner.banner--info.q-mb-md
            q-icon.banner__icon(name="info", size="20px")
            .banner__body
              | Опишите, что не так с полученным товаром. Это сообщение увидит оператор пункта выдачи при удалённом рассмотрении.
          BaseInput.mp-return-submit__reason(
            v-model="reasonText"
            type="textarea"
            label="Причина возврата"
            counter
            maxlength="2000"
            autogrow
          )
          BaseInput.q-mt-md(
            :model-value="actualQuantity"
            @update:model-value="onQuantityInput"
            type="number"
            :error="quantityError"
            :label="`Возвращаемое количество, ${unitLabel} (опционально)`"
            :hint="`Если пусто — возвращается всё выданное. Максимум: ${maxQuantityLabel}.`"
          )

        q-step(:name="STEP_PHOTOS" title="Фото" icon="image" :done="step === STEP_SIGN")
          .banner.banner--info.q-mb-md
            q-icon.banner__icon(name="info", size="20px")
            .banner__body
              | Приложите от 1 до 10 фотографий товара (JPEG, PNG, WEBP, до 10 МБ каждое). Хеши файлов будут записаны в блокчейн как доказательная база.
          FileUploader(
            v-model="selectedFiles"
            multiple
            accept="image/jpeg,image/png,image/webp"
            :max-size="10 * 1024 * 1024"
            :max-files="10"
            title="Перетащите фото или нажмите для выбора"
            @error="onUploadError"
          )
          .row.q-mt-md
            BaseButton(variant="ghost" @click="backStep") Назад к описанию

        q-step(:name="STEP_SIGN" title="Подпись" icon="draw")
          BaseCard.mp-return-submit__preview-card(v-if="previewLoading")
            .mp-return-submit__loading
              q-spinner(color="primary" size="32px")
              span Формирую предварительное заявление…
          BaseCard.mp-return-submit__preview(v-else-if="previewHtml")
            div(v-html="previewHtml")
          BaseCard.mp-return-submit__preview-card(v-else)
            .t-muted Не удалось сформировать предварительный документ.
          .row.q-mt-md
            BaseButton(variant="ghost" @click="backStep") Назад к фото
</template>

<style scoped lang="scss">
.mp-return-submit {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__reason :deep(textarea) {
    min-height: 120px;
  }

  &__preview-card {
    padding: var(--p-4, 16px);
  }

  &__loading {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
    color: var(--p-ink-2);
  }

  &__preview {
    max-height: 50vh;
    overflow: auto;
  }
}
</style>
