<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseCard } from 'src/shared/ui/base';
import { BaseDocument } from 'src/shared/ui/BaseDocument';
import { ActivityTimeline, type ActivityEvent } from 'src/shared/ui/domain';
import { marketplaceOrderSaleUnit } from 'src/shared/lib/consts/marketplace-units';
import { formatAsset2Digits } from 'src/shared/lib/utils';
import { formatDateToLocalTimezone, getTimezoneLabel } from 'src/shared/lib/utils/dates';
import { returnClaimDecisionLabel, RETURN_CLAIM_NEGATIVE_DECISIONS } from '../../OrdererReturnClaims/api';
import {
  admitSupplierClaim,
  fetchSupplierClaim,
  supplierClaimStatusLabel,
  supplierClaimStatusVariant,
  type MarketplaceSupplierClaimView,
} from '../../OffererWarrantyClaims/api';
import RefuseClaimDialog from '../../OffererWarrantyClaims/ui/RefuseClaimDialog.vue';

/**
 * Карточка гарантийной претензии на столе поставщика (99D-13): что вернули и
 * на какую сумму, где забрать, причина обращения пайщика и результат осмотра
 * оператора, фотографии, рекламация с двумя подписями и пройденные шаги
 * возврата. Протокол решения совета поставщику не показывается — его дело
 * ответить по претензии: принять или отказать.
 */

const route = useRoute();
const router = useRouter();
const claimId = computed(() => String(route.params.claimId ?? ''));

const claim = ref<MarketplaceSupplierClaimView | null>(null);
const loading = ref(false);
const admitting = ref(false);
const refuseDialog = ref(false);

const isPending = computed(() => claim.value?.status === 'PENDING');

function quantityLabel(c: MarketplaceSupplierClaimView): string {
  const saleUnit = marketplaceOrderSaleUnit(c.actual_quantity, c.unit_of_measure, c.package_size);
  return `${saleUnit.units}×${saleUnit.unitLabel}`;
}

function formatDate(value: unknown): string {
  const out = formatDateToLocalTimezone(value, 'DD.MM.YYYY HH:mm');
  return out ? `${out} ${getTimezoneLabel()}` : '—';
}

const timelineEvents = computed<ActivityEvent[]>(() => {
  const c = claim.value;
  if (!c) return [];
  const events: ActivityEvent[] = [];
  for (const entry of c.history) {
    const isReject = RETURN_CLAIM_NEGATIVE_DECISIONS.has(entry.decision);
    events.push({
      id: `step-${entry.tx_hash}`,
      type: isReject ? 'reject' : 'sign',
      icon: isReject ? 'cancel' : 'check_circle',
      title: returnClaimDecisionLabel(entry.decision),
      description: entry.comment || undefined,
      date: String(entry.at),
    });
  }
  events.push({
    id: 'issued',
    type: 'create',
    icon: 'request_quote',
    title: 'Претензия выставлена поставщику',
    date: String(c.issued_at),
  });
  if (c.decided_at) {
    const refused = c.status === 'REFUSED';
    events.push({
      id: 'decided',
      type: refused ? 'reject' : 'sign',
      icon: refused ? 'cancel' : 'check_circle',
      title: refused ? 'Поставщик отказал' : c.auto_admitted ? 'Претензия признана по истечении срока ответа' : 'Поставщик признал претензию',
      description: c.refuse_reason || undefined,
      date: String(c.decided_at),
    });
  }
  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
});

async function load(): Promise<void> {
  loading.value = true;
  try {
    claim.value = await fetchSupplierClaim(claimId.value);
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить претензию');
  } finally {
    loading.value = false;
  }
}

function goBack(): void {
  void router.push({ name: 'marketplace-supplier-claims', params: { coopname: String(route.params.coopname ?? '') } });
}

