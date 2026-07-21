<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Classes, Queries, Zeus } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { useGlobalStore } from 'src/shared/store';
import { BaseBadge, BaseButton } from 'src/shared/ui/base';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace';
import {
  createStockProposal,
  cancelStockProposal,
  getStockIssuancePayloads,
  listStockProposals,
  type MarketplaceStockProposalView,
} from 'src/pages/Marketplace/OperatorIssuance/api';

const globalStore = useGlobalStore();

/**
 * Докладка у стойки выдачи (requirement 76): оператор накидывает пайщику
 * опубликованный остаток склада своего КУ. Пайщику немедленно уходит
 * предложение (websocket) — принимает он сам в своём кабинете; здесь виден
 * live-статус, и до решения пайщика предложение можно отозвать и
 * переформировать.
 */
const props = defineProps<{
  braname: string;
  memberAccount: string;
}>();

type CoopStockOffer = {
  id: string;
  product_name: string;
  price_per_unit: string;
  quantity_available: number;
  stock_braname: string | null;
};

const offers = ref<CoopStockOffer[]>([]);
const offersLoading = ref(false);
const quantities = ref<Record<string, number>>({});
const sending = ref(false);
const proposals = ref<MarketplaceStockProposalView[]>([]);

const activeProposals = computed(() =>
  proposals.value.filter(
    (p) => p.member_account === props.memberAccount && p.status === 'PROPOSED',
  ),
);

const composedLines = computed(() =>
  offers.value
    .map((o) => ({ offer: o, quantity: quantities.value[o.id] ?? 0 }))
    .filter((l) => l.quantity > 0),
);
const composedTotal = computed(() =>
  composedLines.value
    .reduce((sum, l) => sum + l.quantity * Number.parseFloat(l.offer.price_per_unit), 0)
    .toFixed(4),
);

async function loadOffers(): Promise<void> {
  offersLoading.value = true;
  try {
    const { [Queries.Marketplace.ListCatalog.name]: page } = await client.Query(
      Queries.Marketplace.ListCatalog.query,
      { variables: { input: { delivery_braname: props.braname, page: 1, limit: 200 } } },
    );
    // Со стойки докладываются только предложения кооператива СО СКЛАДА этого КУ.
    offers.value = (page.items as CoopStockOffer[]).filter(
      (o) => o.stock_braname === props.braname && o.quantity_available > 0,
    );
  } catch (e) {
    FailAlert(e);
  } finally {
    offersLoading.value = false;
  }
}

async function loadProposals(): Promise<void> {
  try {
    proposals.value = await listStockProposals({
      braname: props.braname,
      statuses: [Zeus.MarketplaceStockProposalStatus.PROPOSED],
    });
  } catch {
    proposals.value = [];
  }
}

function bump(offer: CoopStockOffer, delta: number): void {
  const current = quantities.value[offer.id] ?? 0;
  const next = Math.max(0, Math.min(offer.quantity_available, current + delta));
  quantities.value = { ...quantities.value, [offer.id]: next };
}

async function sendProposal(): Promise<void> {
  const wifKey = globalStore.wif?.toString();
  if (!wifKey) {
    FailAlert(new Error('Приватный ключ не найден. Войдите в кооператив.'));
    return;
  }
  sending.value = true;
  try {
    // Двухфазно (канон — см. IssueActOpenDialog.vue): сначала бэк готовит по
    // каждой строке order_hash + акт приёма-передачи (signiss1_document),
    // затем оператор подписывает его локально своим ключом (первая подпись
    // АПП-выдачи) — и только с готовой подписью бандл уходит на создание
    // предложения. До подписи пайщика в блокчейне ничего не происходит.
    const docSigner = new Classes.Document(wifKey);
    const payloads = await getStockIssuancePayloads({
      braname: props.braname,
      member_account: props.memberAccount,
      items: composedLines.value.map((l) => ({ offer_id: l.offer.id, quantity: l.quantity })),
    });
    const items = await Promise.all(
      payloads.map(async (p) => ({
        offer_id: p.offer_id,
        quantity: p.quantity,
        order_hash: p.order_hash,
        signiss1_act: await docSigner.signDocument(p.signiss1_document, globalStore.username, 1),
      })),
    );
    await createStockProposal({
      braname: props.braname,
      member_account: props.memberAccount,
      items,
    });
    SuccessAlert('Предложение отправлено — у пайщика всплыло окно решения.');
    quantities.value = {};
    await loadProposals();
  } catch (e) {
    FailAlert(e);
  } finally {
    sending.value = false;
  }
}

