<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Classes } from '@coopenomics/sdk';
import { PrivateKey } from '@wharfkit/session';
import { useGlobalStore } from 'src/shared/store';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { TakeoverDialog } from 'src/widgets/Marketplace/TakeoverDialog';
import { BarcodeScanner } from 'src/widgets/Marketplace/BarcodeScanner';
import { CorrectionTable, type CorrectionRow } from 'src/widgets/Marketplace/CorrectionTable';
import {
  finalizeIssuance,
  getOrdererSignablePayload,
  type MarketplaceOrderIssuanceView,
} from '../api';

/**
 * Story 6.3 / FR23-FR25: full-screen takeover для финальной подписи
 * АПП-выдачи на ПВЗ.
 *
 * Поток:
 *  1. Оператор сканирует штрих-код заказа (BarcodeScanner) — verification,
 *     что выдаётся правильный заказ.
 *  2. CorrectionTable показывает «план vs факт» — оператор корректирует
 *     `actual_quantity` (равно / меньше / больше); UI считает
 *     `fact_cost = actual_quantity × unit_price` и `diff_state`.
 *  3. Backend отдаёт акт, уже подписанный председателем при открытии
 *     выдачи (signatureId=1, on-chain signiss1) — в виде агрегата
 *     (rawDocument + document с подписью председателя).
 *  4. Заказчик вводит свой приватный ключ и накладывает финальную
 *     подпись (signatureId=2) поверх подписи председателя; документ не
 *     перегенерируется. `delivery_signer` = председатель, открывший
 *     выдачу (order.chairman_account).
 *  5. Подписанный документ уходит mutation `marketplaceFinalizeIssuance`
 *     с указанием `actual_quantity` и `delivery_signer` — C++ контракт
 *     исполняет три ветки сверки в одной композитной транзакции
 *     `signiss2`: при `actual < ordered` срабатывает `o.mkt.unblk`,
 *     при `actual > ordered` — серия `o.wal.conv + o.mkt.assign +
 *     o.mkt.block` на разницу (FR23). Если средств не хватает на
 *     разницу — транзакция фейлится с человеческим сообщением (FR25 /
 *     L6 guard), backend пробрасывает его клиенту.
 */

const props = defineProps<{
  modelValue: boolean;
  order: MarketplaceOrderIssuanceView | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'finalized'): void;
}>();

const globalStore = useGlobalStore();

const STEP_SCAN = 'scan' as const;
const STEP_FACT = 'fact' as const;
const STEP_SIGN = 'sign' as const;
type Step = typeof STEP_SCAN | typeof STEP_FACT | typeof STEP_SIGN;

const step = ref<Step>(STEP_SCAN);
const scannedCode = ref<string>('');
const actualQuantity = ref<number>(0);
const ordererWif = ref<string>('');
const signing = ref(false);

const factCost = computed<string>(() => {
  if (!props.order) return '0';
  const unit = Number.parseFloat(props.order.price_per_unit);
  return (actualQuantity.value * unit).toFixed(4);
});

const diffState = computed<'equal' | 'less' | 'more'>(() => {
  if (!props.order) return 'equal';
  if (actualQuantity.value === props.order.quantity) return 'equal';
  if (actualQuantity.value < props.order.quantity) return 'less';
  return 'more';
});

const diffHint = computed<string>(() => {
  if (!props.order) return '';
  if (diffState.value === 'equal') return 'Факт совпадает с заказом — корректирующие операции не нужны.';
  if (diffState.value === 'less')
    return `Выдаётся меньше заказа — разница ${props.order.quantity - actualQuantity.value} ед. вернётся на доступный паевой пайщика операцией o.mkt.unblk.`;
  return `Выдаётся больше заказа — разница ${actualQuantity.value - props.order.quantity} ед. потребует доплаты с паевого (o.wal.conv + o.mkt.assign + o.mkt.block).`;
});

const correctionRows = computed<CorrectionRow[]>(() => {
  if (!props.order) return [];
  return [
    {
      sku: props.order.id.slice(0, 8),
      title: `Заказ ${props.order.id.slice(0, 8)}`,
      unit: 'ед.',
      expected: props.order.quantity,
      fact: actualQuantity.value,
    },
  ];
});

watch(
  () => [props.modelValue, props.order?.id],
  ([visible]) => {
    if (visible && props.order) {
      step.value = STEP_SCAN;
      scannedCode.value = '';
      actualQuantity.value = props.order.quantity;
      ordererWif.value = '';
    }
  },
  { immediate: false },
);

function onScanned(code: string): void {
  scannedCode.value = code;
  step.value = STEP_FACT;
}

function onCorrectionChange(payload: { sku: string; fact: number }): void {
  actualQuantity.value = Math.max(0, payload.fact);
}

function goToSign(): void {
  if (actualQuantity.value <= 0) {
    FailAlert(new Error('Фактическое количество должно быть больше нуля.'));
    return;
  }
  step.value = STEP_SIGN;
}

function backToFact(): void {
  step.value = STEP_FACT;
}

