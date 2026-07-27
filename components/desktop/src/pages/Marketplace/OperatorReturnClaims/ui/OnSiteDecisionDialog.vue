<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { TakeoverDialog } from 'src/widgets/Marketplace/TakeoverDialog';
import { fileToBase64, formatAsset2Digits } from 'src/shared/lib/utils';
import {
  acceptReturnAtVisit,
  rejectReturnAtVisit,
  type IAcceptReturnAtVisitInput,
  type MarketplaceReturnClaimView,
} from '../api';

type ReturnClaimPhotoUploadInput = NonNullable<IAcceptReturnAtVisitInput['inspection_photos']>[number];

/**
 * Story 7.3 / 7.4: full-screen takeover для очного осмотра. Открывается уже
 * ПО КОНКРЕТНОЙ заявке — председатель попадает сюда, отсканировав QR-код
 * возврата, который показывает пришедший пайщик (см. `OperatorReturnClaimsPage`
 * → `decodeReturnClaimCode`), поэтому повторно сверять личность/имущество
 * штрих-кодом здесь не нужно — заявка уже идентифицирована. Председатель:
 *  1. Записывает результат осмотра (`inspection_result`, до 2000 симв.).
 *  2. Опционально прилагает фото осмотра (до 10 файлов, до 10 МБ каждое).
 *  3. Выбирает действие: «Принять возврат» → accretrn (compensating
 *     forward `o.mkt.return + o.mkt.return2` атомарно через транзит 91);
 *     «Отказать на месте» → rejretrn.
 *
 * При приёме backend атомарно восстанавливает `w.mkt.member.available`
 * пайщика на `fact_cost` и возвращает имущество на склад участка
 * (журнал содержит обе ledger2-операции с трассировкой на claim_id).
 */

const DECISION_ACCEPT = 'accept' as const;
const DECISION_REJECT = 'reject' as const;
type Decision = typeof DECISION_ACCEPT | typeof DECISION_REJECT;

const props = defineProps<{
  modelValue: boolean;
  claim: MarketplaceReturnClaimView | null;
  braname: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'decided'): void;
}>();

const decision = ref<Decision>(DECISION_ACCEPT);
const inspectionResult = ref<string>('');
const photos = ref<ReturnClaimPhotoUploadInput[]>([]);
const submitting = ref(false);

watch(
  () => [props.modelValue, props.claim?.id],
  ([visible]) => {
    if (visible) {
      decision.value = DECISION_ACCEPT;
      inspectionResult.value = '';
      photos.value = [];
    }
  },
  { immediate: false },
);

async function onFilesPicked(files: readonly File[] | File[]): Promise<void> {
  const list = Array.from(files);
  if (photos.value.length + list.length > 10) {
    FailAlert(new Error('Не более 10 фотографий очного осмотра.'));
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

async function confirm(): Promise<void> {
  if (!props.claim) return;
  if (!inspectionResult.value.trim()) {
    FailAlert(new Error('Опишите результат очного осмотра.'));
    return;
  }
  if (!props.braname.trim()) {
    FailAlert(new Error('Не выбран кооперативный участок.'));
    return;
  }

  submitting.value = true;
  try {
    if (decision.value === DECISION_ACCEPT) {
      await acceptReturnAtVisit({
        claim_id: props.claim.id,
        braname: props.braname.trim(),
        inspection_result: inspectionResult.value.trim(),
        inspection_photos: photos.value.length > 0 ? photos.value : undefined,
      });
      SuccessAlert(
        `Возврат принят. На программный кошелёк заказчика восстановлено ${formatAsset2Digits(props.claim.fact_cost)} ₽.`,
      );
    } else {
      await rejectReturnAtVisit({
        claim_id: props.claim.id,
        braname: props.braname.trim(),
        inspection_result: inspectionResult.value.trim(),
        inspection_photos: photos.value.length > 0 ? photos.value : undefined,
      });
      SuccessAlert('Возврат отклонён на месте. Имущество остаётся у заказчика.');
    }
    emit('decided');
    emit('update:modelValue', false);
  } catch (e) {
    FailAlert(e, 'Не удалось зафиксировать решение в блокчейне');
  } finally {
    submitting.value = false;
  }
}

function cancel(): void {
  emit('update:modelValue', false);
}

const kind = computed<'success' | 'danger'>(() =>
  decision.value === DECISION_ACCEPT ? 'success' : 'danger',
);
const confirmLabel = computed(() =>
  decision.value === DECISION_ACCEPT
    ? 'Принять возврат и восстановить средства'
    : 'Отказать на месте',
);
const confirmDisabled = computed(() => submitting.value || !inspectionResult.value.trim());

const decisionOptions = [
  { label: 'Принять возврат', value: DECISION_ACCEPT, color: 'positive' },
  { label: 'Отказать на месте (имущество остаётся у заказчика)', value: DECISION_REJECT, color: 'negative' },
];
</script>

<template lang="pug">
TakeoverDialog(
  :model-value="modelValue"
  :title="claim ? `Очный осмотр по заявлению ${claim.id.slice(0, 8)}` : 'Очный осмотр'"
  :lead-text="claim ? `Заказ ${claim.order_id.slice(0, 8)} · заказчик ${claim.orderer_name || claim.orderer_account} · возврат на ${formatAsset2Digits(claim.fact_cost)} ₽` : ''"
  :kind="kind"
  :confirm-label="confirmLabel"
  cancel-label="Закрыть"
  :loading="submitting"
  :disable-confirm="confirmDisabled"
  @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  @confirm="confirm"
  @cancel="cancel"
)
  template(#default v-if="claim")
    .mp-return-onsite
      q-card(flat bordered).q-mb-md
        q-card-section
          .text-subtitle1 1. Результат осмотра
          q-input.q-mt-sm(
            v-model="inspectionResult"
            outlined
            type="textarea"
            autogrow
            counter
            maxlength="2000"
            label="Что обнаружено при очном осмотре"
          )

      q-card(flat bordered).q-mb-md
        q-card-section
          .text-subtitle1 2. Фото очного осмотра (опционально)
          q-file.q-mt-sm(
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
              color="accent"
              text-color="white"
              @remove="removePhoto(i)"
            )

      q-card(flat bordered).q-pa-md
        .text-subtitle1.q-mb-sm 3. Решение
        q-option-group(
          v-model="decision"
          :options="decisionOptions"
          type="radio"
        )
        q-banner.q-mt-md(v-if="decision === DECISION_ACCEPT" rounded class="bg-positive text-white")
          | Восстановим {{ formatAsset2Digits(claim.fact_cost) }} ₽ на программный кошелёк заказчика. Имущество вернётся на склад участка.
        q-banner.q-mt-md(v-else rounded class="bg-warning text-dark")
          | Имущество остаётся у заказчика. Движений по средствам нет.
</template>

<style scoped lang="scss">
.mp-return-onsite {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
}
</style>
