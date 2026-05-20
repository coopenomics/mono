<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { Classes, Zeus } from '@coopenomics/sdk';
import { useGlobalStore } from 'src/shared/store';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { TakeoverDialog } from 'src/widgets/Marketplace/TakeoverDialog';
import {
  createReturnClaim,
  getReturnClaimSignablePayload,
  type ICreateReturnClaimInput,
} from '../api';

type ReturnClaimPhotoUploadInput = ICreateReturnClaimInput['photos'][number];
type DefectCategory = Zeus.MarketplaceReturnClaimDefectCategory;

/**
 * Story 7.1 / FR29: full-screen takeover для подачи заявления на гарантийный
 * возврат имущества. Шаги:
 *
 *  1. Описание дефекта (reason_text, defect_category, actual_quantity).
 *  2. Загрузка фото (1-10 файлов, image/jpeg|png|webp до 10 МБ каждое) —
 *     UI кодирует содержимое в base64 и отправляет вместе с mutation,
 *     backend кладёт в bucket `stol-zakazov:images` и публикует sha256
 *     хеши on-chain параметром `photos[]` submretrn.
 *  3. Подпись заявления (registry_id=1104, MarketplaceReturnStatement):
 *     backend возвращает preview HTML + hash; пайщик подписывает
 *     приватным ключом из useGlobalStore и шлёт результат вместе с
 *     reason_text + photos.
 *
 * `request_hash` детерминирован: backend хеширует
 * `return:<order_hash>:<orderer>:<actual_quantity>`; одно и то же значение
 * становится якорным `hash` подписываемого документа и `request_hash` в
 * параметре submretrn → двусторонняя сверка backend ↔ on-chain.
 */

const DEFECT_CATEGORIES: Array<{ value: DefectCategory; label: string }> = [
  { value: Zeus.MarketplaceReturnClaimDefectCategory.BROKEN, label: 'Повреждено / сломано' },
  { value: Zeus.MarketplaceReturnClaimDefectCategory.EXPIRED, label: 'Истёк срок годности' },
  { value: Zeus.MarketplaceReturnClaimDefectCategory.NOT_AS_DESCRIBED, label: 'Не соответствует описанию' },
  { value: Zeus.MarketplaceReturnClaimDefectCategory.WRONG_ITEM, label: 'Не тот товар' },
  { value: Zeus.MarketplaceReturnClaimDefectCategory.OTHER, label: 'Другое' },
];

const props = defineProps<{
  modelValue: boolean;
  orderId: string;
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
const defectCategory = ref<DefectCategory | ''>('');
const actualQuantity = ref<number | null>(null);
const photos = ref<ReturnClaimPhotoUploadInput[]>([]);
const previewHtml = ref<string>('');
const previewLoading = ref(false);
// Документ, который реально подписывается — генерируется ОДИН раз вместе с
// preview (с полными reason_text/defect_category/actual_quantity). При confirm()
// подписываем именно его — гарантия, что пайщик подписал то, что видел.
type GeneratedDocumentSnapshot = Awaited<ReturnType<typeof getReturnClaimSignablePayload>>;
const signableDocument = ref<GeneratedDocumentSnapshot | null>(null);
const submitting = ref(false);

watch(
  () => [props.modelValue, props.orderId],
  ([visible]) => {
    if (visible) {
      step.value = STEP_DESCRIBE;
      reasonText.value = '';
      defectCategory.value = '';
      actualQuantity.value = null;
      photos.value = [];
      previewHtml.value = '';
      signableDocument.value = null;
    }
  },
  { immediate: false },
);

async function onFilesPicked(files: readonly File[] | File[]): Promise<void> {
  const list = Array.from(files);
  if (photos.value.length + list.length > 10) {
    FailAlert(new Error('Можно приложить не более 10 фотографий.'));
    return;
  }
  for (const file of list) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      FailAlert(new Error(`Файл «${file.name}»: поддерживаются JPEG, PNG, WEBP.`));
      continue;
    }
    if (file.size > 10 * 1024 * 1024) {
      FailAlert(new Error(`Файл «${file.name}»: размер превышает 10 МБ.`));
      continue;
    }
    const base64 = await fileToBase64(file);
    photos.value.push({ base64, mime_type: file.type });
  }
}

function removePhoto(index: number): void {
  photos.value.splice(index, 1);
}

