<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Classes } from '@coopenomics/sdk';
import { useGlobalStore } from 'src/shared/store';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseButton, BaseChip, BaseDialog } from 'src/shared/ui/base';
import { useMarketplaceKUDetailsStore } from 'src/entities/MarketplaceKUDetails';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { marketplaceUnitShort } from 'src/shared/lib/consts/marketplace-units';
import { useActsPreview, type ReceptionGroup } from 'src/shared/lib/marketplace';
import {
  fetchSupplierSignablePayloads,
  signAsSupplier,
  type MarketplaceAplReceptionView,
  type SignedDocumentInput,
} from '../api';

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

const globalStore = useGlobalStore();
const signing = ref(false);
const done = ref(0);
const previewHtml = ref<string>('');
const previewLoading = ref(false);
// Единый паттерн «Показать / Скрыть акты»: таблица состава прячется при показе.
const { showActs, toggleActs, resetActs } = useActsPreview(loadPreview, previewHtml);
// Каждая поставка открывается с таблицы состава, без актов от прошлой записи.
watch(() => [props.modelValue, props.group?.key], resetActs);

const VARIANT_LABEL: Record<string, string> = {
  IN_PERSON: 'Очная приёмка',
  EXPEDITOR: 'Через экспедитора',
  A: 'Очная приёмка',
  B: 'Через экспедитора',
};
const variantLabel = computed(() =>
  props.group ? (VARIANT_LABEL[props.group.variant] ?? props.group.variant) : '',
);

const deliveriesCount = computed(() => props.group?.receptions.length ?? 0);

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
    FailAlert(e, 'Не удалось сформировать акты приёмки');
  } finally {
    previewLoading.value = false;
  }
}

async function confirm(): Promise<void> {
  if (!props.group || !props.group.receptions.length) return;

  const wif = globalStore.wif?.toString();
  if (!wif) {
    FailAlert(new Error('Приватный ключ поставщика не найден. Войдите в кооператив.'));
    return;
  }

  signing.value = true;
  done.value = 0;
  const signer = new Classes.Document(wif);
  let failed = 0;
  try {
    // По каждому акту группы — отдельная подпись и отдельная транзакция. Идём
    // последовательно: ошибка по одному не теряет уже подписанные.
    for (const r of props.group.receptions) {
      try {
        const payloads = await fetchSupplierSignablePayloads(r.id);
        if (payloads.length === 0) {
          throw new Error('Backend не вернул ни одного акта для подписи.');
        }
        const signed_documents: SignedDocumentInput[] = [];
        for (const payload of payloads) {
          const signed = await signer.signDocument(payload, r.offerer_account, 1);
          signed_documents.push(signed);
        }
        await signAsSupplier(r.id, signed_documents);
        done.value += 1;
      } catch (e) {
        failed += 1;
        FailAlert(e, `Не удалось подписать один из актов поставки (${r.id.slice(0, 8)})`);
      }
    }

    if (failed === 0) {
      SuccessAlert(
        done.value > 1
          ? `Поставка подписана: актов — ${done.value}. Ожидается закрывающая подпись председателя КУ.`
          : 'Акт приёмки подписан. Ожидается закрывающая подпись председателя КУ.',
      );
    } else {
      FailAlert(
        new Error(
          `Подписано ${done.value} из ${deliveriesCount.value}; по ${failed} осталась ошибка — повторите.`,
        ),
      );
    }
    emit('signed');
    if (failed === 0) emit('update:modelValue', false);
  } finally {
    signing.value = false;
  }
}

function cancel(): void {
  emit('update:modelValue', false);
}
</script>

<template lang="pug">
BaseDialog(
  :model-value="modelValue"
  title="Подпись поставки"
  maximized
  @update:model-value="(v) => emit('update:modelValue', v)"
)
  .sign-apl(v-if="group")
    .sign-apl__head
      q-icon(name="local_shipping", size="28px")
      .sign-apl__ident
        span.sign-apl__name Поставка на {{ kuName }}
        span.sign-apl__addr(v-if="kuAddr")
          q-icon(name="place", size="14px")
          | {{ kuAddr }}
        span.sign-apl__sub {{ variantLabel }}
      .sign-apl__meta(v-if="group.ttnNumbers.length")
        span.sign-apl__ttn-label
          q-icon(name="description", size="14px")
          | {{ group.ttnNumbers.length > 1 ? 'Товарно-транспортные накладные' : 'Товарно-транспортная накладная' }}
        .sign-apl__ttn-list
          BaseChip(v-for="n in group.ttnNumbers", :key="n", variant="neutral", size="sm") {{ n }}

    table.sign-apl__table(v-if="!showActs")
      thead
        tr
          th Товар
          th.num Кол-во
          th.num Сумма
      tbody
        tr(v-for="l in group.lines", :key="l.key")
          td {{ l.productName }}
          td.num {{ l.quantity }} {{ marketplaceUnitShort(l.unit) }}
          td.num {{ formatAsset2Digits(l.amount.toFixed(4)) }} ₽
      tfoot
        tr
          td Итого к приёмке
          td.num
          td.num {{ formatAsset2Digits(group.totalAmount) }} ₽

    q-card(v-if="showActs", flat, bordered).sign-apl__preview
      q-inner-loading(:showing="previewLoading")
        q-spinner(size="28px")
      q-card-section.q-pa-md(v-if="previewHtml")
        div(v-html="previewHtml")

  template(#footer)
    BaseButton(variant="ghost", :disabled="signing", @click="cancel") Отмена
    BaseButton(variant="ghost", :loading="previewLoading", :disabled="!group", @click="toggleActs")
      template(#icon-left)
        q-icon(name="description", size="16px")
      | {{ showActs ? 'Скрыть акты' : 'Показать акты' }}
    BaseButton(variant="primary", :loading="signing", :disabled="!group", @click="confirm")
      template(#icon-left)
        q-icon(name="draw", size="16px")
      span(v-if="signing && group") Подписано {{ done }}/{{ deliveriesCount }}…
      span(v-else) Подписать
</template>

<style scoped lang="scss">
.sign-apl {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);

  &__head {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
    flex-wrap: wrap;
  }

  &__ident {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__name {
    font-size: var(--p-fs-h3, 15px);
    font-weight: 600;
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__addr {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    overflow-wrap: anywhere;

    .q-icon {
      flex: 0 0 auto;
      color: var(--p-ink-3);
    }
  }

  &__sub {
    font-size: var(--p-fs-meta, 12px);
    color: var(--p-ink-3);
  }

  &__meta {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
    margin-left: auto;
    align-items: flex-end;
  }

  &__ttn-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--p-fs-meta, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--p-ink-3);

    .q-icon {
      color: var(--p-ink-3);
    }
  }

  &__ttn-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--p-1, 4px);
    justify-content: flex-end;
    font-variant-numeric: tabular-nums;
  }

  &__table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--p-fs-body-sm, 13px);

    th,
    td {
      padding: var(--p-2, 8px) var(--p-2, 8px);
      border-bottom: 1px solid var(--p-line);
      text-align: left;
      color: var(--p-ink);
    }

    th {
      color: var(--p-ink-2);
      font-weight: 600;
    }

    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    tfoot td {
      font-weight: 600;
      border-bottom: none;
    }
  }

  &__preview {
    position: relative;
    min-height: 80px;
    max-height: 60vh;
    overflow: auto;
  }
}
</style>
