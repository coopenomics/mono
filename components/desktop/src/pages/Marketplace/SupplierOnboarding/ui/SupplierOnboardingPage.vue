<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSystemStore } from 'src/entities/System/model';
import { BaseCard, BaseButton, BaseInput, BaseChip } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';
import { loadExtensionRoutes } from 'src/processes/init-installed-extensions';
import {
  fetchMySupplierState,
  requestSupplier,
  type MarketplaceSupplierStateView,
} from '../api';

/**
 * Онбординг поставщика на столе поставщика. Backend выдаёт грант
 * `Onboarding:offerer` пайщику без одобренного допуска, поэтому до одобрения
 * виден только этот экран; после одобрения offerer-роль открывает полный стол.
 *
 * Шаги: выбор модели работы (членская — активна, паевая — заглушка «скоро»),
 * для членской — ввод номера и даты бумажного договора с кооперативом и подача
 * заявки. До рассмотрения председателем — статус «заявка на рассмотрении».
 */

type WorkModel = 'MEMBERSHIP' | 'SHARE';

const router = useRouter();
const desktop = useDesktopStore();
const system = useSystemStore();
const coopname = computed(() => system.info?.coopname ?? '');

const state = ref<MarketplaceSupplierStateView | null>(null);
const loading = ref(false);
const submitting = ref(false);
const redirecting = ref(false);

const model = ref<WorkModel>('MEMBERSHIP');
const contractNumber = ref('');
const contractDate = ref('');

const isPending = computed(() => state.value?.status === 'PENDING');
const isRejected = computed(() => state.value?.status === 'REJECTED');

const canSubmit = computed(
  () =>
    model.value === 'MEMBERSHIP' &&
    contractNumber.value.trim().length > 0 &&
    contractDate.value.length > 0,
);

function formatContractDate(value: string | null | undefined): string {
  if (!value) return '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('ru-RU');
}

const contractLabel = computed((): string => {
  const number = state.value?.contract_number?.trim();
  if (!number) return '';
  const date = formatContractDate(state.value?.contract_date);
  return date ? `№ ${number} от ${date}` : `№ ${number}`;
});

