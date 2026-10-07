<template lang="pug">
//- Возврат паевого взноса одной кнопкой: сумма и реквизиты, два заявления
//- подписываются разом. Без реквизитов — ссылка туда, где их завести.
BaseDialog(:model-value="modelValue" :title="$t('edubridge.shareReturn.title')" size="sm" @update:model-value="(v) => $emit('update:modelValue', v)")
  AmountInput(
    v-model="amount"
    :label="$t('edubridge.shareReturn.amountLabel')"
    :symbol="symbol"
    :precision="2"
    :min="0"
    :max="available"
    :balance="available"
    show-max
    show-balance
    :disabled="busy"
  )
  BaseSelect.q-mt-md(
    v-if="loadingMethods || methodOptions.length"
    v-model="methodId"
    :options="methodOptions"
    :label="$t('edubridge.shareReturn.methodLabel')"
    :placeholder="$t('edubridge.shareReturn.methodPlaceholder')"
    :disabled="busy || loadingMethods"
    required
  )
  .edu-share-return__empty.q-mt-md(v-else)
    .t-sm {{ $t('edubridge.shareReturn.noMethods') }}
    BaseButton.q-mt-sm(variant="secondary" @click="goToMethods") {{ $t('edubridge.shareReturn.addMethod') }}
  .t-sm.t-muted.q-mt-md {{ $t('edubridge.shareReturn.note') }}
  template(#footer)
    BaseButton(variant="ghost" :disabled="busy" @click="close") {{ $t('common.action.cancel') }}
    BaseButton(variant="primary" :loading="busy" :disabled="!canSubmit" @click="submit") {{ $t('edubridge.shareReturn.submit') }}
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseButton, BaseDialog, BaseSelect, type BaseSelectOption } from 'src/shared/ui/base';
import { AmountInput } from 'src/shared/ui/domain';
import { paymentMethodDescription, paymentMethodLabel, useWalletStore } from 'src/entities/Wallet';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { requestShareReturn } from '../../../entities/Teacher';
import { t } from '../../../i18n';

const props = defineProps<{ modelValue: boolean; available: number; symbol: string }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void; (e: 'done'): void }>();

const route = useRoute();
const router = useRouter();
const walletStore = useWalletStore();
const { info } = useSystemStore();
const session = useSessionStore();

const amount = ref<number | string | null>(null);
const methodId = ref<string | null>(null);
const busy = ref(false);
const loadingMethods = ref(false);

const amountValue = computed(() => Number.parseFloat(String(amount.value ?? '').replace(',', '.')) || 0);
const methodOptions = computed<BaseSelectOption[]>(() =>
  walletStore.methods.map((m) => ({ value: String(m.method_id), label: paymentMethodLabel(m), caption: paymentMethodDescription(m) })),
);
const canSubmit = computed(() => amountValue.value > 0 && amountValue.value <= props.available && !!methodId.value && !busy.value);

// Реквизиты читаются при открытии: пайщик мог завести их только что.
watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return;
    amount.value = null;
    methodId.value = null;
    loadingMethods.value = true;
    try {
      await walletStore.loadUserWallet({ coopname: info.coopname, username: session.username });
      if (walletStore.methods.length === 1) methodId.value = String(walletStore.methods[0]!.method_id);
    } catch (e) {
      FailAlert(e);
    } finally {
      loadingMethods.value = false;
    }
  },
);

function close(): void {
  emit('update:modelValue', false);
}

function goToMethods(): void {
  close();
  void router.push({ name: 'payment-methods', params: { coopname: route.params.coopname } });
}

async function submit(): Promise<void> {
  if (!canSubmit.value || !methodId.value) return;
  busy.value = true;
  try {
    await requestShareReturn(`${amountValue.value.toFixed(4)} ${props.symbol}`, methodId.value);
    SuccessAlert(t('edubridge.shareReturn.success'));
    emit('done');
    close();
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}
</script>