async function confirm(): Promise<void> {
  if (!props.order) return;
  if (step.value !== STEP_SIGN) {
    if (step.value === STEP_SCAN) {
      FailAlert(new Error('Сначала отсканируйте штрих-код заказа.'));
    } else {
      goToSign();
    }
    return;
  }

  const operatorWif = globalStore.wif?.toString();
  if (!operatorWif) {
    FailAlert(new Error('Приватный ключ оператора не найден. Войдите в кооператив.'));
    return;
  }
  if (!ordererWif.value.trim()) {
    FailAlert(new Error('Заказчик должен предоставить свой приватный ключ для подписи акта.'));
    return;
  }

  const deliverySigner = props.order.chairman_account;
  if (!deliverySigner) {
    FailAlert(new Error('Не найден председатель, открывший выдачу. Сначала откройте выдачу первой подписью.'));
    return;
  }

  signing.value = true;
  try {
    // Валидация приватного ключа заказчика — ранний фейл до запроса акта,
    // если введён мусор.
    try {
      PrivateKey.from(ordererWif.value.trim());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Некорректный приватный ключ заказчика: ${message}`);
    }

    // Backend отдаёт акт, уже подписанный председателем при открытии выдачи
    // (signatureId=1, on-chain signiss1). Заказчик накладывает финальную
    // подпись (signatureId=2) поверх — документ не перегенерируется.
    const aggregate = await getOrdererSignablePayload(props.order.id);

    const ordererSigner = new Classes.Document(ordererWif.value.trim());
    const fullSigned = await ordererSigner.signDocument(
      aggregate.rawDocument,
      props.order.orderer_account,
      2,
      [aggregate.document],
    );

    await finalizeIssuance(
      props.order.id,
      actualQuantity.value,
      deliverySigner,
      fullSigned,
    );
    SuccessAlert('Заказ выдан. Статус заказа — RECEIVED.');
    emit('finalized');
    emit('update:modelValue', false);
  } catch (e) {
    FailAlert(e, 'Не удалось завершить выдачу');
  } finally {
    signing.value = false;
  }
}

function cancel(): void {
  emit('update:modelValue', false);
}

const confirmLabel = computed(() => {
  if (step.value === STEP_SCAN) return 'Сначала отсканируйте штрих-код';
  if (step.value === STEP_FACT) return 'Перейти к подписи';
  return 'Подписать и выдать';
});

const confirmDisabled = computed(
  () => signing.value || (step.value === STEP_SIGN && (!ordererWif.value.trim() || actualQuantity.value <= 0)),
);
</script>

<template lang="pug">
TakeoverDialog(
  :model-value="modelValue"
  title="Финальная подпись акта выдачи"
  :lead-text="order ? `Заказ ${order.id.slice(0, 8)} · заказчик ${order.orderer_account}` : ''"
  :kind="diffState === 'more' ? 'warning' : 'success'"
  :confirm-label="confirmLabel"
  cancel-label="Закрыть"
  :loading="signing"
  :disable-confirm="confirmDisabled"
  @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  @confirm="confirm"
  @cancel="cancel"
)
  template(#default)
    .mp-issue-finalize
      q-stepper(
        :model-value="step"
        flat
        bordered
        animated
        active-color="primary"
        done-color="positive"
      )
        q-step(:name="STEP_SCAN" title="Штрих-код" icon="fa-solid fa-barcode" :done="step !== STEP_SCAN")
          BarcodeScanner(start-label="Сканировать штрих-код заказа" @scanned="onScanned")
          .text-caption.text-grey.q-mt-sm
            | Отсканируйте штрих-код заказа камерой или USB-сканером, чтобы сверить его с выдаваемым имуществом.

        q-step(:name="STEP_FACT" title="Сверка факта" icon="fa-solid fa-scale-balanced" :done="step === STEP_SIGN")
          .q-mb-sm Заказ {{ order?.id.slice(0, 8) }} · план {{ order?.quantity }} ед. · подтверждённый штрих-код «{{ scannedCode }}»
          CorrectionTable(:rows="correctionRows" @change="onCorrectionChange")
          q-banner.q-mt-md(rounded :class="diffState === 'more' ? 'bg-warning text-dark' : (diffState === 'less' ? 'bg-info text-white' : 'bg-positive text-white')")
            | {{ diffHint }}
          .q-mt-sm.text-grey.text-caption
            | Фактическая стоимость: {{ factCost }} ₽ (вычислено как {{ actualQuantity }} × {{ order?.price_per_unit ?? '-' }}).
          .row.justify-end.q-mt-md
            q-btn(unelevated no-caps color="primary" label="Перейти к подписи" @click="goToSign")

        q-step(:name="STEP_SIGN" title="Финальная подпись" icon="fa-solid fa-pen-nib")
          q-banner.q-mb-md(rounded class="bg-primary text-white")
            | Председатель уже подписал акт при открытии выдачи. Заказчик ставит финальную подпись своим приватным ключом поверх подписи председателя — имущество переходит к нему.
          q-input(
            v-model="ordererWif"
            outlined
            dense
            type="password"
            label="Приватный ключ заказчика (WIF)"
            hint="Заказчик вводит свой ключ на устройстве оператора либо сканирует QR. После подписи UI не сохраняет ключ."
          )
          .row.q-mt-md.q-gutter-md
            q-btn(flat no-caps label="Назад к сверке" @click="backToFact")
            q-space
</template>

<style scoped lang="scss">
.mp-issue-finalize {
  display: flex;
  flex-direction: column;
  gap: var(--mp-space-md);
}
</style>
