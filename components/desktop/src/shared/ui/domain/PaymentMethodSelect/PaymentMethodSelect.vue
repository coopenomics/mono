<template lang="pug">
BaseSelect(
  :model-value='modelValue',
  :options='options',
  :label='label',
  :placeholder='placeholder',
  :hint='hint',
  :error='error || loadError',
  :disabled='disabled || loading',
  :required='required',
  @update:model-value='$emit("update:modelValue", $event === null ? null : String($event))'
)
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';
import { BaseSelect } from 'src/shared/ui/base/BaseSelect';
import type { BaseSelectOption } from 'src/shared/ui/base/BaseSelect';
import {
  formatPaymentMethodShort,
  type IPaymentMethodLike,
} from './formatPaymentMethod';

const props = withDefaults(
  defineProps<{
    modelValue?: string | null;
    /** Чьи реквизиты выбираем — владелец платёжных методов. */
    username: string;
    label?: string;
    placeholder?: string;
    hint?: string;
    error?: string;
    disabled?: boolean;
    required?: boolean;
  }>(),
  {
    modelValue: null,
    label: 'Реквизиты получателя',
    placeholder: 'Выберите способ получения средств',
  },
);

defineEmits<{ (e: 'update:modelValue', value: string | null): void }>();

const methods = ref<IPaymentMethodLike[]>([]);
const loading = ref(false);
const loadError = ref('');

const options = computed<BaseSelectOption[]>(() =>
  methods.value.map((m) => ({
    value: String(m.method_id),
    label: formatPaymentMethodShort(m),
  })),
);

watch(
  () => props.username,
  async (username) => {
    methods.value = [];
    loadError.value = '';
    if (!username) return;
    loading.value = true;
    try {
      const result = await client.Query(Queries.PaymentMethods.GetPaymentMethods.query, {
        variables: { data: { username, limit: 100, page: 1 } },
      });
      methods.value = (result.getPaymentMethods.items as unknown as IPaymentMethodLike[]) ?? [];
      if (!methods.value.length) {
        loadError.value = 'У получателя нет сохранённых реквизитов';
      }
    } catch (e) {
      console.error('Ошибка загрузки платёжных методов:', e);
      loadError.value = 'Не удалось загрузить реквизиты получателя';
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);
</script>
