<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch';
import { Avatar, BaseBadge, BaseButton, BaseDialog, EmptyState } from 'src/shared/ui/base';
import { AccountBadge, PageHint } from 'src/shared/ui/domain';
import { QrScanner } from 'src/widgets/Marketplace/QrScanner';
import { orderStatusDisplay } from 'src/widgets/Marketplace/OrderCard';
import { marketplaceUnitShort } from 'src/shared/lib/consts/marketplace-units';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { decodeHandoffToken, HandoffTokenKind } from 'src/shared/lib/marketplace';
import {
  listIssuancesByBraname,
  type MarketplaceOrderIssuanceView,
} from '../api';
import IssueActOpenDialog from './IssueActOpenDialog.vue';

/**
 * Operator-стол выдачи имущества пайщику, СГРУППИРОВАННЫЙ ПО ЗАКАЗЧИКУ: одна
 * карточка = один получатель (ФИО + что ему причитается). Оператор сканирует
 * код / находит заказчика и сразу видит «кому что отдать» — список единиц, а не
 * россыпь сотен строк.
 *
 * Внутри карточки заказы разнесены по стадии выдачи:
 *   - «К выдаче» (ACCEPTED_TO_COOP) — оператор открывает выдачу подписью
 *     председателя (IssueActOpenDialog, full-screen);
 *   - «Ждут получения» (READY_TO_RECEIVE) — выдача открыта, ждём, когда сам
 *     заказчик подтвердит получение в своём кабинете.
 */

const route = useRoute();
const store = useOperatorBranchStore();
const coopname = computed(() => String(route.params.coopname ?? ''));
const braname = computed(() => store.activeBraname ?? '');
const items = ref<MarketplaceOrderIssuanceView[]>([]);
const loading = ref(false);

const openDialog = ref(false);
const selectedOrder = ref<MarketplaceOrderIssuanceView | null>(null);

// Статусы заказа, релевантные выдаче (ожидают открытия или финальной подписи).
const ISSUANCE_STATUSES = ['ACCEPTED_TO_COOP', 'READY_TO_RECEIVE'];

// Группировка ленты выдачи по заказчику: карточка получателя со списком единиц,
// разнесённым по стадии (к выдаче / ждут получения).
interface IssuanceGroup {
  account: string;
  name: string;
  toIssue: MarketplaceOrderIssuanceView[];
  awaiting: MarketplaceOrderIssuanceView[];
  total: string;
  count: number;
}

const groups = computed<IssuanceGroup[]>(() => {
  const map = new Map<string, MarketplaceOrderIssuanceView[]>();
  for (const o of items.value) {
    const arr = map.get(o.orderer_account) ?? [];
    arr.push(o);
    map.set(o.orderer_account, arr);
  }
  const out: IssuanceGroup[] = [];
  for (const [account, orders] of map) {
    const named = orders.find((o) => o.orderer_name);
    out.push({
      account,
      name: named?.orderer_name || account,
      toIssue: orders.filter((o) => o.status === 'ACCEPTED_TO_COOP'),
      awaiting: orders.filter((o) => o.status === 'READY_TO_RECEIVE'),
      total: orders
        .reduce((a, o) => a + Number.parseFloat(String(o.total_cost ?? '0')), 0)
        .toFixed(4),
      count: orders.length,
    });
  }
  // Заказчики, кому есть что выдать прямо сейчас (есть «к выдаче») — наверх.
  return out.sort((a, b) => (b.toIssue.length ? 1 : 0) - (a.toIssue.length ? 1 : 0));
});

async function load(): Promise<void> {
  if (!braname.value.trim()) return;
  loading.value = true;
  try {
    items.value = await listIssuancesByBraname({ delivery_braname: braname.value.trim() });
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить ленту выдач');
  } finally {
    loading.value = false;
  }
}

function startOpen(item: MarketplaceOrderIssuanceView): void {
  selectedOrder.value = item;
  openDialog.value = true;
}

// QR-код получения: оператор сканирует account-bound код заказчика → резолвим
// аккаунт против ленты своего КУ и показываем РАЗОМ все его заказы на выдачу.
const scanDialogOpen = ref(false);
const pickupDialogOpen = ref(false);
const pickupAccount = ref('');
const pickupOrders = computed(() =>
  items.value.filter(
    (o) => o.orderer_account === pickupAccount.value && ISSUANCE_STATUSES.includes(o.status),
  ),
);

