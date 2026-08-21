<template lang="pug">
//- Сверка личности пайщика с документом. Одинакова везде, где личность
//- подтверждают лично: на пункте выдачи и в реестре пайщиков у совета.
BaseDialog(
  :model-value='modelValue',
  :title='title',
  :size='size',
  @update:model-value='(value) => emit("update:modelValue", value)'
)
  .verify-confirm
    .verify-confirm__name(v-if='fullName') {{ fullName }}
    AccountBadge(:account-name='username', size='sm')

    //- Дополнительные данные для сверки (дата рождения, паспорт) — по месту.
    .verify-confirm__extra
      slot

    .verify-confirm__hint {{ hint }}

    .verify-confirm__actions
      BaseButton(
        variant='ghost',
        :disabled='loading',
        @click='emit("update:modelValue", false)'
      ) Отмена
      BaseButton(variant='primary', :loading='loading', @click='emit("confirm")')
        template(#icon-left)
          q-icon(name='how_to_reg', size='16px')
        | {{ confirmLabel }}
</template>

<script setup lang="ts">
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { AccountBadge } from 'src/shared/ui/domain/AccountBadge';
import type { VerificationConfirmDialogProps } from './VerificationConfirmDialog.types';

withDefaults(defineProps<VerificationConfirmDialogProps>(), {
  title: 'Проверка личности',
  confirmLabel: 'Личность подтверждена',
  loading: false,
  size: 'sm',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'confirm'): void;
}>();
</script>

<style scoped lang="scss">
.verify-confirm {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
}

.verify-confirm__name {
  font-size: var(--p-fs-h3);
  line-height: var(--p-lh-h3);
  font-weight: 600;
  color: var(--p-ink);
}

.verify-confirm__extra:empty {
  display: none;
}

.verify-confirm__hint {
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-2);
}

.verify-confirm__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--p-2, 8px);
  margin-top: var(--p-2, 8px);
}
</style>
