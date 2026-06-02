<template lang="pug">
q-dialog(:model-value='modelValue', @update:model-value='$emit(`update:modelValue`, $event)')
  q-card(style='min-width: 480px')
    q-card-section
      .text-h6 {{ title }}

    q-card-section
      q-banner(rounded, dense, class='bg-orange-1 text-orange-10')
        template(#avatar)
          q-icon(name='construction', color='orange-10')
        | Полная форма подписи документа подключается отдельным мастером.
        |
        | Сейчас этот диалог фиксирует намерение и закрывается без отправки.

    q-card-actions(align='right')
      q-btn(flat, no-caps, label='Отменить', v-close-popup)
      q-btn(
        unelevated,
        color='primary',
        no-caps,
        :label='confirmLabel',
        :disable='true'
      )
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type { PropType } from 'vue';
import type { IProgramExpense } from 'app/extensions/capital/entities/ProgramExpense/model';

type WorkflowAction = 'approve' | 'authorize' | 'pay' | 'decline' | 'topup';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  action: { type: String as PropType<WorkflowAction>, required: true },
  expense: { type: Object as PropType<IProgramExpense | null>, default: null },
});

defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'done'): void;
}>();

const title = computed(() => {
  switch (props.action) {
    case 'approve': return 'Одобрить служебную записку';
    case 'authorize': return 'Авторизовать расход советом';
    case 'pay': return 'Подтвердить выплату расхода';
    case 'decline': return 'Отклонить расход';
    case 'topup': return 'Пополнить пул программных расходов';
    default: return '—';
  }
});

const confirmLabel = computed(() => {
  switch (props.action) {
    case 'approve': return 'Подписать и одобрить';
    case 'authorize': return 'Подписать протокол совета';
    case 'pay': return 'Подтвердить выплату';
    case 'decline': return 'Отклонить';
    case 'topup': return 'Пополнить пул';
    default: return 'Подтвердить';
  }
});
</script>
