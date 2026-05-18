<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { FailAlert } from 'src/shared/api';
import {
  listReturnClaimsByBraname,
  type MarketplaceReturnClaimView,
} from '../api';
import RemoteDecisionDialog from './RemoteDecisionDialog.vue';
import OnSiteDecisionDialog from './OnSiteDecisionDialog.vue';

/**
 * Story 7.2-7.4 — operator-стол председателя КУ: лента заявлений на
 * гарантийный возврат, привязанных к delivery_braname исходного заказа.
 *
 * - PENDING_CHAIRMAN_REVIEW → RemoteDecisionDialog (одобрить очный визит /
 *   отказать удалённо).
 * - APPROVED_FOR_VISIT      → OnSiteDecisionDialog (BarcodeScanner +
 *   inspection_result + accept / reject; accept атомарно выполняет
 *   compensating forward `o.mkt.return + o.mkt.return2`).
 */

const braname = ref<string>('');
const items = ref<MarketplaceReturnClaimView[]>([]);
const loading = ref(false);

const remoteDialog = ref(false);
const onSiteDialog = ref(false);
const selectedClaim = ref<MarketplaceReturnClaimView | null>(null);

const pendingClaims = computed(() =>
  items.value.filter((c) => c.status === 'PENDING_CHAIRMAN_REVIEW'),
);
const approvedClaims = computed(() =>
  items.value.filter((c) => c.status === 'APPROVED_FOR_VISIT'),
);
const archiveClaims = computed(() =>
  items.value.filter(
    (c) =>
      c.status === 'ACCEPTED_AT_VISIT' ||
      c.status === 'REJECTED_REMOTELY' ||
      c.status === 'REJECTED_AT_VISIT',
  ),
);

async function load(): Promise<void> {
  if (!braname.value.trim()) return;
  loading.value = true;
  try {
    items.value = await listReturnClaimsByBraname({ delivery_braname: braname.value.trim() });
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить заявления на возврат');
  } finally {
    loading.value = false;
  }
}

function startRemote(claim: MarketplaceReturnClaimView): void {
  selectedClaim.value = claim;
  remoteDialog.value = true;
}

function startOnSite(claim: MarketplaceReturnClaimView): void {
  selectedClaim.value = claim;
  onSiteDialog.value = true;
}

function onDecided(): void {
  void load();
}

/**
 * Безопасное форматирование даты, приходящей из Zeus как `unknown`
 * (GraphQL DateTime скаляр не зарегистрирован в Zeus-резолвере). Принимаем
 * `unknown`, конвертируем в строку через `String()` и парсим — формат
 * сервера ISO 8601, поэтому `new Date(<iso>)` валиден.
 */
function formatDateTime(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('ru-RU');
}

function humanStatus(status: MarketplaceReturnClaimView['status']): string {
  switch (status) {
    case 'PENDING_CHAIRMAN_REVIEW':
      return 'Ждёт удалённого рассмотрения';
    case 'APPROVED_FOR_VISIT':
      return 'Очный визит одобрен';
    case 'ACCEPTED_AT_VISIT':
      return 'Возврат принят';
    case 'REJECTED_REMOTELY':
      return 'Отказано удалённо';
    case 'REJECTED_AT_VISIT':
      return 'Отказано на месте';
    default:
      return status;
  }
}

onMounted(() => {
  // braname придёт из current member operator-роли при подключении к
  // роутингу (на текущей фазе оператор задаёт КУ вручную в поле ввода).
});
</script>

<template lang="pug">
q-page.mp-role-operator.mp-return-operator.q-pa-md
  .text-h6.q-mb-sm Гарантийный возврат — рассмотрение заявлений
  .row.q-mb-md.q-gutter-md
    q-input.col-3(v-model="braname" dense outlined label="ID кооперативного участка")
    q-btn(no-caps color="primary" :loading="loading" label="Загрузить заявления" @click="load")

  .text-subtitle1.q-mb-sm.text-primary Ждут удалённого рассмотрения ({{ pendingClaims.length }})
  q-list(v-if="pendingClaims.length > 0" bordered separator).q-mb-md
    q-item(v-for="c in pendingClaims" :key="c.id")
      q-item-section
        q-item-label.text-weight-medium Заказ {{ c.order_id.slice(0, 8) }} · заказчик {{ c.orderer_account }}
        q-item-label(caption) {{ c.actual_quantity }} ед. · {{ c.fact_cost }} ₽
        q-item-label(caption) {{ c.reason_text.slice(0, 240) }}{{ c.reason_text.length > 240 ? '…' : '' }}
        q-item-label(caption v-if="c.defect_category")
          | Категория: {{ c.defect_category }}
        .row.q-mt-xs.q-gutter-sm
          a.mp-return-operator__thumb(
            v-for="(p, i) in c.photos" :key="p.content_hash"
            :href="p.url" target="_blank" rel="noopener"
          )
            img(:src="p.url" :alt="`Фото ${i + 1}`")
      q-item-section(side)
        q-btn(unelevated no-caps color="primary" icon="fa-solid fa-gavel" label="Принять решение" @click="startRemote(c)")
  q-card(v-else flat bordered).q-pa-md.q-mb-md
    .text-grey Нет заявлений, ожидающих удалённого рассмотрения.

  .text-subtitle1.q-mb-sm.text-warning Ожидают очного визита ({{ approvedClaims.length }})
  q-list(v-if="approvedClaims.length > 0" bordered separator).q-mb-md
    q-item(v-for="c in approvedClaims" :key="c.id")
      q-item-section
        q-item-label.text-weight-medium Заказ {{ c.order_id.slice(0, 8) }} · заказчик {{ c.orderer_account }}
        q-item-label(caption) Возврат на сумму {{ c.fact_cost }} ₽
        q-item-label(caption) Дата одобрения: {{ c.decision_log.length > 0 ? formatDateTime(c.decision_log[c.decision_log.length - 1].at) : '—' }}
      q-item-section(side)
        q-btn(unelevated no-caps color="accent" icon="fa-solid fa-clipboard-check" label="Очный осмотр" @click="startOnSite(c)")
  q-card(v-else flat bordered).q-pa-md.q-mb-md
    .text-grey Нет заявлений, по которым ожидается очный визит.

  .text-subtitle1.q-mb-sm.text-grey Архив ({{ archiveClaims.length }})
  q-list(v-if="archiveClaims.length > 0" bordered separator)
    q-item(v-for="c in archiveClaims" :key="c.id")
      q-item-section
        q-item-label Заказ {{ c.order_id.slice(0, 8) }} · {{ c.orderer_account }}
        q-item-label(caption) {{ humanStatus(c.status) }}{{ c.ledger_snapshot ? ` · ${c.ledger_snapshot.amount} ₽ восстановлено` : '' }}
  q-card(v-else flat bordered).q-pa-md
    .text-grey Архив пуст.

  RemoteDecisionDialog(
    v-model="remoteDialog"
    :claim="selectedClaim"
    :braname="braname"
    @decided="onDecided"
  )
  OnSiteDecisionDialog(
    v-model="onSiteDialog"
    :claim="selectedClaim"
    :braname="braname"
    @decided="onDecided"
  )
</template>

<style scoped lang="scss">
.mp-return-operator {
  display: flex;
  flex-direction: column;
  gap: var(--mp-space-md);

  &__thumb {
    display: inline-block;
    width: 56px;
    height: 56px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 6px;
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
}
</style>