function startIssuanceStep(order: MarketplaceOrderIssuanceView): void {
  if (order.status === 'ACCEPTED_TO_COOP') {
    startOpen(order);
  } else {
    FailAlert(new Error('Выдача уже открыта — ждём подтверждение заказчика.'));
  }
}

function onQrScanned(code: string): void {
  scanDialogOpen.value = false;
  const token = decodeHandoffToken(code);
  if (!token || token.kind !== HandoffTokenKind.Receive) {
    FailAlert(new Error('Нераспознанный код заказчика. Отсканируйте «Мой код получения» со стола заказчика.'));
    return;
  }
  if (token.coopname && token.coopname !== coopname.value) {
    FailAlert(new Error('Код выписан для другого кооператива.'));
    return;
  }
  const has = items.value.some(
    (o) => o.orderer_account === token.account && ISSUANCE_STATUSES.includes(o.status),
  );
  if (!has) {
    FailAlert(new Error(`У заказчика ${token.account} нет заказов на выдачу на этом пункте.`));
    return;
  }
  pickupAccount.value = token.account;
  pickupDialogOpen.value = true;
}

function onOpened(): void {
  void load();
}

watch(braname, () => void load());

onMounted(async () => {
  await store.ensureLoaded(coopname.value);
  void load();
});
</script>

