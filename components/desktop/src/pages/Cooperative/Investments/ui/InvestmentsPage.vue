<template>
  <div class="q-pa-md">
    <div class="banner banner--info q-mb-md">
      <q-icon name="info" class="banner__icon" />
      <div class="banner__body">
        Инвестирование средств кооператива в целевую потребительскую программу
        «Благорост» кооператива-оператора выполняется по решению совета: после
        одобрения заявления кассир оплачивает счёт оператора из реестра
        платежей, а инвестиция учитывается на счёте 58 «Финансовые вложения».
        Завершает размещение средств в программе председатель — в личном
        кабинете на платформе оператора.
      </div>
    </div>

    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-md-4">
        <WalletCard
          neutral
          title="Финансовые вложения"
          subtitle="Счёт 58 кооператива"
          icon="trending_up"
          :balance="localInvestmentsBalance"
          :symbol="currency"
          balance-label="Инвестировано"
          :loading="loadingLocal"
        />
      </div>
      <div class="col-12 col-md-4">
        <WalletCard
          program="wallet"
          title="Кошелёк у оператора"
          subtitle="Главный кошелёк кооператива"
          :balance="operatorMainBalance"
          :symbol="currency"
          :loading="loadingOperator"
          :empty="!operatorAvailable"
        />
      </div>
      <div class="col-12 col-md-4">
        <WalletCard
          program="blagorost"
          title="Благорост у оператора"
          subtitle="ЦПП кооператива-оператора"
          :balance="operatorBlagorostBalance"
          :symbol="currency"
          :loading="loadingOperator"
          :empty="!operatorAvailable"
        />
      </div>
    </div>

    <BaseBanner
      v-if="operatorError"
      variant="warn"
      class="q-mb-md"
    >
      Бэкенд оператора недоступен: балансы кошельков у оператора временно не
      отображаются. Локальные данные актуальны.
    </BaseBanner>

    <TableSkeleton
      v-if="loadingPayments && !payments.length"
      :columns="[
        { label: 'Дата', width: '120px' },
        { label: 'Сумма', width: '140px' },
        { label: 'Статус', cell: 'badge', width: '140px' },
        { label: 'Назначение' },
      ]"
    />

    <EmptyState
      v-else-if="!payments.length"
      title="Инвестиций пока нет"
      body="Создайте заявление об инвестировании — оно будет рассмотрено советом кооператива."
    >
      <template #icon>
        <q-icon name="trending_up" />
      </template>
    </EmptyState>

    <div v-else class="table-wrap">
      <div class="table-scroll">
        <table class="table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Сумма</th>
              <th>Статус</th>
              <th>Назначение</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in payments" :key="String(row.hash ?? row.id ?? '')">
              <td>{{ formatDate(row.created_at) }}</td>
              <td class="t-mono">{{ row.formatted_amount }}</td>
              <td>
                <BaseBadge :variant="getStatusVariant(row.status)">{{ row.status_label }}</BaseBadge>
              </td>
              <td>{{ row.memo }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { WalletCard } from 'src/shared/ui/domain';
import { BaseBadge, BaseBanner, EmptyState, TableSkeleton } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge';
import { useHeaderActions } from 'src/shared/hooks';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { ledger2Api } from 'src/entities/Ledger2/api';
import { api as paymentApi } from 'src/entities/Payment/api';
import type { IPayment } from 'src/entities/Payment/model/types';
import { Zeus } from '@coopenomics/sdk';
import { env } from 'src/shared/config';
import {
  CooperativeInvestButton,
  useCooperativeInvest,
  type IOperatorWallet,
} from 'src/features/Wallet/CooperativeInvest';

const session = useSessionStore();
const { info } = useSystemStore();
const { registerAction } = useHeaderActions();
const { getOperatorWallets } = useCooperativeInvest();

const currency = computed(() => env.CURRENCY as string);

const loadingLocal = ref(true);
const loadingOperator = ref(true);
const loadingPayments = ref(true);
const operatorError = ref(false);

const localInvestmentsBalance = ref('0.00');
const operatorWallets = ref<IOperatorWallet[]>([]);
const payments = ref<IPayment[]>([]);

const operatorAvailable = computed(() => !operatorError.value && operatorWallets.value.length > 0);

// Идентификаторы программ на платформе оператора: 1 — главный кошелёк (ЦК), 4 — Благорост
const OPERATOR_MAIN_PROGRAM_ID = '1';
const OPERATOR_BLAGOROST_PROGRAM_ID = '4';

const operatorMainBalance = computed(() => extractAmount(findOperatorWallet(OPERATOR_MAIN_PROGRAM_ID)?.available));
const operatorBlagorostBalance = computed(() =>
  extractAmount(findOperatorWallet(OPERATOR_BLAGOROST_PROGRAM_ID)?.available),
);

function findOperatorWallet(program_id: string): IOperatorWallet | undefined {
  return operatorWallets.value.find((w) => String(w.program_id) === program_id);
}

function extractAmount(asset?: string | null): string {
  if (!asset) return '0.00';
  return asset.split(' ')[0] || '0.00';
}

const statusVariants: Record<string, BaseBadgeVariant> = {
  [Zeus.PaymentStatus.COMPLETED]: 'pos',
  [Zeus.PaymentStatus.PENDING]: 'warn',
  [Zeus.PaymentStatus.FAILED]: 'neg',
  [Zeus.PaymentStatus.PAID]: 'info',
  [Zeus.PaymentStatus.REFUNDED]: 'neutral',
  [Zeus.PaymentStatus.EXPIRED]: 'neutral',
  [Zeus.PaymentStatus.AWAITING_AUTHORIZATION]: 'info',
  [Zeus.PaymentStatus.CANCELLED]: 'neutral',
};

const getStatusVariant = (status?: string | null): BaseBadgeVariant => {
  if (!status) return 'neutral';
  return statusVariants[status] || 'neutral';
};

function formatDate(value: unknown): string {
  if (!value) return '—';
  return new Date(String(value)).toLocaleDateString('ru-RU');
}

async function loadLocalBalance() {
  loadingLocal.value = true;
  try {
    const accounts = await ledger2Api.getAccounts(info.coopname);
    const financialInvestments = accounts.find((a) => Number(a.id) === 58);
    localInvestmentsBalance.value = extractAmount(financialInvestments?.balance);
  } catch (e) {
    console.error('Не удалось загрузить балансы ledger2', e);
  } finally {
    loadingLocal.value = false;
  }
}

async function loadOperatorWallets() {
  loadingOperator.value = true;
  operatorError.value = false;
  try {
    operatorWallets.value = await getOperatorWallets();
  } catch (e) {
    console.error('Бэкенд оператора недоступен', e);
    operatorError.value = true;
  } finally {
    loadingOperator.value = false;
  }
}

async function loadPayments() {
  loadingPayments.value = true;
  try {
    const result = await paymentApi.loadPayments(
      { coopname: info.coopname, type: Zeus.PaymentType.COOPERATIVE_INVESTMENT },
      { page: 1, limit: 100, sortBy: 'created_at', sortOrder: 'DESC' },
    );
    payments.value = result?.items ?? [];
  } catch (e) {
    console.error('Не удалось загрузить платежи', e);
  } finally {
    loadingPayments.value = false;
  }
}

function refresh() {
  void loadLocalBalance();
  void loadOperatorWallets();
  void loadPayments();
}

onMounted(() => {
  if (session.isChairman) {
    registerAction({
      id: 'cooperative-invest',
      component: CooperativeInvestButton,
      props: { onCreated: () => refresh() },
      order: 1,
    });
  }
  refresh();
});
</script>