async function admit(): Promise<void> {
  const c = claim.value;
  if (!c || admitting.value) return;
  admitting.value = true;
  try {
    await admitSupplierClaim(c.id);
    SuccessAlert(`Претензия признана: ${formatAsset2Digits(c.amount)} ₽ будут удержаны из следующих выплат.`);
    await load();
  } catch (e) {
    FailAlert(e, 'Не удалось признать претензию');
  } finally {
    admitting.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template lang="pug">
q-page.claim-detail(role='region', aria-label='Гарантийная претензия')
  .claim-detail__col
    BaseButton.claim-detail__back(variant='ghost', size='sm', @click='goBack')
      template(#icon-left)
        q-icon(name='arrow_back', size='16px')
      | К гарантийным возвратам

    q-inner-loading(:showing='loading && !claim')
      q-spinner(color='primary', size='2em')

    template(v-if='claim')
      BaseCard.claim-detail__card
        .claim-detail__head
          q-icon.claim-detail__icon(name='request_quote', size='24px')
          .claim-detail__head-text
            .t-h2.claim-detail__title {{ claim.product_name || 'Товар по заказу' }} · {{ quantityLabel(claim) }}
            .claim-detail__sub
              span.claim-detail__num №&nbsp;{{ claim.id.slice(0, 8) }}
              span(aria-hidden='true') ·
              span {{ formatDate(claim.issued_at) }}
          BaseBadge(:variant='supplierClaimStatusVariant(claim.status)') {{ supplierClaimStatusLabel(claim.status) }}

        .claim-detail__body
          .claim-detail__photos(v-if='claim.photos.length')
            a.claim-detail__thumb(
              v-for='(p, i) in claim.photos',
              :key='p.content_hash',
              :href='p.url',
              target='_blank',
              rel='noopener'
            )
              img(:src='p.url', :alt='`Фото ${i + 1}`')

          .claim-detail__facts
            .claim-detail__fact
              .claim-detail__fact-label Сумма претензии
              .claim-detail__fact-value.claim-detail__fact-value--money {{ formatAsset2Digits(claim.amount) }} ₽
            .claim-detail__fact
              .claim-detail__fact-label Где забрать имущество
              .claim-detail__fact-value Кооперативный участок {{ claim.delivery_branch_name || claim.delivery_braname }}
            .claim-detail__fact
              .claim-detail__fact-label Заказ
              .claim-detail__fact-value {{ claim.order_id.slice(0, 8) }} · заказчик {{ claim.orderer_name || claim.orderer_account }}
            .claim-detail__fact
              .claim-detail__fact-label Причина обращения пайщика
              .claim-detail__fact-value {{ claim.reason_text }}
            .claim-detail__fact(v-if='claim.inspection_result')
              .claim-detail__fact-label Результат осмотра на участке
              .claim-detail__fact-value {{ claim.inspection_result }}
            .claim-detail__fact(v-if='claim.refuse_reason')
              .claim-detail__fact-label Ваш отказ
              .claim-detail__fact-value {{ claim.refuse_reason }}

        .claim-detail__note(v-if='isPending && claim.auto_admit_at')
          q-icon(name='schedule', size='16px')
          span Без ответа претензия будет признана {{ formatDate(claim.auto_admit_at) }}.
        .claim-detail__note(v-if='claim.status === "ADMITTED"')
          q-icon(name='info', size='16px')
          span Сумма удерживается из ваших следующих выплат за поставки — переводить ничего не нужно.
        .claim-detail__actions(v-if='isPending')
          BaseButton(variant='primary', size='sm', :loading='admitting', @click='admit')
            template(#icon-left)
              q-icon(name='check_circle', size='16px')
            | Принять претензию
          BaseButton(variant='secondary', size='sm', :disabled='admitting', @click='refuseDialog = true')
            template(#icon-left)
              q-icon(name='cancel', size='16px')
            | Отказать

      BaseCard.claim-detail__card(v-if='claim.reclamation')
        template(#head)
          .t-h3 Рекламация пайщика
        .claim-detail__doc-hint Заявление о гарантийном возврате имущества с подписями пайщика и оператора участка, принявшего имущество.
        BaseDocument(:document-aggregate='claim.reclamation')

      BaseCard.claim-detail__card(v-if='timelineEvents.length')
        template(#head)
          .t-h3 Как проходил возврат
        ActivityTimeline(:events='timelineEvents', group-by-date)

    RefuseClaimDialog(v-model='refuseDialog', :claim='claim', @decided='load')
</template>

<style scoped lang="scss">
.claim-detail {
  padding: var(--p-6, 24px) var(--p-4, 16px);

  &__col {
    max-width: 860px;
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

  &__doc-hint {
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm, 13px);
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
  .claim-detail {
    padding: var(--p-3, 12px) var(--p-3, 12px) var(--p-4, 16px);

    &__body {
      flex-direction: column;
    }
  }
}
</style>
