<template lang="pug">
BaseCard(variant="default" title="Кошелёк программы")
  DataRow(label="Остаток" :value="formatAsset2Digits(balance?.available ?? '')" align="spread")
  DataRow(v-if="hasPending" label="Заявлено к возврату" :value="formatAsset2Digits(balance?.pending ?? '')" align="spread")
  .t-sm.t-muted.q-mt-sm
    | Остаток зачитывается при следующей подписке. Вернуть его в паевой взнос можно по заявлению —
    | кооператив согласует его, и средства перейдут в Цифровой Кошелёк.
  .row.justify-end.q-mt-md
    BaseButton(variant="secondary" size="sm" :disabled="!canRequest" @click="open") Вернуть в паевой взнос

  BaseTable.q-mt-md(v-if="requests.length" :columns="columns" :rows="requests" row-key="id" min-width="480px")
    template(#cell-created_at="{ row }") {{ formatDate(row.created_at) }}
    template(#cell-amount="{ row }") {{ formatAsset2Digits(row.amount) }}
    template(#cell-status="{ row }")
      BaseBadge(:variant="statusOf(row.status).variant") {{ statusOf(row.status).label }}
      .t-meta.t-muted(v-if="row.decline_reason") {{ row.decline_reason }}

  BaseDialog(v-model="dialogOpen" title="Вернуть в паевой взнос" size="sm")
    BaseForm(:loading="busy" @submit="onSubmit")
      AmountInput(
        v-model="amount"
        label="Сумма возврата"
        :symbol="symbol"
        :precision="PRECISION"
        :balance="freeNumber"
        :max="freeNumber"
        show-max
        show-balance
      )
      .t-sm.t-muted.q-mt-sm Вы подпишете заявление о возврате членского взноса в паевой взнос. Средства перейдут после согласования кооперативом.
      template(#footer)
        .row.justify-end.q-gutter-sm
          BaseButton(variant="ghost" type="button" :disabled="busy" @click="dialogOpen = false") Отменить
          BaseButton(variant="primary" type="submit" :loading="busy" :disabled="!amountValid") Подписать заявление
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseButton, BaseCard, BaseDialog, BaseForm, BaseTable, type BaseTableColumn } from 'src/shared/ui/base';
import { AmountInput, DataRow } from 'src/shared/ui/domain';
import { buildReturnStatement, fetchMyReturnRequests, fetchReturnBalance, requestReturn } from '../api';
import { RETURN_STATUS_LABELS, type IReturnBalance, type IReturnRequest } from '../model';

/**
 * Остаток кошелька программы и путь обратно в паевой взнос. Положение ЦПП
 * требует заявления участника и согласования кооператива, поэтому кнопка
 * подаёт заявление, а не переводит средства.
 */
const PRECISION = 4;

const system = useSystemStore();
const symbol = computed(() => system.governSymbol);

const balance = ref<IReturnBalance | null>(null);
const requests = ref<IReturnRequest[]>([]);
const dialogOpen = ref(false);
const busy = ref(false);
const amount = ref<number | string | null>(null);

const columns: BaseTableColumn<IReturnRequest>[] = [
  { key: 'created_at', label: 'Подано', width: '120px', nowrap: true },
  { key: 'amount', label: 'Сумма', numeric: true, width: '140px', nowrap: true },
  { key: 'status', label: 'Состояние' },
];

const toNumber = (asset: string | null | undefined) => Number.parseFloat(String(asset ?? '0')) || 0;
const freeNumber = computed(() => toNumber(balance.value?.free));
const hasPending = computed(() => toNumber(balance.value?.pending) > 0);
const canRequest = computed(() => freeNumber.value > 0);
const amountNumber = computed(() => Number(amount.value) || 0);
const amountValid = computed(() => amountNumber.value > 0 && amountNumber.value <= freeNumber.value);

const statusOf = (s: string) => RETURN_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const formatDate = (v: unknown) => new Date(String(v)).toLocaleDateString('ru-RU');

async function load(): Promise<void> {
  try {
    const [b, r] = await Promise.all([fetchReturnBalance(), fetchMyReturnRequests()]);
    balance.value = b;
    requests.value = r;
  } catch (e) {
    FailAlert(e);
  }
}

function open(): void {
  amount.value = freeNumber.value;
  dialogOpen.value = true;
}

async function onSubmit(): Promise<void> {
  if (!amountValid.value) return;
  busy.value = true;
  try {
    const asset = `${amountNumber.value.toFixed(PRECISION)} ${symbol.value}`;
    const statement = await buildReturnStatement(asset);
    const created = await requestReturn(asset, statement);
    requests.value = [created, ...requests.value];
    balance.value = await fetchReturnBalance();
    dialogOpen.value = false;
    SuccessAlert('Заявление подано — кооператив согласует возврат');
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>
