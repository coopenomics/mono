<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useGlobalStore } from 'src/shared/store';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { Avatar, BaseBadge, BaseButton, BaseDialog } from 'src/shared/ui/base';
import { AccountBadge } from 'src/shared/ui/domain';
import { useOperatorBranchStore } from 'src/entities/OperatorBranch';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { marketplaceUnitShort } from 'src/shared/lib/consts/marketplace-units';
import { useActsPreview, type ReceptionGroup } from 'src/shared/lib/marketplace';
import {
  fetchChairmanSignablePayloads,
  signReceptionGroupAsChairman,
  type MarketplaceAplReceptionView,
} from '../api';

/**
 * Закрывающая подпись председателя КУ на СВОДНОЙ поставке (on-chain `signchair`).
 *
 * Председатель видит и подписывает доставку целиком — все акты приёмки одного
 * поставщика на этом КУ с одним способом доставки. Под капотом по каждому акту
 * отдельная транзакция (блокчейн не проведёт всё одной tx); крипто-флоу вынесен
 * в api (signReceptionGroupAsChairman), акты подписываются параллельно. Прогресс
 * показываем пользователю; после закрытия всех актов партии приняты в кооператив.
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
const branchStore = useOperatorBranchStore();
const signing = ref(false);
const done = ref(0);
const previewHtml = ref<string>('');
const previewLoading = ref(false);
// Единый паттерн «Показать / Скрыть акты»: таблица прячется, показываются акты.
const { showActs, toggleActs, resetActs } = useActsPreview(loadPreview, previewHtml);

// Человекочитаемое имя КУ-получателя вместо служебного braname. Оператор
// привязан к своему КУ — резолвим имя из стола оператора.
const kuName = computed(() => {
  const b = props.group?.braname ?? '';
  return branchStore.branches.find((x) => x.braname === b)?.name || b;
});

// Сброс режима просмотра при открытии/смене поставки — каждая поставка
// начинается с таблицы состава, без подтянутых от прошлой документов.
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
  try {
    // Крипто-флоу закрывающей подписи вынесен в api (signReceptionGroupAsChairman) —
    // зеркало поставщика: акты подписываются параллельно, ошибка по одному не
    // теряет уже подписанные. Прогресс прокидываем в счётчик кнопки.
    const { errors } = await signReceptionGroupAsChairman(
      props.group.receptions,
      wif,
      globalStore.username,
      (d) => {
        done.value = d;
      },
    );

    for (const { receptionId, error } of errors) {
      FailAlert(error, `Не удалось закрыть один из актов поставки (${receptionId.slice(0, 8)})`);
    }

    if (errors.length === 0) {
      SuccessAlert(
        done.value > 1
          ? `Поставка принята в кооператив: подписано актов — ${done.value}.`
          : 'Акт приёмки закрыт подписью председателя. Партия принята в кооператив.',
      );
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

    .mp-sign-apl-chairman__sub
      | КУ {{ kuName }}
      template(v-if="group.ttnNumbers.length")  · ТТН {{ group.ttnNumbers.join(', ') }}

    table.mp-sign-apl-chairman__table(v-if="!showActs")
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

    q-card(v-if="showActs", flat, bordered).mp-sign-apl-chairman__preview
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

  &__preview {
    position: relative;
    min-height: 80px;
    max-height: 60vh;
    overflow: auto;
  }
}
</style>
