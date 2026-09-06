<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { debounce } from 'quasar';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseCard } from 'src/shared/ui/base';
import { ActivityTimeline, type ActivityEvent } from 'src/shared/ui/domain';
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace';
import { marketplaceOrderSaleUnit } from 'src/shared/lib/consts/marketplace-units';
import { formatAsset2Digits } from 'src/shared/lib/utils';
import { formatDateToLocalTimezone, getTimezoneLabel } from 'src/shared/lib/utils/dates';
import {
  returnClaimStatusLabel,
  returnClaimStatusVariant,
  returnClaimDecisionLabel,
} from '../../OrdererReturnClaims';
import { defectCategoryLabel, handBackReturn, type MarketplaceReturnClaimView } from '../../OperatorReturnClaims/api';
import { RETURN_CLAIM_NEGATIVE_DECISIONS } from '../../OrdererReturnClaims/api';
import RemoteDecisionDialog from '../../OperatorReturnClaims/ui/RemoteDecisionDialog.vue';
import OnSiteDecisionDialog from '../../OperatorReturnClaims/ui/OnSiteDecisionDialog.vue';
import { fetchReturnClaim } from '../api';

/**
 * Универсальная детальная страница заявления на гарантийный возврат — стол ПВЗ.
 * Открывается кликом по карточке из любой вкладки списка (`OperatorReturnClaimsPage`):
 * на рассмотрении, ожидает визита, архив. Раньше решения принимались прямо в
 * карточке списка через два разных диалога, а архивная карточка была
 * усечённой (без тела) — из списка не было видно, куда она вообще ведёт
 * (см. review 2026-07-29). Теперь карточка одна и та же для всех статусов,
 * а решение (или просто просмотр архива) — здесь, на отдельной странице:
 * текущий статус + контекстное действие для этого статуса.
 */

const route = useRoute();
const router = useRouter();
const coopname = computed(() => String(route.params.coopname ?? ''));
const claimId = computed(() => String(route.params.claimId ?? ''));

const claim = ref<MarketplaceReturnClaimView | null>(null);
const loading = ref(false);

const remoteDialog = ref(false);
const onSiteDialog = ref(false);

const status = computed(() => claim.value?.status ?? null);
const isPendingReview = computed(() => status.value === Zeus.MarketplaceReturnClaimStatus.PENDING_CHAIRMAN_REVIEW);
const isApprovedForVisit = computed(() => status.value === Zeus.MarketplaceReturnClaimStatus.APPROVED_FOR_VISIT);
const isPendingCouncil = computed(() => status.value === Zeus.MarketplaceReturnClaimStatus.PENDING_COUNCIL);
const isDeclinedByCouncil = computed(() => status.value === Zeus.MarketplaceReturnClaimStatus.DECLINED_BY_COUNCIL);
// Выдать обратно: после отказа совета — сразу; без решения — по истечении срока ожидания.
const canHandBack = computed(() => {
  const c = claim.value;
  if (!c) return false;
  if (isDeclinedByCouncil.value) return true;
  if (isPendingCouncil.value && c.hand_back_available_at) {
    return new Date(String(c.hand_back_available_at)).getTime() <= Date.now();
  }
  return false;
});
const handingBack = ref(false);
async function handBack(): Promise<void> {
  const c = claim.value;
  if (!c || handingBack.value) return;
  handingBack.value = true;
  try {
    await handBackReturn({ claim_id: c.id, braname: c.delivery_braname });
    SuccessAlert('Имущество выдано пайщику обратно — заявление закрыто.');
    await load();
  } catch (e) {
    FailAlert(e, 'Не удалось выдать имущество обратно');
  } finally {
    handingBack.value = false;
  }
}

function claimQuantityLabel(c: MarketplaceReturnClaimView): string {
  const saleUnit = marketplaceOrderSaleUnit(c.actual_quantity, c.unit_of_measure, c.package_size);
  return `${saleUnit.units}×${saleUnit.unitLabel}`;
}

function formatDate(value: unknown): string {
  const out = formatDateToLocalTimezone(value, 'DD.MM.YYYY HH:mm');
  return out ? `${out} ${getTimezoneLabel()}` : '—';
}