async function load(): Promise<void> {
  loading.value = true;
  try {
    state.value = await fetchMySupplierState();
    // Уже одобрен — грант Onboarding:offerer не выдан, страница открыта по
    // прямой ссылке: уводим на стол поставщика.
    if (state.value?.status === 'APPROVED') await proceedToDesk();
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

async function proceedToDesk(): Promise<void> {
  redirecting.value = true;
  await desktop.loadDesktop();
  await loadExtensionRoutes('market', router);
  const target = desktop.firstAccessibleRoute('market-supplier');
  void router.push(
    target
      ? coopname.value
        ? { name: target.name, params: { coopname: coopname.value } }
        : { name: target.name }
      : { name: 'marketplace-my-offers' },
  );
}

async function onSubmit(): Promise<void> {
  if (!canSubmit.value) return;
  submitting.value = true;
  try {
    state.value = await requestSupplier({
      contract_number: contractNumber.value.trim(),
      contract_date: contractDate.value,
    });
  } catch (e) {
    FailAlert(e);
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>

<template lang="pug">
q-page.mp-role-offerer.supplier-onboarding(role="region", aria-label="Подключение к Столу поставщика")
  q-inner-loading(:showing="(loading && !state) || redirecting")
    q-spinner(color="primary", size="2em")

  template(v-if="!redirecting")
    //- Заявка подана — ждём рассмотрения председателем.
    BaseCard.supplier-onboarding__card(v-if="isPending")
      .supplier-onboarding__status
        .supplier-onboarding__status-icon.supplier-onboarding__status-icon--wait
          q-icon(name="hourglass_top", size="24px")
        .supplier-onboarding__status-text
          .text-h6 Заявка на рассмотрении
          .text-body2.text-grey-7
            | Ваша заявка на допуск поставщика передана председателю кооператива.
            | Как только её рассмотрят, стол поставщика откроется — здесь появятся
            | публикация предложений и приёмка партий.
          .supplier-onboarding__contract(v-if="contractLabel")
            DataRow(
              label="Договор",
              :value="contractLabel",
              align="horizontal",
              mono
            )

    //- Форма заявки (нет записи или предыдущая отклонена).
    template(v-else)
      BaseCard.supplier-onboarding__card
        header.supplier-onboarding__head
          .supplier-onboarding__head-icon
            q-icon(name="storefront", size="22px")
          .supplier-onboarding__head-text
            .text-subtitle1.text-weight-medium Стать поставщиком
            .text-body2.text-grey-7 Выберите модель работы с кооперативом и предоставьте договор.

        .supplier-onboarding__rejected(v-if="isRejected")
          q-icon(name="info", size="16px")
          span Предыдущая заявка отклонена. Уточните реквизиты договора и подайте повторно.

        //- Рубильник модели: членская активна, паевая — заглушка «скоро».
        .supplier-onboarding__models
          .supplier-onboarding__model(
            :class="{ 'supplier-onboarding__model--active': model === 'MEMBERSHIP' }",
            role="button",
            tabindex="0",
            @click="model = 'MEMBERSHIP'",
            @keyup.enter="model = 'MEMBERSHIP'"
          )
            .supplier-onboarding__model-head
              q-icon(name="card_membership", size="20px")
              .text-weight-medium Членская модель
              q-icon.supplier-onboarding__model-check(
                v-if="model === 'MEMBERSHIP'",
                name="check_circle",
                size="18px"
              )
            .text-body2.text-grey-7 Кооператив закупает имущество по договору поставщика.
          .supplier-onboarding__model.supplier-onboarding__model--disabled(aria-disabled="true")
            .supplier-onboarding__model-head
              q-icon(name="workspace_premium", size="20px")
              .text-weight-medium Паевая модель
              BaseChip.supplier-onboarding__soon(variant="neutral", size="sm") Скоро
            .text-body2.text-grey-7 Поставщик вносит паевой взнос имуществом по договору участия хозяйственной деятельности кооператива.

        //- Реквизиты договора по членской модели.
        .supplier-onboarding__form(v-if="model === 'MEMBERSHIP'")
          BaseInput(
            v-model="contractNumber",
            label="Номер договора",
            placeholder="например, 17/2026",
            :disabled="submitting"
          )
          BaseInput(
            v-model="contractDate",
            type="date",
            label="Дата заключения договора",
            :disabled="submitting"
          )
          .supplier-onboarding__support
            q-icon(name="help_outline", size="16px")
            span
              | По вопросам заключения договора с кооперативом обратитесь в поддержку.

      .supplier-onboarding__bar
        .supplier-onboarding__bar-note.text-body2.text-grey-7
          | После подачи заявку рассмотрит председатель кооператива — затем стол поставщика откроется.
        BaseButton(
          variant="primary",
          :loading="submitting",
          :disabled="!canSubmit",
          @click="onSubmit"
        ) Отправить заявку
</template>

<style scoped lang="scss">
.supplier-onboarding {
  padding: var(--p-6, 24px);
  padding-bottom: var(--p-10, 72px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
  max-width: 720px;

  &__card :deep(.base-card__body) {
    display: flex;
    flex-direction: column;
    gap: var(--p-4, 16px);
  }

  &__head {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
  }

  &__head-icon {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border-radius: var(--p-r-md, 12px);
    background: var(--p-primary-soft);
    color: var(--p-primary);
  }

  &__head-text {
    flex: 1;
    min-width: 0;
  }

  &__status {
    display: flex;
    align-items: flex-start;
    gap: var(--p-3, 12px);
  }

  &__status-icon {
    width: 48px;
    height: 48px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border-radius: var(--p-r-md, 12px);

    &--wait {
      background: var(--p-warn-soft, var(--p-primary-soft));
      color: var(--p-warn, var(--p-primary));
    }
  }

  &__status-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--p-1, 4px);
  }

  &__contract {
    margin-top: var(--p-2, 8px);
    padding-top: var(--p-3, 12px);
    border-top: 1px solid var(--p-line);

    :deep(.data-row) {
      padding: 0;
      border-bottom: none;
    }

    :deep(.data-row--horizontal) {
      grid-template-columns: minmax(72px, auto) 1fr;
      column-gap: var(--p-3, 12px);
    }
  }

  &__rejected {
    display: flex;
    align-items: flex-start;
    gap: var(--p-2, 8px);
    padding: var(--p-3, 12px);
    border-radius: var(--p-r-md, 12px);
    background: var(--p-warn-soft, var(--p-surface-2));
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm, 13px);

    .q-icon {
      flex-shrink: 0;
      margin-top: 1px;
      color: var(--p-warn, var(--p-primary));
    }
  }

  &__models {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--p-3, 12px);
  }

  &__model {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
    padding: var(--p-4, 16px);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;

    &:hover:not(&--disabled):not(&--active) {
      border-color: var(--p-primary-line, var(--p-primary));
    }

    &--active {
      border-color: var(--p-primary);
      background: var(--p-primary-soft);
    }

    &--disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
  }

  &__model-head {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);

    .q-icon {
      color: var(--p-primary);
    }
  }

  &__model-check {
    margin-left: auto;
    color: var(--p-primary) !important;
  }

  &__soon {
    margin-left: auto;
  }

  &__form {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }

  &__support {
    display: flex;
    align-items: flex-start;
    gap: var(--p-1, 4px);
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm, 13px);
    line-height: 1.4;

    .q-icon {
      flex-shrink: 0;
      margin-top: 2px;
      color: var(--p-info, var(--p-primary));
    }
  }

  &__bar {
    position: sticky;
    bottom: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    gap: var(--p-4, 16px);
    margin: 0 calc(-1 * var(--p-6, 24px)) calc(-1 * var(--p-10, 72px));
    padding: var(--p-4, 16px) var(--p-6, 24px);
    background: var(--p-canvas);
    border-top: 1px solid var(--p-line);
  }

  &__bar-note {
    flex: 1;
    min-width: 0;
  }

  @media (max-width: 768px) {
    &__models {
      grid-template-columns: 1fr;
    }

    &__bar {
      flex-direction: column;
      align-items: stretch;
      gap: var(--p-3, 12px);
    }
  }
}
</style>
