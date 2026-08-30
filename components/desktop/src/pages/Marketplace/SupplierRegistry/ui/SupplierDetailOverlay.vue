<template lang="pug">
DetailsDrawer(
  :model-value='isOpen',
  :width='560',
  title='Поставщик',
  @update:model-value='(v) => !v && overlay.close()'
)
  .supplier-detail(v-if='supplier')
    IdentityCell(
      :account-name='supplier.member_account',
      :full-name='fullName'
    )

    .supplier-detail__status
      BaseBadge(:variant='SUPPLIER_STATUS_VARIANT[supplier.status] || "neutral"')
        | {{ SUPPLIER_STATUS_LABEL[supplier.status] || supplier.status }}

    DataRow(label='Модель', :value='SUPPLIER_MODEL_LABEL[supplier.model] || supplier.model')
    DataRow(label='Договор', :value='contractLabel')
    DataRow(
      v-if='supplier.contract_date',
      label='Дата договора',
      :value='supplier.contract_date'
    )
    DataRow(label='Аккаунт пайщика', :value='supplier.member_account', copyable, mono)

    //- Решение председателя по заявке — здесь же, не возвращаясь в реестр
    .supplier-detail__actions(v-if='canModerate')
      BaseButton(
        variant='primary',
        :loading='acting',
        @click='emit("approve", supplier)'
      ) Одобрить
      BaseButton(
        variant='ghost',
        :disabled='acting',
        @click='emit("reject", supplier)'
      ) Отклонить
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useQueryOverlay } from 'src/shared/lib/navigation';
import { DetailsDrawer, DataRow, IdentityCell } from 'src/shared/ui/domain';
import { BaseBadge, BaseButton } from 'src/shared/ui/base';
import type { MarketplaceSupplierView } from '../api';
import {
  SUPPLIER_MODEL_LABEL,
  SUPPLIER_STATUS_LABEL,
  SUPPLIER_STATUS_VARIANT,
} from '../types';

/**
 * Карточка поставщика — оверлеем поверх реестра (`?supplier=<account>`).
 *
 * Отдельной страницы у поставщика нет и заводить её не требуется: карточка
 * читается из уже загруженного реестра, а решение по заявке принимается прямо
 * здесь. Ключ — имя аккаунта пайщика: оно устойчиво и делает ссылку
 * осмысленной, в отличие от внутреннего идентификатора строки.
 */
const props = defineProps<{
  items: MarketplaceSupplierView[];
  /** Председатель может одобрить или отклонить заявку */
  canModerate?: boolean;
  /** Идёт решение по этому поставщику */
  acting?: boolean;
  /** Имя пайщика по аккаунту — реестр уже подгрузил его для строк */
  nameByAccount?: Record<string, string>;
}>();

const emit = defineEmits<{
  approve: [supplier: MarketplaceSupplierView];
  reject: [supplier: MarketplaceSupplierView];
}>();

const overlay = useQueryOverlay('supplier');

const supplier = computed<MarketplaceSupplierView | null>(() => {
  const account = overlay.value.value;
  if (!account) return null;
  return props.items.find((s) => s.member_account === account) ?? null;
});

const isOpen = computed(() => overlay.isOpen.value && !!supplier.value);

const fullName = computed(() =>
  supplier.value ? props.nameByAccount?.[supplier.value.member_account] ?? '' : '',
);

const contractLabel = computed(() => {
  const s = supplier.value;
  if (!s?.contract_number) return '—';
  return `№ ${s.contract_number}`;
});

const canModerate = computed(
  () => !!props.canModerate && supplier.value?.status === 'PENDING',
);
</script>

<style lang="scss" scoped>
.supplier-detail {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);

  &__status {
    display: flex;
  }

  &__actions {
    display: flex;
    gap: var(--p-2);
    margin-top: var(--p-2);
  }
}
</style>
