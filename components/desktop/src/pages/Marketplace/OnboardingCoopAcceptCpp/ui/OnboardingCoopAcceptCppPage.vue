<script lang="ts" setup>
import { onMounted, ref, computed } from 'vue';
import { Notify, Dialog } from 'quasar';
import {
  acceptCpp,
  fetchCppStatus,
  type MarketplaceCppStatusView,
} from '../api';

/**
 * Эпик 1 / Story 1.9-1.10: L1 — приём кооперативом ЦПП «Стол заказов».
 *
 * Стол председателя кооператива. Председатель видит статус ЦПП (`active` /
 * `not_accepted`) и кнопку «Принять ЦПП Marketplace», если ещё не принято.
 *
 * После клика — диалог подтверждения с stub `accepted_by_board_decision_id`
 * (в MVP — текстовая ссылка на решение совета; полноценная повестка совета —
 * FR40 / Эпик 8, Phase 2). На backend срабатывает `marketplaceAcceptCpp`:
 * подписывается оферта в `coop_registration_offers_registry`, флаг
 * `coopAcceptance.status='active'` сохраняется в конфиге расширения. После
 * этого пайщики могут проходить L3 onboarding gate.
 */

const status = ref<MarketplaceCppStatusView | null>(null);
const loading = ref(false);
const accepting = ref(false);

const isActive = computed(() => status.value?.status === 'active');
const chipColor = computed(() => (isActive.value ? 'positive' : 'warning'));
const chipIcon = computed(() => (isActive.value ? 'fa-solid fa-check' : 'fa-solid fa-hourglass-half'));
const chipLabel = computed(() => (isActive.value ? 'Подключено' : 'Не подключено'));
const statusLabel = computed(() =>
  isActive.value ? 'active — кооператив подключил ЦПП' : 'not_accepted — расширение не подключено',
);

async function load(): Promise<void> {
  loading.value = true;
  try {
    status.value = await fetchCppStatus();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    Notify.create({ type: 'negative', message });
  } finally {
    loading.value = false;
  }
}

function onAccept(): void {
  Dialog.create({
    title: 'Принять ЦПП «Стол заказов»?',
    message:
      'Подтвердите, что Совет кооператива принял Положение ЦПП «Стол заказов». В MVP — stub решения; полноценная повестка Совета подключится в Эпике 8.',
    cancel: { label: 'Отмена', flat: true },
    ok: { label: 'Принять', color: 'primary', unelevated: true },
    persistent: true,
  }).onOk(async () => {
    accepting.value = true;
    try {
      status.value = await acceptCpp({
        document_registry_id: 1100,
        accepted_by_board_decision_id: `MVP-STUB-${new Date().toISOString().slice(0, 10)}`,
      });
      Notify.create({
        type: 'positive',
        message: 'ЦПП Marketplace принято. Пайщики могут начать пользоваться Столом заказов.',
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      Notify.create({ type: 'negative', message });
    } finally {
      accepting.value = false;
    }
  });
}

onMounted(async () => {
  await load();
});
</script>

<template lang="pug">
q-page.mp-role-admin.mp-onboarding-l1(role="region", aria-label="Подключение ЦПП Marketplace")
  div.mp-onboarding-l1__header
    div
      div.text-h5 Подключение ЦПП «Стол заказов»
      div.text-caption.mp-onboarding-l1__subtitle
        | Целевая Потребительская Программа должна быть принята Советом кооператива, прежде чем пайщики смогут пользоваться Столом заказов.
    q-space
    q-chip(:color="chipColor", text-color="white")
      q-icon(:name="chipIcon", left)
      | {{ chipLabel }}

  q-inner-loading(:showing="loading && !status")
    q-spinner(color="primary", size="2em")

  q-card.mp-onboarding-l1__card(v-if="status", flat, bordered)
    q-card-section
      div.text-subtitle1.q-mb-sm Статус расширения
      div.row.q-col-gutter-md
        div.col-12.col-md-6
          div.text-caption Статус
          div.text-body1 {{ statusLabel }}
        div.col-12.col-md-6(v-if="status.document_registry_id")
          div.text-caption Реестр оферты
          div.text-body1 № {{ status.document_registry_id }}
        div.col-12.col-md-6(v-if="status.accepted_at")
          div.text-caption Принято
          div.text-body1 {{ status.accepted_at }}
        div.col-12.col-md-6(v-if="status.accepted_by_board_decision_id")
          div.text-caption Решение Совета
          div.text-body1 {{ status.accepted_by_board_decision_id }}

    q-card-actions(v-if="!isActive", align="right")
      q-btn(
        unelevated,
        no-caps,
        color="primary",
        icon="fa-solid fa-handshake",
        label="Принять ЦПП Marketplace",
        :loading="accepting",
        @click="onAccept"
      )
</template>

<style scoped lang="scss">
.mp-onboarding-l1 {
  padding: var(--mp-space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--mp-space-md);

  &__header {
    display: flex;
    align-items: flex-start;
    gap: var(--mp-space-md);
  }

  &__subtitle {
    color: var(--mp-on-surface-muted);
    max-width: 640px;
  }

  &__card {
    max-width: 720px;
  }
}
</style>
