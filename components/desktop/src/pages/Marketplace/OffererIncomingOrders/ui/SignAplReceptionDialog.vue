<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { signingKeyOrAlert } from 'src/shared/lib/utils/signingKey';
import { BaseButton, BaseChip, BaseDialog } from 'src/shared/ui/base';
import { ActDialogLayout } from 'src/widgets/Marketplace/ActDialogLayout';
import { useMarketplaceKUDetailsStore } from 'src/entities/MarketplaceKUDetails';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { marketplaceOrderSaleUnit } from 'src/shared/lib/consts/marketplace-units';
import { useActsPreview, type ReceptionGroup } from 'src/shared/lib/marketplace';
import {
  fetchSupplierSignablePayloads,
  signReceptionGroupAsSupplier,
  type MarketplaceAplReceptionView,
} from 'src/entities/MarketplaceAplReception';

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
  IN_PERSON: 'Очная приёмка',
  EXPEDITOR: 'Через экспедитора',
  A: 'Очная приёмка',
  B: 'Через экспедитора',
};
const variantLabel = computed(() =>
  props.group ? (VARIANT_LABEL[props.group.variant] ?? props.group.variant) : '',
);

const deliveriesCount = computed(() => props.group?.receptions.length ?? 0);

function lineQuantityLabel(l: { quantity: number; unit: string; packageSize: number | null }): string {
  const saleUnit = marketplaceOrderSaleUnit(l.quantity, l.unit, l.packageSize);
  return `${saleUnit.units}×${saleUnit.unitLabel}`;
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
      else map.set(key, { key, productName: f.product_name || 'Товар по предложению', count: 1 });
    }
  }
  return [...map.values()];
});
const hasRejected = computed(() => rejectedItems.value.length > 0);
// В блоке «Принимается» нулевые строки (снятые позиции) не показываем — они
// уходят в блок «Отклоняется».
const acceptedLines = computed(() => (props.group?.lines ?? []).filter((l) => l.quantity > 0));
const hasAccepted = computed(() => acceptedLines.value.length > 0);
const confirmLabel = computed(() => (hasAccepted.value ? 'Подписать' : 'Подтвердить отмену'));

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

  const wif = await signingKeyOrAlert('Не удалось получить ключ поставщика для подписи');
  if (!wif) return;

  signing.value = true;
  done.value = 0;
  try {
    // Крипто-флоу подписи вынесен в api (signReceptionGroupAsSupplier) — единый
    // источник со столом и глобальным гейтом. Прогресс прокидываем в счётчик
    // кнопки, ошибки/успех алертим здесь.
    const { errors } = await signReceptionGroupAsSupplier(
      props.group.receptions,
      wif,
      (d) => {
        done.value = d;
      },
    );

    for (const { receptionId, error } of errors) {
      FailAlert(error, `Не удалось подписать один из актов поставки (${receptionId.slice(0, 8)})`);
    }

    if (errors.length === 0) {
      // Поставщику число актов в партии знать не нужно — это внутренняя кухня
      // оформления (одна поставка = много актов на цепи). Для него поставка —
      // единое целое: подписал и ждёт закрывающую подпись председателя КУ.
      SuccessAlert('Поставка подписана. Ожидается закрывающая подпись оператора участка.');
    } else {
      FailAlert(
        new Error(
          `Подписано ${done.value} из ${deliveriesCount.value}; по ${errors.length} осталась ошибка — повторите.`,
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
BaseDialog(
  :model-value="modelValue"
  title="Подпись поставки"
  maximized
  @update:model-value="(v) => emit('update:modelValue', v)"
)
  ActDialogLayout(v-if="group")
    template(#head)
      .sign-apl__top
        .sign-apl__ident
          span.sign-apl__name Поставка на {{ kuName }}
          span.sign-apl__addr(v-if="kuAddr")
            q-icon(name="place", size="14px")
            | {{ kuAddr }}
          span.sign-apl__sub {{ variantLabel }}
        .sign-apl__meta(v-if="group.ttnNumbers.length")
          span.sign-apl__ttn-label
            q-icon(name="description", size="14px")
            | {{ group.ttnNumbers.length > 1 ? 'ТТН' : 'ТТН' }}
          .sign-apl__ttn-list
            BaseChip(v-for="n in group.ttnNumbers", :key="n", variant="neutral", size="sm") {{ n }}

    template(v-if="!showActs")
      .sign-apl__section-head(v-if="hasRejected && hasAccepted") Принимается
      table.sign-apl__table(v-if="hasAccepted")
        thead
          tr
            th Товар
            th.num Кол-во
            th.num Сумма
        tbody
          tr(v-for="l in acceptedLines", :key="l.key")
            td {{ l.productName }}
            td.num {{ lineQuantityLabel(l) }}
            td.num {{ formatAsset2Digits(l.amount.toFixed(4)) }} ₽
        tfoot
          tr
            td Итого к приёмке
            td.num
            td.num {{ formatAsset2Digits(group.totalAmount) }} ₽

      .sign-apl__refuse(v-if="hasRejected")
        .sign-apl__section-head.sign-apl__section-head--neg
          q-icon(name="block", size="16px")
          | Отклоняется (некондиция)
        ul.sign-apl__refuse-list
          li(v-for="r in rejectedItems", :key="r.key")
            span {{ r.productName }}
            BaseChip(variant="neutral", size="sm") {{ r.count }} поз.
        p.sign-apl__refuse-note
          | Эти позиции сняты при приёмке и не принимаются. Подтверждая, вы
          | отменяете их поставку — заказчикам возвращается полная стоимость и
          | кооперативная наценка, удержания с вас нет.

    .sign-apl__preview(v-else)
      q-inner-loading(:showing="previewLoading")
        q-spinner(size="28px")
      div(v-if="previewHtml", v-html="previewHtml")

  template(#footer)
    BaseButton(variant="ghost", :disabled="signing", @click="cancel") Отмена
    BaseButton(variant="ghost", :loading="previewLoading", :disabled="!group || !hasAccepted", @click="toggleActs")
      template(#icon-left)
        q-icon(name="description", size="18px")
      | {{ showActs ? 'Скрыть акты' : 'Показать акты' }}
    BaseButton(variant="primary", :loading="signing", :disabled="!group", @click="confirm")
      template(#icon-left)
        q-icon(name="draw", size="18px")
      span(v-if="signing && group") Подписано {{ done }}/{{ deliveriesCount }}…
      span(v-else) {{ confirmLabel }}
</template>

<style scoped lang="scss">
.sign-apl {
  &__top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
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
    overflow-wrap: break-word;
  }

  &__addr {
    display: flex;
    align-items: center;
    gap: var(--p-1, 4px);
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    overflow-wrap: break-word;

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
    align-items: flex-end;
  }

  &__ttn-label {
    display: flex;
    align-items: center;
    gap: var(--p-1, 4px);
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
      padding: var(--p-2, 8px);
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
    min-height: 120px;
    max-height: 55vh;
    overflow: auto;
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
