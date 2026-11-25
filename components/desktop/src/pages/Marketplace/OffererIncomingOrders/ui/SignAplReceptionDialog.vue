<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { sanitizeDocumentHtml } from 'src/shared/lib/utils';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { ensureSigningUnlocked } from 'src/shared/lib/document';
import { BaseButton, BaseChip, BaseDialog } from 'src/shared/ui/base';
import {
  ActDialogLayout,
  ActLineItem,
  ActLinesTable,
  ActSummaryCard,
  type ActLinesColumn,
} from 'src/widgets/Marketplace/ActDialogLayout';
import { useMarketplaceKUDetailsStore } from 'src/entities/MarketplaceKUDetails';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { marketplaceOrderSaleUnitLabel } from 'src/shared/lib/consts/marketplace-units';
import { useActsPreview, type ReceptionGroup } from 'src/shared/lib/marketplace';
import {
  fetchSupplierSignablePayloads,
  signReceptionGroupAsSupplier,
  type MarketplaceAplReceptionView,
} from 'src/entities/MarketplaceAplReception';
import { t } from 'src/shared/i18n';

/**
 * Первая подпись поставщика на СВОДНОЙ поставке (on-chain `signsupp`).
 *
 * Поставщик видит и подписывает доставку целиком — все акты приёмки на один КУ
 * с одним способом доставки, ожидающие его подписи. Под капотом по каждому акту
 * (и каждому Order'у внутри) отдельный документ и отдельная транзакция: цикл по
 * receptions группы, в каждом — цикл по payloads. После подписи каждый акт
 * уходит на закрывающую подпись председателя КУ.
 */

const props = defineProps<{
  modelValue: boolean;
  group: ReceptionGroup<MarketplaceAplReceptionView> | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'signed'): void;
}>();

const signing = ref(false);
const done = ref(0);
const previewHtml = ref<string>('');
const previewLoading = ref(false);
// Единый паттерн «Показать / Скрыть акты»: таблица состава прячется при показе.
const { showActs, toggleActs, resetActs } = useActsPreview(loadPreview, previewHtml);
// Каждая поставка открывается с таблицы состава, без актов от прошлой записи.
watch(() => [props.modelValue, props.group?.key], resetActs);

const VARIANT_LABEL: Record<string, string> = {
  IN_PERSON: t('marketplace.signAplReceptionDialog.variantLabelInPerson'),
  EXPEDITOR: t('marketplace.signAplReceptionDialog.variantLabelExpeditor'),
  A: t('marketplace.signAplReceptionDialog.variantLabelInPerson'),
  B: t('marketplace.signAplReceptionDialog.variantLabelExpeditor'),
};
const variantLabel = computed(() =>
  props.group ? (VARIANT_LABEL[props.group.variant] ?? props.group.variant) : '',
);

const deliveriesCount = computed(() => props.group?.receptions.length ?? 0);

function lineQuantityLabel(l: { quantity: number; unit: string; packageSize: number | null }): string {
  return marketplaceOrderSaleUnitLabel(l.quantity, l.unit, l.packageSize);
}

// Снятые оператором при приёмке позиции (факт = 0) — некондиция. Подписывая
// поставку, поставщик той же подписью подтверждает их отмену: заказчику полный
// возврат стоимости и членского взноса, поставщику без штрафа. Перечисляем по
// товару (per-Order детализация поставщику не нужна) — он видит, что снято.
const rejectedItems = computed<{ key: string; productName: string; count: number }[]>(() => {
  if (!props.group) return [];
  const map = new Map<string, { key: string; productName: string; count: number }>();
  for (const r of props.group.receptions) {
    for (const f of r.fact_quantity_per_order) {
      if ((Number(f.fact_quantity) || 0) > 0) continue;
      const key = f.product_name ?? '';
      const ex = map.get(key);
      if (ex) ex.count += 1;
      else map.set(key, { key, productName: f.product_name || t('marketplace.signAplReceptionDialog.fallbackProductTitle'), count: 1 });
    }
  }
  return [...map.values()];
});
const hasRejected = computed(() => rejectedItems.value.length > 0);
// В блоке «Принимается» нулевые строки (снятые позиции) не показываем — они
// уходят в блок «Отклоняется».
const acceptedLines = computed(() => (props.group?.lines ?? []).filter((l) => l.quantity > 0));
const hasAccepted = computed(() => acceptedLines.value.length > 0);
const confirmLabel = computed(() => (hasAccepted.value ? t('common.action.sign') : t('marketplace.signAplReceptionDialog.confirmCancelAction')));