// Последнее решение до текущего статуса — «Одобрено: <дата>» под шапкой,
// когда заявление ждёт очного визита (когда именно председатель пригласил).
const lastDecisionAt = computed(() => {
  const log = claim.value?.decision_log ?? [];
  return log.length > 0 ? log[log.length - 1].at : null;
});

const timelineEvents = computed<ActivityEvent[]>(() => {
  const c = claim.value;
  if (!c) return [];
  const events: ActivityEvent[] = [];
  events.push({
    id: 'submitted',
    type: 'create',
    icon: 'assignment_return',
    title: 'Заявление подано',
    date: String(c.created_at),
  });
  for (const entry of c.decision_log) {
    const isReject = RETURN_CLAIM_NEGATIVE_DECISIONS.has(entry.decision);
    events.push({
      id: `decision-${entry.tx_hash}`,
      type: isReject ? 'reject' : 'sign',
      icon: isReject ? 'cancel' : 'check_circle',
      title: returnClaimDecisionLabel(entry.decision),
      date: String(entry.at),
    });
  }
  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
});

async function load(): Promise<void> {
  if (!claimId.value) return;
  loading.value = true;
  try {
    claim.value = await fetchReturnClaim(claimId.value);
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить заявление на возврат');
  } finally {
    loading.value = false;
  }
}

function goBack(): void {
  void router.push({ name: 'marketplace-pvz-returns', params: { coopname: coopname.value } });
}

function startRemote(): void {
  remoteDialog.value = true;
}

function startOnSite(): void {
  onSiteDialog.value = true;
}

function onDecided(): void {
  void load();
}

onMounted(() => {
  void load();
});

// Открыта одна заявка — реагируем только на сигнал по её id; другое решение
// (например, второй оператор того же КУ) отражается сразу, без перезахода.
const reloadLive = debounce(() => {
  if (loading.value) return;
  void load();
}, 400);
useMarketplaceRealtime(
  {
    MarketplaceReturnClaimStatusChangedEvent: (event) => {
      if (event.claim_id === claimId.value) reloadLive();
    },
  },
  { onResync: () => reloadLive() },
);
</script>

