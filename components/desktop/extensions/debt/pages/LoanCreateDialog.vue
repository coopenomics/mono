<template lang="pug">
BaseDialog(
  :model-value='modelValue',
  :title='$t("debt.createDialog.title")',
  size='md',
  @update:model-value='$emit("update:modelValue", $event)'
)
  .loan-form
    //- До конца загрузки — каркас, а не «обеспечение недоступно».
    q-skeleton(v-if='loading', type='rect', height='180px')

    EmptyState(
      v-else-if='!available.length',
      :title='$t("debt.createDialog.noCollateralTitle")',
      :body='$t("debt.createDialog.noCollateralBody")'
    )
      template(#icon)
        q-icon(name='account_balance_wallet', size='40px')

    //- Заём перечисляют по реквизитам пайщика: без них форму заполнять рано.
    EmptyState(
      v-else-if='!hasMethods',
      :title='$t("debt.createDialog.noMethodsTitle")',
      :body='$t("debt.createDialog.noMethodsBody")'
    )
      template(#icon)
        q-icon(name='account_balance', size='40px')
      template(#action)
        BaseButton(variant='primary', @click='goToMethods') {{ $t('debt.createDialog.noMethodsAction') }}

    template(v-else)
      BaseSelect(
        v-model='form.collateral',
        :options='collateralOptions',
        :label='$t("debt.createDialog.collateralLabel")',
        required
      )
      LoanFacts(:items='facts')
      AmountInput(
        v-model='form.amount',
        :symbol='symbol',
        :precision='2',
        :label='$t("debt.createDialog.amountLabel")',
        :balance='maxAmount',
        :max='maxAmount',
        show-max
      )
      BaseInput(
        v-model='form.due',
        type='date',
        :label='$t("debt.createDialog.dueLabel")',
        required
      )
      PaymentMethodSelect(
        v-model='form.method_id',
        :username='session.username',
        :label='$t("debt.createDialog.methodLabel")',
        required
      )
      p.loan-form__terms {{ $t('debt.createDialog.terms') }}

  template(#footer)
    .loan-form__footer
      BaseButton(variant='ghost', @click='close') {{ $t('common.action.cancel') }}
      BaseButton(
        v-if='formReady',
        variant='primary',
        :loading='submitting',
        :disabled='!canSubmit',
        @click='submit'
      ) {{ $t('debt.createDialog.submitLabel') }}
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Ledger2Contract } from 'cooptypes';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { liveTable, useLiveReload } from 'src/shared/lib/realtime';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { api as walletApi } from 'src/entities/Wallet';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { BaseInput } from 'src/shared/ui/base/BaseInput';
import { BaseSelect } from 'src/shared/ui/base/BaseSelect';
import type { BaseSelectOption } from 'src/shared/ui/base/BaseSelect';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { AmountInput } from 'src/shared/ui/domain/AmountInput';
import { PaymentMethodSelect } from 'src/shared/ui/domain/PaymentMethodSelect';
import { getCollateralOptions, type ICollateralOption } from '../api';
import { collateralLabel, defaultDueDate, formatAmount, useLoanActions } from '../model';
import LoanFacts from '../widgets/LoanFacts.vue';
import { t } from '../i18n';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'created'): void;
}>();

const system = useSystemStore();
const session = useSessionStore();
const { submitLoan } = useLoanActions();
const router = useRouter();
const route = useRoute();

const symbol = computed(() => system.governSymbol);
const precision = computed(() => system.governPrecision);

const loading = ref(true);
const submitting = ref(false);
const options = ref<ICollateralOption[]>([]);
const hasMethods = ref(false);

const form = reactive({
  collateral: null as string | null,
  amount: null as number | null,
  due: defaultDueDate(),
  method_id: null as string | null,
});

const balanceOf = (option: ICollateralOption): number => parseFloat(option.available || '0') || 0;

// Обеспечение доступно, когда основание подписано и на кошельке программы есть средства.
const available = computed(() => options.value.filter((o) => o.basis_signed && balanceOf(o) > 0));

const collateralOptions = computed<BaseSelectOption[]>(() =>
  available.value.map((o) => ({
    value: o.key,
    label: collateralLabel(o.key),
    caption: t('debt.createDialog.collateralAvailable', { amount: formatAmount(o.available) }),
  })),
);

const formReady = computed(() => !loading.value && available.value.length > 0 && hasMethods.value);

const selected = computed(() => available.value.find((o) => o.key === form.collateral) ?? null);
const maxAmount = computed(() => (selected.value ? balanceOf(selected.value) : 0));
const facts = computed(() => [
  { label: t('debt.createDialog.availableLabel'), value: formatAmount(selected.value?.available) },
]);

const today = new Date().toISOString().slice(0, 10);

const canSubmit = computed(
  () =>
    Boolean(selected.value) &&
    form.amount !== null &&
    form.amount > 0 &&
    form.amount <= maxAmount.value &&
    form.due > today &&
    Boolean(form.method_id) &&
    !submitting.value,
);

// silent — дочитка по ленте изменений: без каркаса и без сброса введённого.
async function load(silent = false): Promise<void> {
  try {
    if (!silent) loading.value = true;
    const [collaterals, methods] = await Promise.all([
      getCollateralOptions(system.info.coopname),
      walletApi.loadMethods({ username: session.username }),
    ]);
    options.value = collaterals;
    hasMethods.value = methods.length > 0;
    if (!form.collateral && available.value.length === 1) form.collateral = available.value[0].key;
  } catch (e) {
    if (!silent) FailAlert(e);
  } finally {
    loading.value = false;
  }
}

// Остатки кошельков пайщика меняются и при открытом окне — перечитываем по ленте изменений.
useLiveReload([liveTable(Ledger2Contract, Ledger2Contract.Tables.UserWallets)], () => {
  if (props.modelValue && !submitting.value) void load(true);
});

watch(
  () => props.modelValue,
  (open) => {
    if (open) void load();
  },
  { immediate: true },
);

function close(): void {
  emit('update:modelValue', false);
}

function goToMethods(): void {
  close();
  void router.push({ name: 'payment-methods', params: { coopname: route.params.coopname } });
}

async function submit(): Promise<void> {
  if (!selected.value || form.amount === null || !form.method_id) return;
  try {
    submitting.value = true;
    await submitLoan({
      collateral: selected.value.key,
      amount: form.amount,
      symbol: symbol.value,
      precision: precision.value,
      due: form.due,
      method_id: form.method_id,
    });
    SuccessAlert(t('debt.createDialog.submittedMessage'));
    form.amount = null;
    emit('created');
    close();
  } catch (e) {
    FailAlert(e);
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped lang="scss">
.loan-form {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.loan-form__terms {
  margin: 0;
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
}

.loan-form__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--p-2);
}
</style>