// Человекочитаемое имя КУ-получателя + адрес вместо служебного braname —
// стор уже наполнен родительской страницей (singleton-pinia).
const kuStore = useMarketplaceKUDetailsStore();
const kuName = computed(() => {
  const b = props.group?.braname ?? '';
  const k = kuStore.details.find((d) => d.coreBraname === b);
  return k?.name || b;
});
const kuAddr = computed(() => {
  const b = props.group?.braname ?? '';
  return kuStore.details.find((d) => d.coreBraname === b)?.addressFull ?? '';
});

// Позиции поставки на общей таблице актов — со снимком товара, как в окнах
// приёмки и закрывающей подписи (слово владельца 01.11.2026: «изображение
// везде»). Снятые при приёмке позиции идут отдельным блоком ниже.
const lineColumns = computed<ActLinesColumn[]>(() => [
  { key: 'item', label: t('marketplace.signAplReceptionDialog.productColumnLabel'), wide: true },
  { key: 'quantity', label: t('marketplace.signAplReceptionDialog.qtyColumnLabel'), width: '160px', align: 'right' },
  { key: 'amount', label: t('marketplace.signAplReceptionDialog.amountColumnLabel'), width: '120px', align: 'right', strong: true },
]);

const lineRows = computed(() =>
  acceptedLines.value.map((l) => ({
    key: l.key,
    title: l.productName,
    imageUrl: l.imageUrl,
    quantity: lineQuantityLabel(l),
    amount: `${formatAsset2Digits(l.amount.toFixed(4))} ₽`,
  })),
);

/** Под именем участка — адрес и способ доставки одной строкой. */
const headMeta = computed(() => [kuAddr.value, variantLabel.value].filter(Boolean).join(' · '));

/** Факты сводки: накладные и сколько позиций снято при приёмке. */
const summaryFacts = computed(() => {
  const facts: Array<{ label: string; value: string }> = [];
  if (props.group?.ttnNumbers.length) {
    facts.push({ label: t('marketplace.signAplReceptionDialog.ttnLabel'), value: props.group.ttnNumbers.join(', ') });
  }
  if (hasRejected.value) {
    const count = rejectedItems.value.reduce((sum, r) => sum + r.count, 0);
    facts.push({ label: t('marketplace.signAplReceptionDialog.rejectedFactLabel'), value: t('marketplace.signAplReceptionDialog.itemsCountLabel', { count }) });
  }
  return facts;
});

async function loadPreview(): Promise<void> {
  if (!props.group) return;
  previewLoading.value = true;
  try {
    const parts: string[] = [];
    for (const r of props.group.receptions) {
      const payloads = await fetchSupplierSignablePayloads(r.id);
      parts.push(...payloads.map((p) => p.html));
    }
    previewHtml.value = parts.join('<hr/>');
  } catch (e) {
    FailAlert(e, t('marketplace.signAplReceptionDialog.buildActsFailedMessage'));
  } finally {
    previewLoading.value = false;
  }
}

async function confirm(): Promise<void> {
  if (!props.group || !props.group.receptions.length) return;

  // Акты подписываются параллельно — ключ отпираем один раз до старта.
  if (!(await ensureSigningUnlocked(t('marketplace.signAplReceptionDialog.supplierKeyFailedMessage')))) return;

  signing.value = true;
  done.value = 0;
  try {
    // Крипто-флоу подписи вынесен в api (signReceptionGroupAsSupplier) — единый
    // источник со столом и глобальным гейтом. Прогресс прокидываем в счётчик
    // кнопки, ошибки/успех алертим здесь.
    const { errors } = await signReceptionGroupAsSupplier(
      props.group.receptions,
      (d) => {
        done.value = d;
      },
    );

    for (const { receptionId, error } of errors) {
      FailAlert(error, t('marketplace.signAplReceptionDialog.signActFailedMessage', { receptionId: receptionId.slice(0, 8) }));
    }

    if (errors.length === 0) {
      // Поставщику число актов в партии знать не нужно — это внутренняя кухня
      // оформления (одна поставка = много актов на цепи). Для него поставка —
      // единое целое: подписал и ждёт закрывающую подпись председателя КУ.
      SuccessAlert(t('marketplace.signAplReceptionDialog.signedSuccessMessage'));
    } else {
      FailAlert(
        new Error(
          t('marketplace.error.aplSignPartial', { done: done.value, total: deliveriesCount.value, errorsCount: errors.length }),
        ),
      );
    }
    emit('signed');
    if (errors.length === 0) emit('update:modelValue', false);
  } finally {
    signing.value = false;
  }
}

function cancel(): void {
  emit('update:modelValue', false);
}
</script>

