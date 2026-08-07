<template lang="pug">
.payment-method-select
  .banner.banner--warn(v-if='isEmpty')
    q-icon.banner__icon(name='warning', size='20px')
    .banner__body {{ emptyMessage }}

  BaseSelect(
    :model-value='modelValue',
    :options='options',
    :label='label',
    :placeholder='isEmpty ? "Нет доступных реквизитов" : placeholder',
    :hint='isEmpty ? undefined : hint',
    :error='error || loadError',
    :disabled='disabled || loading || isEmpty',
    :required='required && !isEmpty',
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
    /** Текст баннера, если у получателя нет сохранённых реквизитов. */
    emptyMessage?: string;
  }>(),
  {
    modelValue: null,
    label: 'Реквизиты получателя',
    placeholder: 'Выберите способ получения средств',
    emptyMessage:
      'У получателя нет сохранённых реквизитов. Добавьте способ получения средств в профиле.',
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

const isEmpty = computed(
  () => Boolean(props.username) && !loading.value && !loadError.value && methods.value.length === 0,
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

<style lang="scss" scoped>
.payment-method-select {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  min-width: 0;
}
</style>
