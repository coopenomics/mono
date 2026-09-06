<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { Classes } from '@coopenomics/sdk';
import { useGlobalStore } from 'src/shared/store';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { signingKeyOrAlert } from 'src/shared/lib/utils/signingKey';
import { TakeoverDialog } from 'src/widgets/Marketplace/TakeoverDialog';
import { BaseInput } from 'src/shared/ui/base';
import { FileUploader, type FileUploaderError } from 'src/shared/ui/domain';
import { fileToBase64, formatAsset2Digits } from 'src/shared/lib/utils';
import { marketplaceOrderSaleUnit } from 'src/shared/lib/consts/marketplace-units';
import {
  acceptReturnAtVisit,
  rejectReturnAtVisit,
  fetchChairmanReturnSignablePayload,
  defectCategoryLabel,
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
 *  0. Видит, ЧТО осматривает — товар, гарантийный срок, причину обращения и
 *     фото пайщика (то, что он писал/прикладывал при подаче заявления) — без
 *     этого решение принималось вслепую (см. review 2026-07-27).
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

const globalStore = useGlobalStore();

const decision = ref<Decision>(DECISION_ACCEPT);
const inspectionResult = ref<string>('');
const selectedFiles = ref<File[]>([]);
const submitting = ref(false);

watch(
  () => [props.modelValue, props.claim?.id],
  ([visible]) => {
    if (visible) {
      decision.value = DECISION_ACCEPT;
      inspectionResult.value = '';
      selectedFiles.value = [];
    }
  },
  { immediate: false },
);

function onUploadError(error: FileUploaderError): void {
  FailAlert(new Error(error.message));
}

function formatDateTime(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('ru-RU');
}

const claimQuantityLabel = computed(() => {
  if (!props.claim) return '';
  const saleUnit = marketplaceOrderSaleUnit(
    props.claim.actual_quantity,
    props.claim.unit_of_measure,
    props.claim.package_size,
  );
  return `${saleUnit.units}×${saleUnit.unitLabel}`;
});

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
  const wif =
    decision.value === DECISION_ACCEPT
      ? await signingKeyOrAlert('Не удалось получить ключ для подписи')
      : undefined;
  if (decision.value === DECISION_ACCEPT && !wif) return;

  submitting.value = true;
  try {
    const inspectionPhotos: ReturnClaimPhotoUploadInput[] = await Promise.all(
      selectedFiles.value.map(async (file) => ({
        base64: await fileToBase64(file),
        mime_type: file.type,
      })),
    );
    if (decision.value === DECISION_ACCEPT) {
      // Приём имущества требует заявление о внесении паевого взноса имуществом
      // (registry 1116) с ДВУМЯ подписями — пайщика (при подаче) и оператора
      // (со-подпись поверх того же документа). С обеими подписями контракт
      // ставит заявление на повестку совета; деньги двигаются только по его
      // решению.
      const aggregate = await fetchChairmanReturnSignablePayload(props.claim.id);
      const signer = new Classes.Document(wif!);
      const signed_statement = await signer.signDocument(aggregate.rawDocument, globalStore.username, 2, [
        aggregate.document,
      ]);
      const result = await acceptReturnAtVisit({
        claim_id: props.claim.id,
        braname: props.braname.trim(),
        inspection_result: inspectionResult.value.trim(),
        inspection_photos: inspectionPhotos.length > 0 ? inspectionPhotos : undefined,
        signed_statement,
      });
      SuccessAlert(
        result.claim.status === 'ACCEPTED_BY_COUNCIL'
          ? `Совет принял имущество: заказчику восстановлено ${formatAsset2Digits(result.claim.total_refund)} ₽.`
          : result.claim.status === 'DECLINED_BY_COUNCIL'
            ? 'Совет отказал — имущество остаётся на участке, выдайте его пайщику обратно.'
            : 'Имущество принято, заявление на повестке совета. Решение придёт само — пайщик может идти.',
      );
    } else {
      await rejectReturnAtVisit({
        claim_id: props.claim.id,
        braname: props.braname.trim(),
        inspection_result: inspectionResult.value.trim(),
        inspection_photos: inspectionPhotos.length > 0 ? inspectionPhotos : undefined,
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
  { label: 'Принять имущество и передать заявление в совет', value: DECISION_ACCEPT, color: 'positive' },
  { label: 'Не принимать (имущество остаётся у заказчика)', value: DECISION_REJECT, color: 'negative' },
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
          .text-subtitle1.q-mb-sm Что осматриваем
          .mp-return-onsite__facts
            .mp-return-onsite__fact(v-if="claim.product_name")
              .mp-return-onsite__fact-label Товар
              .mp-return-onsite__fact-value {{ claim.product_name }} · {{ claimQuantityLabel }}
            .mp-return-onsite__fact(v-if="claim.warranty_until")
              .mp-return-onsite__fact-label Гарантийный срок возврата до
              .mp-return-onsite__fact-value {{ formatDateTime(claim.warranty_until) }}
            .mp-return-onsite__fact
              .mp-return-onsite__fact-label Причина обращения пайщика
              .mp-return-onsite__fact-value {{ claim.reason_text }}
            .mp-return-onsite__fact(v-if="claim.defect_category")
              .mp-return-onsite__fact-label Категория дефекта
              .mp-return-onsite__fact-value {{ defectCategoryLabel(claim.defect_category) }}
          .row.q-mt-md.q-gutter-sm(v-if="claim.photos.length > 0")
            a.mp-return-onsite__thumb(
              v-for="(p, i) in claim.photos" :key="p.content_hash"
              :href="p.url" target="_blank" rel="noopener"
            )
              img(:src="p.url" :alt="`Фото ${i + 1}`")

      q-card(flat bordered).q-mb-md
        q-card-section
          .text-subtitle1 1. Результат осмотра
          BaseInput.q-mt-sm(
            v-model="inspectionResult"
            type="textarea"
            autogrow
            counter
            maxlength="2000"
            label="Что обнаружено при очном осмотре"
          )

      q-card(flat bordered).q-mb-md
        q-card-section
          .text-subtitle1.q-mb-sm 2. Фото очного осмотра (опционально)
          FileUploader(
            v-model="selectedFiles"
            multiple
            accept="image/jpeg,image/png,image/webp"
            :max-size="10 * 1024 * 1024"
            :max-files="10"
            title="Перетащите фото или нажмите для выбора"
            @error="onUploadError"
          )

      q-card(flat bordered).q-pa-md
        .text-subtitle1.q-mb-sm 3. Решение
        q-option-group(
          v-model="decision"
          :options="decisionOptions"
          type="radio"
        )
        .banner.banner--pos.q-mt-md(v-if="decision === DECISION_ACCEPT")
          q-icon.banner__icon(name="check_circle", size="20px")
          .banner__body Имущество принимается на участок, заявление уходит на решение совета. При согласии заказчику вернётся {{ formatAsset2Digits(claim.total_refund) }} ₽ (стоимость и членский взнос), имущество зачислится в остаток; при отказе имущество выдадите обратно.
        .banner.banner--warn.q-mt-md(v-else)
          q-icon.banner__icon(name="info", size="20px")
          .banner__body Имущество остаётся у заказчика. Движений по средствам нет.
</template>

<style scoped lang="scss">
.mp-return-onsite {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__facts {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }

  &__fact {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__fact-label {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
  }

  &__fact-value {
    font-size: var(--p-fs-body, 14px);
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__thumb {
    display: inline-block;
    width: 96px;
    height: 96px;
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-sm, 8px);
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
}
</style>