async function withdraw(p: MarketplaceStockProposalView): Promise<void> {
  try {
    await cancelStockProposal(p.id);
    SuccessAlert('Предложение отозвано — можно переформировать.');
    await loadProposals();
  } catch (e) {
    FailAlert(e);
  }
}

// Live: пайщик принял/отказался → статус у стойки обновляется немедленно;
// принятие также создаёт заказы — родительская лента перечитается сама.
useMarketplaceRealtime(
  {
    MarketplaceStockProposalResolvedEvent: () => {
      void loadProposals();
      void loadOffers();
    },
  },
  { onResync: () => void loadProposals() },
);

onMounted(() => {
  void loadOffers();
  void loadProposals();
});
watch(
  () => props.memberAccount,
  () => {
    quantities.value = {};
    void loadProposals();
  },
);
</script>

<template lang="pug">
.restock(v-if='offers.length || activeProposals.length')
  .restock__title
    q-icon(name='add_shopping_cart', size='18px')
    span Доложить со склада кооператива

  //- Уже отправленное предложение: live-статус + отзыв до решения пайщика.
  .restock__pending(v-for='p in activeProposals', :key='p.id')
    .restock__pending-info
      span.restock__pending-label Ожидает решения пайщика
      span.restock__pending-items {{ p.items.map((i) => `${i.product_name} ×${i.quantity}`).join(', ') }}
      span.restock__pending-total {{ formatAsset2Digits(p.total_cost) }} ₽
    BaseButton(variant='ghost', size='sm', @click='withdraw(p)') Отозвать

  //- Накидка нового предложения из опубликованного остатка этого КУ.
  template(v-if='!activeProposals.length')
    .restock__offer(v-for='o in offers', :key='o.id')
      .restock__offer-info
        span.restock__offer-name {{ o.product_name }}
        span.restock__offer-meta
          | {{ formatAsset2Digits(o.price_per_unit) }} ₽ · свободно {{ o.quantity_available }}
      .restock__offer-qty
        BaseButton(variant='ghost', size='sm', :disabled='!(quantities[o.id] ?? 0)', @click='bump(o, -1)')
          q-icon(name='remove', size='16px')
        span.restock__offer-count {{ quantities[o.id] ?? 0 }}
        BaseButton(
          variant='ghost',
          size='sm',
          :disabled='(quantities[o.id] ?? 0) >= o.quantity_available',
          @click='bump(o, 1)'
        )
          q-icon(name='add', size='16px')

    .restock__send(v-if='composedLines.length')
      span.restock__send-total Итого: {{ formatAsset2Digits(composedTotal) }} ₽
      BaseButton(variant='primary', size='sm', :loading='sending', @click='sendProposal')
        template(#icon-left)
          q-icon(name='send', size='16px')
        | Предложить пайщику

  .restock__hint(v-if='!offers.length && !activeProposals.length && !offersLoading')
    BaseBadge(variant='neutral', size='sm') Опубликованного остатка на этом пункте нет
</template>

<style scoped lang="scss">
.restock {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
  padding-top: var(--p-3, 12px);
  border-top: 1px solid var(--p-line);

  &__title {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    font-weight: 600;
    color: var(--p-ink);

    .q-icon {
      color: var(--p-primary);
    }
  }

  &__pending {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--p-2, 8px);

    &-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    &-label {
      font-size: var(--p-fs-meta, 12px);
      color: var(--p-warn);
      font-weight: 600;
    }

    &-items {
      font-size: var(--p-fs-body-sm, 13px);
      color: var(--p-ink);
      overflow-wrap: anywhere;
    }

    &-total {
      font-size: var(--p-fs-body-sm, 13px);
      color: var(--p-ink-2);
      font-variant-numeric: tabular-nums;
    }
  }

  &__offer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-2, 8px);

    &-info {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
    }

    &-name {
      font-size: var(--p-fs-body-sm, 13px);
      color: var(--p-ink);
      overflow-wrap: anywhere;
    }

    &-meta {
      font-size: var(--p-fs-meta, 12px);
      color: var(--p-ink-3);
      font-variant-numeric: tabular-nums;
    }

    &-qty {
      display: flex;
      align-items: center;
      gap: var(--p-1, 4px);
      flex: 0 0 auto;
    }

    &-count {
      min-width: 24px;
      text-align: center;
      font-variant-numeric: tabular-nums;
      color: var(--p-ink);
    }
  }

  &__send {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-2, 8px);

    &-total {
      font-weight: 600;
      color: var(--p-ink);
      font-variant-numeric: tabular-nums;
    }
  }

  &__hint {
    display: flex;
  }
}
</style>
