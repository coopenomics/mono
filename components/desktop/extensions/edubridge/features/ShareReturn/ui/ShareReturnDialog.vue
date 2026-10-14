<template lang="pug">
//- Возврат паевого взноса одной кнопкой: возвращается вся доступная сумма, пайщик
//- выбирает только реквизиты; два заявления подписываются разом. Без реквизитов —
//- ссылка туда, где их завести.
BaseDialog(:model-value="modelValue" :title="$t('edubridge.shareReturn.title')" size="sm" @update:model-value="(v) => $emit('update:modelValue', v)")
  DataRow(:label="$t('edubridge.shareReturn.amountLabel')" :value="formatAsset2Digits(`${available.toFixed(4)} ${symbol}`)" align="spread")
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
  template(#footer)
    BaseButton(variant="ghost" :disabled="busy" @click="close") {{ $t('common.action.cancel') }}
    BaseButton(variant="primary" :loading="busy" :disabled="!canSubmit" @click="submit") {{ $t('edubridge.shareReturn.submit') }}
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseButton, BaseDialog, BaseSelect, type BaseSelectOption } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
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

const methodId = ref<string | null>(null);
const busy = ref(false);
const loadingMethods = ref(false);

const methodOptions = computed<BaseSelectOption[]>(() =>
  walletStore.methods.map((m) => ({ value: String(m.method_id), label: paymentMethodLabel(m), caption: paymentMethodDescription(m) })),
);
const canSubmit = computed(() => props.available > 0 && !!methodId.value && !busy.value);

// Реквизиты читаются при открытии: пайщик мог завести их только что.
watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return;
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
    // Возвращается вся доступная сумма: другой суммы пайщик здесь не выбирает.
    await requestShareReturn(`${props.available.toFixed(4)} ${props.symbol}`, methodId.value);
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