<template lang="pug">
q-page.issuance(role='region', aria-label='Выдача заказов')
  OperatorBranchBar

  EmptyState(
    v-if='!store.loading && !store.isOperator',
    title='Вы не оператор кооперативного участка',
    body='Выдача заказов доступна председателю участка и его доверенным лицам.'
  )
    template(#icon)
      q-icon(name='storefront', size='48px')

  template(v-else)
    PageHint(storage-key='mp:operator-issuance:banner-dismissed')
      | Заказы сгруппированы по заказчикам — отсканируйте код получателя или
      | найдите его карточку и выдайте всё, что ему причитается. «Открыть выдачу»
      | оператор подтверждает подписью председателя, дальше заказчик подтвердит
      | получение сам в своём кабинете.

    .issuance__toolbar
      BaseButton(variant='secondary', @click='scanDialogOpen = true')
        template(#icon-left)
          q-icon(name='qr_code_scanner', size='16px')
        | Сканировать QR заказа

    .issuance__loading(v-if='loading && !items.length')
      q-spinner(size='28px', color='primary')

    .issuance__grid(v-else-if='groups.length')
      BaseCard.issuance__card(v-for='g in groups', :key='g.account')
        template(#head)
          .issuance__card-who
            Avatar(:name='g.name', size='md', tone='primary')
            .issuance__card-ident
              span.issuance__card-name {{ g.name }}
              AccountBadge(:account-name='g.account', size='sm')
        template(#actions)
          .issuance__card-meta
            BaseBadge(variant='neutral') Позиций: {{ g.count }}
            span.issuance__card-total {{ formatAsset2Digits(g.total) }} ₽

        //- К выдаче — оператор открывает выдачу.
        .issuance__section(v-if='g.toIssue.length')
          .issuance__section-head К выдаче
          .issuance__line(v-for='o in g.toIssue', :key='o.id')
            .issuance__line-info
              .issuance__line-name {{ o.product_name || 'Товар по предложению' }}
              .issuance__line-meta {{ o.quantity }} {{ marketplaceUnitShort(o.unit_of_measure) }} · {{ formatAsset2Digits(String(o.total_cost ?? '')) }} ₽
            BaseButton(variant='primary', size='sm', @click='startOpen(o)')
              template(#icon-left)
                q-icon(name='draw', size='16px')
              | Открыть выдачу

        //- Ждут получения — выдача открыта, ждём подпись заказчика.
        .issuance__section(v-if='g.awaiting.length')
          .issuance__section-head Ждут получения заказчиком
          .issuance__line(v-for='o in g.awaiting', :key='o.id')
            .issuance__line-info
              .issuance__line-name {{ o.product_name || 'Товар по предложению' }}
              .issuance__line-meta {{ o.quantity }} {{ marketplaceUnitShort(o.unit_of_measure) }} · {{ formatAsset2Digits(String(o.total_cost ?? '')) }} ₽
            BaseBadge(:variant='orderStatusDisplay(o.status).variant') {{ orderStatusDisplay(o.status).label }}

    EmptyState(
      v-else,
      title='Заказов на выдачу нет',
      body='Заказы, принятые кооперативом на ваш участок, появятся здесь для выдачи пайщикам.'
    )
      template(#icon)
        q-icon(name='inventory', size='48px')

  IssueActOpenDialog(
    v-model='openDialog',
    :order='selectedOrder',
    @opened='onOpened'
  )

  BaseDialog(v-model='scanDialogOpen', title='Сканирование QR заказа', size='sm')
    QrScanner(@scanned='onQrScanned')

  //- Все заказы заказчика на выдачу разом (резолв account-bound кода против ленты
  //- этого КУ). Оператор открывает их по одному — каждый шаг со своей подписью.
  BaseDialog(v-model='pickupDialogOpen', title='Выдача заказчику', size='sm')
    .issuance__resolve
      .issuance__resolve-account {{ pickupAccount }}
      .issuance__resolve-hint(v-if='pickupOrders.length') Готовы к выдаче на этом пункте:
      .issuance__resolve-empty(v-else) Все заказы этого заказчика уже выданы.
      .issuance__resolve-item(v-for='o in pickupOrders', :key='o.id')
        .issuance__resolve-item-info
          .issuance__resolve-item-title {{ o.product_name || 'Товар по предложению' }}
          .issuance__resolve-item-meta {{ o.quantity }} {{ marketplaceUnitShort(o.unit_of_measure) }} · {{ orderStatusDisplay(o.status).label }}
        BaseButton(
          v-if='o.status === "ACCEPTED_TO_COOP"',
          variant='primary',
          size='sm',
          @click='startIssuanceStep(o)'
        )
          template(#icon-left)
            q-icon(name='draw', size='16px')
          | Открыть
        .issuance__await(v-else-if='o.status === "READY_TO_RECEIVE"')
          q-icon(name='hourglass_empty', size='16px')
          | Ждём заказчика
</template>

<style scoped lang="scss">
.issuance {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__toolbar {
    display: flex;
    justify-content: flex-end;
  }

  &__loading {
    display: flex;
    justify-content: center;
    padding: var(--p-6, 24px);
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: var(--p-3, 12px);
  }

  &__card {
    height: 100%;

    :deep(.base-card__body) {
      display: flex;
      flex-direction: column;
      gap: var(--p-3, 12px);
    }
  }

  &__card-who {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
    min-width: 0;
  }

  &__card-ident {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__card-name {
    font-size: var(--p-fs-h3, 15px);
    font-weight: 600;
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__card-meta {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
  }

  &__card-total {
    font-family: var(--p-mono);
    font-weight: 600;
    color: var(--p-ink);
    font-variant-numeric: tabular-nums;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__section-head {
    font-size: var(--p-fs-meta, 12px);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--p-ink-3);
  }

  &__line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    padding: var(--p-2, 8px) var(--p-3, 12px);
    background: var(--p-surface-2);
    border-radius: var(--p-r-sm, 8px);
  }

  &__line-info {
    min-width: 0;
  }

  &__line-name {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__line-meta {
    font-size: var(--p-fs-meta, 12px);
    color: var(--p-ink-2);
    font-variant-numeric: tabular-nums;
  }

  &__resolve {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }

  &__resolve-account {
    font-size: var(--p-fs-body, 14px);
    font-weight: 600;
    color: var(--p-ink);
    font-family: var(--font-mono);
  }

  &__resolve-hint,
  &__resolve-empty {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
  }

  &__resolve-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    padding-top: var(--p-2, 8px);
    border-top: 1px solid var(--p-line);
  }

  &__resolve-item-info {
    min-width: 0;
  }

  &__resolve-item-title {
    font-size: var(--p-fs-body, 14px);
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__resolve-item-meta {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    font-variant-numeric: tabular-nums;
  }

  &__await {
    display: inline-flex;
    align-items: center;
    gap: var(--p-1, 4px);
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
    white-space: nowrap;
  }
}

@media (max-width: 768px) {
  .issuance {
    padding: var(--p-4, 16px);

    &__grid {
      grid-template-columns: 1fr;
    }
  }
}
</style>