<template lang="pug">
//- Рабочая страница акта на холсте, как приёмка у оператора и закрывающая
//- подпись председателя: шапка (процесс → участок → адрес и способ), слева
//- позиции со снимками либо текст актов, справа сводка с итогом и кнопками.
BaseDialog(
  :model-value="modelValue"
  maximized
  canvas
  hide-close-button
  @update:model-value="(v: boolean) => emit('update:modelValue', v)"
)
  ActDialogLayout(
    v-if="group",
    :eyebrow="$t('marketplace.signAplReceptionDialog.dialogTitle')",
    :title="$t('marketplace.signAplReceptionDialog.deliveryToLabel', { kuName })",
    :meta="headMeta",
    :panel-title="hasAccepted ? $t('marketplace.signAplReceptionDialog.acceptingLabel') : $t('marketplace.signAplReceptionDialog.rejectedLabel')",
    closable,
    @close="cancel"
  )
    template(v-if="!showActs")
      ActLinesTable(v-if="hasAccepted", :columns="lineColumns", :rows="lineRows")
        template(#cell-item="{ row }")
          ActLineItem(:title="row.title", :image-url="row.imageUrl")

      .sign-apl__refuse(v-if="hasRejected")
        .sign-apl__section-head.sign-apl__section-head--neg(v-if="hasAccepted")
          q-icon(name="block", size="16px")
          | {{ $t('marketplace.signAplReceptionDialog.rejectedLabel') }}
        ul.sign-apl__refuse-list
          li(v-for="r in rejectedItems", :key="r.key")
            span {{ r.productName }}
            BaseChip(variant="neutral", size="sm") {{ $t('marketplace.signAplReceptionDialog.itemsCountLabel', { count: r.count }) }}
        p.sign-apl__refuse-note
          | {{ $t('marketplace.signAplReceptionDialog.rejectedHintIntro') }}
          | {{ $t('marketplace.signAplReceptionDialog.rejectedHintRefund') }}
          | {{ $t('marketplace.signAplReceptionDialog.rejectedHintNoCharge') }}

    //- Канон загрузки: скелетон, а не спиннер поверх контента.
    .sign-apl__preview(v-else)
      .sign-apl__preview-skel(v-if="previewLoading && !previewHtml")
        .skel.skel--title
        .skel.skel--text(v-for="n in 8", :key="n")
      div(v-else-if="previewHtml", v-html="sanitizeDocumentHtml(previewHtml)")

    template(#aside)
      ActSummaryCard(
        :eyebrow="$t('marketplace.signAplReceptionDialog.asideTitle')",
        :facts="summaryFacts",
        :total-label="$t('marketplace.signAplReceptionDialog.totalToAcceptLabel')",
        :total="`${formatAsset2Digits(group.totalAmount)} ₽`"
      )
        template(#actions)
          BaseButton(block, variant="primary", :loading="signing", @click="confirm")
            template(#icon-left)
              q-icon(name="draw", size="18px")
            span(v-if="signing") {{ $t('marketplace.signAplReceptionDialog.signProgressLabel', { done, total: deliveriesCount }) }}
            span(v-else) {{ confirmLabel }}
          BaseButton(block, variant="secondary", :loading="previewLoading", :disabled="!hasAccepted", @click="toggleActs")
            template(#icon-left)
              q-icon(name="description", size="18px")
            | {{ showActs ? $t('marketplace.signAplReceptionDialog.hideActsAction') : $t('marketplace.signAplReceptionDialog.showActsAction') }}
          BaseButton(block, variant="ghost", :disabled="signing", @click="cancel") {{ $t('common.action.cancel') }}
</template>

<style scoped lang="scss">
.sign-apl {
  // Текст актов на месте таблицы позиций — в той же карточке.
  &__preview {
    position: relative;
    min-height: 120px;
    max-height: 55vh;
    overflow: auto;
  }

  // Каркас документа держит высоту, пока акты загружаются.
  &__preview-skel {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
    padding: var(--p-2, 8px) 0;

    .skel--title {
      width: 46%;
      margin-bottom: var(--p-2, 8px);
    }

    .skel--text:nth-child(even) {
      width: 92%;
    }

    .skel--text:nth-child(odd) {
      width: 78%;
    }
  }

  &__section-head {
    display: flex;
    align-items: center;
    gap: var(--p-1, 4px);
    font-size: var(--p-fs-meta, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--p-ink-3);
    margin-bottom: var(--p-1, 4px);

    &--neg {
      color: var(--p-neg);

      .q-icon {
        color: var(--p-neg);
      }
    }
  }

  &__refuse {
    margin-top: var(--p-2, 8px);
    padding: var(--p-3, 12px);
    border: 1px solid var(--p-neg-soft, var(--p-line));
    border-radius: var(--p-r-md, 12px);
    background: var(--p-neg-soft);
  }

  &__refuse-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--p-1, 4px);

    li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--p-2, 8px);
      font-size: var(--p-fs-body-sm, 13px);
      color: var(--p-ink);
    }
  }

  &__refuse-note {
    margin: var(--p-2, 8px) 0 0;
    font-size: var(--p-fs-meta, 12px);
    color: var(--p-ink-2);
  }
}
</style>