async function loadPreview(): Promise<void> {
  if (!props.orderId) return;
  previewLoading.value = true;
  try {
    // Генерируем и preview, и подписываемый документ одним вызовом со ВСЕМИ
    // полями (reason_text, defect_category, actual_quantity). Hash документа
    // зависит от полей — если позднее их изменить, нужно загрузить заново;
    // подписываем именно сохранённый snapshot, чтобы пайщик не подписал
    // документ, отличный от показанного preview.
    const doc = await getReturnClaimSignablePayload({
      order_id: props.orderId,
      actual_quantity: actualQuantity.value ?? undefined,
      reason_text: reasonText.value,
      defect_category: defectCategory.value || undefined,
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
  step.value = STEP_PHOTOS;
}

async function goToSign(): Promise<void> {
  if (photos.value.length === 0) {
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
  const wifKey = globalStore.wif?.toString();
  if (!wifKey) {
    FailAlert(new Error('Приватный ключ не найден. Войдите в кооператив заново.'));
    return;
  }

  submitting.value = true;
  try {
    const signer = new Classes.Document(wifKey);
    const signed = await signer.signDocument(signableDocument.value, globalStore.username, 1);

    await createReturnClaim({
      order_id: props.orderId,
      reason_text: reasonText.value,
      defect_category: defectCategory.value || undefined,
      actual_quantity: actualQuantity.value ?? undefined,
      signed_statement: signed,
      photos: photos.value,
    });

    SuccessAlert('Заявление подано. Председатель кооперативного участка рассмотрит обращение.');
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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = reader.result;
      if (typeof value !== 'string') {
        reject(new Error('Не удалось прочитать файл'));
        return;
      }
      const commaAt = value.indexOf(',');
      resolve(commaAt === -1 ? value : value.slice(commaAt + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Ошибка чтения файла'));
    reader.readAsDataURL(file);
  });
}

const confirmLabel = computed(() => {
  if (step.value === STEP_DESCRIBE) return 'К загрузке фото';
  if (step.value === STEP_PHOTOS) return 'К подписи заявления';
  return 'Подписать и подать';
});

const confirmDisabled = computed(() => {
  if (submitting.value) return true;
  if (step.value === STEP_DESCRIBE) return !reasonText.value.trim();
  if (step.value === STEP_PHOTOS) return photos.value.length === 0;
  return !signableDocument.value;
});
</script>

<template lang="pug">
TakeoverDialog(
  :model-value="modelValue"
  title="Заявление на гарантийный возврат"
  :lead-text="`Заказ ${orderId.slice(0, 8)}`"
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
        q-step(:name="STEP_DESCRIBE" title="Описание" icon="fa-solid fa-pen" :done="step !== STEP_DESCRIBE")
          q-banner.q-mb-md(rounded class="bg-primary text-white")
            | Опишите, что не так с полученным товаром. Это сообщение увидит председатель кооперативного участка при удалённом рассмотрении.
          q-input(
            v-model="reasonText"
            outlined
            type="textarea"
            label="Причина возврата"
            counter
            maxlength="2000"
            autogrow
          )
          q-select(
            v-model="defectCategory"
            :options="DEFECT_CATEGORIES"
            label="Категория дефекта (опционально)"
            map-options
            emit-value
            option-label="label"
            option-value="value"
            outlined
            dense
            clearable
          ).q-mt-md
          q-input(
            v-model.number="actualQuantity"
            outlined
            dense
            type="number"
            min="1"
            label="Возвращаемое количество единиц (опционально)"
            hint="Если пусто — возвращается всё фактически выданное количество."
          ).q-mt-md

        q-step(:name="STEP_PHOTOS" title="Фото" icon="fa-solid fa-image" :done="step === STEP_SIGN")
          q-banner.q-mb-md(rounded class="bg-info text-white")
            | Приложите от 1 до 10 фотографий товара (JPEG, PNG, WEBP, до 10 МБ каждое). Хеши файлов будут записаны в блокчейн как доказательная база.
          q-file(
            label="Выбрать фотографии"
            outlined
            dense
            multiple
            accept="image/jpeg,image/png,image/webp"
            :model-value="null"
            @update:model-value="onFilesPicked"
          )
          .row.q-gutter-sm.q-mt-md(v-if="photos.length > 0")
            q-chip(
              v-for="(p, i) in photos" :key="i"
              :label="`Фото ${i + 1} · ${p.mime_type.replace('image/', '').toUpperCase()}`"
              removable
              color="primary"
              text-color="white"
              @remove="removePhoto(i)"
            )
          .text-grey.q-mt-md(v-else)
            | Фотографий пока нет.
          .row.q-mt-md
            q-btn(flat no-caps label="Назад к описанию" @click="backStep")

        q-step(:name="STEP_SIGN" title="Подпись" icon="fa-solid fa-pen-nib")
          q-card(v-if="previewLoading" flat bordered).q-pa-md
            q-spinner(color="primary" size="32px")
            .q-ml-md Формирую предварительное заявление…
          q-card(v-else-if="previewHtml" flat bordered).mp-return-submit__preview
            q-card-section.q-pa-md
              .text-caption.text-grey Превью заявления (registry_id=1104)
            q-separator
            q-card-section.q-pa-md
              div(v-html="previewHtml")
          q-card(v-else flat bordered).q-pa-md
            .text-negative Не удалось сформировать предварительный документ.
          .row.q-mt-md
            q-btn(flat no-caps label="Назад к фото" @click="backStep")
</template>

<style scoped lang="scss">
.mp-return-submit {
  display: flex;
  flex-direction: column;
  gap: var(--mp-space-md);

  &__preview {
    max-height: 50vh;
    overflow: auto;
  }
}
</style>
