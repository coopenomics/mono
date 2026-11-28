<template lang="pug">
//- Кошелёк членских взносов кооператива у оператора — в шапке стола
//- «Приложения» (слово владельца 28.11.2026): остаток виден без входа в
//- кабинет оператора. Нажатие раскрывает панель: чей кошелёк, остаток, сумма
//- к списанию и «Пополнить» — переход в кабинет кооператива на сайте
//- оператора: пополнение проводится только там.
BaseButton.operator-wallet(v-if='visible', variant='secondary', size='sm', type='button')
  template(#icon-left)
    q-icon(name='account_balance_wallet', size='18px')
  | {{ $t('catalogApp.wallet.amount', { amount: formatRub(balance ?? 0) }) }}
  q-menu(anchor='bottom right', self='top right', :offset='[0, 8]')
    .operator-wallet__panel
      .operator-wallet__title {{ $t('catalogApp.wallet.title', { operator: operatorName }) }}
      p.operator-wallet__text {{ $t('catalogApp.wallet.text') }}
      DataRow(
        :label="$t('catalogApp.wallet.balance')",
        :value="$t('catalogApp.wallet.amount', { amount: formatRub(balance ?? 0) })",
        align='spread'
      )
      DataRow(
        v-if='dueAmount > 0',
        :label="$t('catalogApp.wallet.due')",
        :value="$t('catalogApp.wallet.amount', { amount: formatRub(dueAmount) })",
        align='spread'
      )
      DataRow(
        v-if='monthlyTotal > 0',
        :label="$t('catalogApp.wallet.monthly')",
        :value="$t('catalogApp.wallet.amount', { amount: formatRub(monthlyTotal) })",
        align='spread'
      )
      BaseButton.full-width(v-if='cabinetUrl', variant='primary', type='button', @click='openCabinet')
        template(#icon-left)
          q-icon(name='open_in_new', size='16px')
        | {{ $t('catalogApp.wallet.topUp') }}
      p.operator-wallet__text(v-else) {{ $t('catalogApp.wallet.noSite') }}
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { Ledger2Contract } from 'cooptypes';
import { BaseButton } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';
import { liveTable, useLiveReload } from 'src/shared/lib/realtime';
import { api as extensionApi } from 'src/entities/Extension/api';
import { useNetworkMode } from 'src/entities/System/model';
import { formatRub } from '../lib/presentation';
import { operatorCabinetUrl, rubOfAsset } from '../lib/operatorWallet';

/**
 * Остаток, наступившие позиции счёта и оператора узел читает одной сводкой
 * (`appsNodeBilling`). Узел без провайдера и узел самого оператора кошелька
 * у оператора не имеют — кнопки нет.
 */
const balance = ref<number | null>(null);
const dueAmount = ref(0);
const monthlyTotal = ref(0);
const operator = ref<string | null>(null);
const site = ref<string | null>(null);

const { operator: chainOperator } = useNetworkMode();
const hasOperator = computed(() => !!chainOperator.value);
const visible = computed(() => hasOperator.value && balance.value !== null && !!operator.value);
const operatorName = computed(() => (operator.value ?? '').toUpperCase());
const cabinetUrl = computed(() => operatorCabinetUrl(site.value, operator.value));

async function load(): Promise<void> {
  // Кооператив без оператора держит установку сам: кошелька у оператора нет.
  if (!hasOperator.value) {
    balance.value = null;
    return;
  }
  try {
    const billing = await extensionApi.loadAppsNodeBilling();
    balance.value = billing.available ? rubOfAsset(billing.wallet?.membershipAvailable) : null;
    dueAmount.value = billing.dueAmount;
    monthlyTotal.value = billing.monthlyTotal;
    operator.value = billing.operator ?? null;
    site.value = billing.operatorSite ?? null;
  } catch {
    // Сводка недоступна (нет права, провайдер не ответил) — кнопка скрыта.
    balance.value = null;
  }
}

function openCabinet(): void {
  if (cabinetUrl.value) window.open(cabinetUrl.value, '_blank', 'noopener');
}

// Живое обновление: пополнение и списание меняют строку кошелька в цепи.
useLiveReload([liveTable(Ledger2Contract, Ledger2Contract.Tables.UserWallets)], load);
onMounted(load);
</script>

<style scoped>
.operator-wallet__panel {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  width: 320px;
  max-width: calc(100vw - var(--p-8));
  padding: var(--p-4);
}
.operator-wallet__title {
  font-size: var(--p-fs-h3);
  font-weight: 600;
  line-height: var(--p-lh-h3);
  color: var(--p-ink);
}
.operator-wallet__text {
  margin: 0;
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-2);
}
</style>
