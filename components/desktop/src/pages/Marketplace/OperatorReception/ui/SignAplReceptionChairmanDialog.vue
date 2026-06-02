<script setup lang="ts">
import { computed, ref } from 'vue';
import { Classes } from '@coopenomics/sdk';
import { useGlobalStore } from 'src/shared/store';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { Avatar, BaseBadge, BaseButton, BaseDialog } from 'src/shared/ui/base';
import { AccountBadge } from 'src/shared/ui/domain';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { marketplaceUnitShort } from 'src/shared/lib/consts/marketplace-units';
import type { ReceptionGroup } from 'src/shared/lib/marketplace';
import {
  fetchChairmanSignablePayloads,
  signAsChairman,
  type MarketplaceAplReceptionView,
  type SignedDocumentInput,
} from '../api';

/**
 * Закрывающая подпись председателя КУ на СВОДНОЙ поставке (on-chain `signchair`).
 *
 * Председатель видит и подписывает доставку целиком — все акты приёмки одного
 * поставщика на этом КУ с одним способом доставки. Под капотом по каждому акту
 * отдельная транзакция (блокчейн не проведёт всё одной tx): цикл по receptions
 * группы, по каждому — закрывающая подпись поверх подписи поставщика тем же
 * ключом активной сессии (документ не перегенерируется). Прогресс показываем
 * пользователю; после закрытия всех актов партии приняты в кооператив.
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

async function loadPreview(): Promise<void> {
  if (!props.group) return;
  previewLoading.value = true;
  try {
    const parts: string[] = [];
    for (const r of props.group.receptions) {
      const aggregates = await fetchChairmanSignablePayloads({ apl_reception_id: r.id });
      parts.push(...aggregates.map((a) => a.rawDocument.html));
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
    FailAlert(new Error('Приватный ключ председателя не найден. Войдите в кооператив.'));
    return;
  }

  signing.value = true;
  done.value = 0;
  const signer = new Classes.Document(wif);
  let failed = 0;
  try {
    // По каждому акту группы — отдельная закрывающая подпись и отдельная
    // транзакция. Идём последовательно: ошибка по одному не теряет уже
    // подписанные, остальные продолжаем.
    for (const r of props.group.receptions) {
      try {
        const aggregates = await fetchChairmanSignablePayloads({ apl_reception_id: r.id });
        if (aggregates.length === 0) {
          throw new Error('Backend не вернул ни одного акта для закрывающей подписи.');
        }
        const signed_documents: SignedDocumentInput[] = [];
        for (const aggregate of aggregates) {
          const signed = await signer.signDocument(
            aggregate.rawDocument,
            globalStore.username,
            2,
            [aggregate.document],
          );
          signed_documents.push(signed);
        }
        await signAsChairman({ apl_reception_id: r.id, signed_documents });
        done.value += 1;
      } catch (e) {
        failed += 1;
        FailAlert(e, `Не удалось закрыть один из актов поставки (${r.id.slice(0, 8)})`);
      }
    }

    if (failed === 0) {
      SuccessAlert(
        done.value > 1
          ? `Поставка принята в кооператив: подписано актов — ${done.value}.`
          : 'Акт приёмки закрыт подписью председателя. Партия принята в кооператив.',
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
  title="Закрывающая подпись поставки"
  maximized
  @update:model-value="(v: boolean) => emit('update:modelValue', v)"
)
  .mp-sign-apl-chairman(v-if="group")
    .mp-sign-apl-chairman__head
      .mp-sign-apl-chairman__who
        Avatar(:name="group.offererName", size="md", tone="primary")
        .mp-sign-apl-chairman__ident
          span.mp-sign-apl-chairman__name {{ group.offererName }}
          AccountBadge(:account-name="group.offererAccount", size="sm")
      .mp-sign-apl-chairman__meta
        BaseBadge(variant="neutral") {{ variantLabel }}
        BaseBadge(v-if="deliveriesCount > 1", variant="info") Доставок: {{ deliveriesCount }}

    .mp-sign-apl-chairman__sub
      | КУ {{ group.braname }}
      template(v-if="group.ttnNumbers.length")  · ТТН {{ group.ttnNumbers.join(', ') }}

    table.mp-sign-apl-chairman__table
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

    .mp-sign-apl-chairman__preview-actions
      BaseButton(variant="ghost", size="sm", :loading="previewLoading", @click="loadPreview")
        template(#icon-left)
          q-icon(name="description", size="16px")
        | Показать акты

    q-card(v-if="previewHtml", flat, bordered).mp-sign-apl-chairman__preview
      q-card-section.q-pa-md
        div(v-html="previewHtml")

    .mp-sign-apl-chairman__note
      | После подписи каждая партия принимается в кооператив. Под капотом по
      | каждому акту приёма-передачи уходит отдельная транзакция в блокчейн.

  template(#footer)
    BaseButton(variant="ghost", :disabled="signing", @click="cancel") Отмена
    BaseButton(variant="primary", :loading="signing", :disabled="!group", @click="confirm")
      template(#icon-left)
        q-icon(name="draw", size="16px")
      span(v-if="signing && group") Подписано {{ done }}/{{ deliveriesCount }}…
      span(v-else) Подписать председателем
</template>

<style scoped lang="scss">
.mp-sign-apl-chairman {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    flex-wrap: wrap;
  }

  &__who {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
    min-width: 0;
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

  &__meta {
    display: flex;
    gap: var(--p-1, 4px);
    flex-wrap: wrap;
  }

  &__sub {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
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

  &__preview-actions {
    display: flex;
    justify-content: flex-start;
  }

  &__preview {
    max-height: 60vh;
    overflow: auto;
  }

  &__note {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
  }
}
</style>