<template lang="pug">
q-page.return-detail(role='region', aria-label='Заявление на гарантийный возврат')
  .return-detail__col
    BaseButton.return-detail__back(variant='ghost', size='sm', @click='goBack')
      template(#icon-left)
        q-icon(name='arrow_back', size='16px')
      | К гарантийным возвратам

    q-inner-loading(:showing='loading && !claim')
      q-spinner(color='primary', size='2em')

    template(v-if='claim')
      BaseCard.return-detail__card
        .return-detail__head
          q-icon.return-detail__icon(name='assignment_return', size='24px')
          .return-detail__head-text
            .t-h2.return-detail__title Заказ {{ claim.order_id.slice(0, 8) }} · заказчик {{ claim.orderer_name || claim.orderer_account }}
            .return-detail__sub
              span.return-detail__num №&nbsp;{{ claim.id.slice(0, 8) }}
              span(aria-hidden='true') ·
              span {{ formatDate(claim.created_at) }}
          BaseBadge(:variant='returnClaimStatusVariant(claim.status)') {{ returnClaimStatusLabel(claim.status) }}

        .return-detail__body
          .return-detail__photos(v-if='claim.photos.length')
            a.return-detail__thumb(
              v-for='(p, i) in claim.photos',
              :key='p.content_hash',
              :href='p.url',
              target='_blank',
              rel='noopener'
            )
              img(:src='p.url', :alt='`Фото ${i + 1}`')

          .return-detail__facts
            .return-detail__fact
              .return-detail__fact-label Количество к возврату
              .return-detail__fact-value {{ claimQuantityLabel(claim) }}
            .return-detail__fact
              .return-detail__fact-label Сумма возврата
              .return-detail__fact-value.return-detail__fact-value--money {{ formatAsset2Digits(claim.fact_cost) }} ₽
            .return-detail__fact
              .return-detail__fact-label Причина возврата
              .return-detail__fact-value {{ claim.reason_text }}
            .return-detail__fact(v-if='claim.defect_category')
              .return-detail__fact-label Категория дефекта
              .return-detail__fact-value {{ defectCategoryLabel(claim.defect_category) }}
            .return-detail__fact(v-if='isApprovedForVisit && lastDecisionAt')
              .return-detail__fact-label Одобрено
              .return-detail__fact-value {{ formatDate(lastDecisionAt) }}
            .return-detail__fact(v-if='claim.ledger_snapshot')
              .return-detail__fact-label Восстановлено пайщику
              .return-detail__fact-value.return-detail__fact-value--money {{ formatAsset2Digits(claim.ledger_snapshot.amount) }} ₽

        .return-detail__note(v-if='isPendingCouncil')
          q-icon(name='schedule', size='16px')
          span Имущество принято, заявление на повестке совета. Решение придёт сюда само — торопить его не нужно.
        .return-detail__note(v-if='isDeclinedByCouncil')
          q-icon(name='info', size='16px')
          span Совет отказал. Имущество ждёт пайщика — выдайте его обратно при визите.
        .return-detail__actions(v-if='isPendingReview || isApprovedForVisit || canHandBack')
          BaseButton(v-if='isPendingReview', variant='primary', size='sm', @click='startRemote')
            template(#icon-left)
              q-icon(name='gavel', size='16px')
            | Принять решение
          BaseButton(v-if='isApprovedForVisit', variant='secondary', size='sm', @click='startOnSite')
            template(#icon-left)
              q-icon(name='fact_check', size='16px')
            | Приём имущества
          BaseButton(v-if='canHandBack', variant='secondary', size='sm', :loading='handingBack', @click='handBack')
            template(#icon-left)
              q-icon(name='undo', size='16px')
            | Выдать обратно

      BaseCard.return-detail__card(v-if='timelineEvents.length')
        template(#head)
          .t-h3 Хронология
        ActivityTimeline(:events='timelineEvents', group-by-date)

    RemoteDecisionDialog(
      v-model='remoteDialog',
      :claim='claim',
      :braname='claim?.delivery_braname ?? ""',
      @decided='onDecided'
    )
    OnSiteDecisionDialog(
      v-model='onSiteDialog',
      :claim='claim',
      :braname='claim?.delivery_braname ?? ""',
      @decided='onDecided'
    )
</template>

<style scoped lang="scss">
.return-detail {
  padding: var(--p-6, 24px) var(--p-4, 16px);

  &__col {
    max-width: 760px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--p-4, 16px);
  }

  &__back {
    align-self: flex-start;
  }

  &__card {
    display: flex;
    flex-direction: column;
    gap: var(--p-4, 16px);
  }

  &__head {
    display: flex;
    align-items: flex-start;
    gap: var(--p-3, 12px);
  }

  &__icon {
    flex: 0 0 auto;
    color: var(--p-ink-3);
    margin-top: 2px;
  }

  &__head-text {
    min-width: 0;
    flex: 1 1 auto;
  }

  &__title {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  &__sub {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--p-1, 4px) var(--p-2, 8px);
    margin-top: var(--p-1, 4px);
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-3);
  }

  &__num {
    font-family: var(--p-mono);
  }

  &__body {
    display: flex;
    align-items: flex-start;
    gap: var(--p-4, 16px);
    padding-top: var(--p-4, 16px);
    border-top: 1px solid var(--p-line);
  }

  &__photos {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
    flex: 0 0 auto;
  }

  &__thumb {
    display: inline-block;
    width: 96px;
    height: 96px;
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-sm, 8px);
    overflow: hidden;
    transition: border-color var(--p-dur-fast, 120ms) var(--p-ease-standard);

    &:hover {
      border-color: var(--p-primary);
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  &__facts {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }

  &__fact-label {
    font-size: var(--p-fs-eyebrow, 11px);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--p-ink-3);
    margin-bottom: 2px;
  }

  &__fact-value {
    font-size: var(--p-fs-body);
    color: var(--p-ink);
    overflow-wrap: anywhere;

    &--money {
      font-size: var(--p-fs-h2, 18px);
      font-weight: 700;
      font-feature-settings: 'tnum' 1;
    }
  }

  &__note {
    display: flex;
    align-items: flex-start;
    gap: var(--p-2, 8px);
    padding: var(--p-3, 12px) 0;
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--p-3, 12px);
    padding-top: var(--p-3, 12px);
    border-top: 1px solid var(--p-line);
  }
}

@media (max-width: 600px) {
  .return-detail {
    padding: var(--p-3, 12px) var(--p-3, 12px) var(--p-4, 16px);

    &__body {
      flex-direction: column;
    }
  }
}
</style>
