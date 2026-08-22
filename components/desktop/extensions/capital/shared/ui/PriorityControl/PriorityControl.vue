<template lang="pug">
.priority-control(@click.stop)
  //- Чип с русской подписью — шапки страниц и широкие слоты
  .priority-control__trigger(
    v-if='variant === "chip"'
    :class='{ "priority-control__trigger--readonly": readonly }'
  )
    BaseChip.priority-control__chip(:variant='chipVariant' size='sm')
      q-spinner.q-mr-xs(v-if='saving' size='12px')
      span.priority-control__label {{ label }}
      q-icon.q-ml-xs(v-if='!readonly' name='arrow_drop_down' size='xs')
    q-tooltip(anchor='bottom middle' self='top middle') Приоритет: {{ label }}
    InlineSelectMenu(v-if='!readonly' title='Сменить приоритет' :options='menuOptions' :current='modelValue' @select='onSelect')

  //- Компактная иконка — строки списков (задачи, проекты, компоненты)
  .priority-control__trigger(
    v-else
    :class='{ "priority-control__trigger--readonly": readonly }'
  )
    q-spinner(v-if='saving' size='16px' :color='iconColor')
    q-icon(v-else :name='icon' :color='iconColor' size='18px')
    q-tooltip(anchor='bottom middle' self='top middle') Приоритет: {{ label }}
    InlineSelectMenu(v-if='!readonly' title='Сменить приоритет' :options='menuOptions' :current='modelValue' @select='onSelect')
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { BaseChip } from 'src/shared/ui/base';
import {
  ISSUE_PRIORITY_OPTIONS,
  getIssuePriorityIcon,
  getIssuePriorityColor,
  getIssuePriorityLabel,
  getIssuePriorityChipVariant,
} from 'app/extensions/capital/shared/lib';
import { InlineSelectMenu } from '../InlineSelectMenu';

const props = withDefaults(
  defineProps<{
    /** Текущий приоритет (значения общие для задач, проектов и компонентов) */
    modelValue: string;
    readonly?: boolean;
    saving?: boolean;
    /** chip — чип с подписью; icon — компактная иконка в сетке строки */
    variant?: 'chip' | 'icon';
  }>(),
  {
    readonly: false,
    saving: false,
    variant: 'chip',
  },
);

const emit = defineEmits<{
  (e: 'select', value: string): void;
}>();

const label = computed(() => getIssuePriorityLabel(props.modelValue));
const icon = computed(() => getIssuePriorityIcon(props.modelValue));
const iconColor = computed(() => getIssuePriorityColor(props.modelValue));
const chipVariant = computed(() => getIssuePriorityChipVariant(props.modelValue));

const menuOptions = ISSUE_PRIORITY_OPTIONS.map((opt) => ({
  ...opt,
  icon: getIssuePriorityIcon(opt.value),
  iconColor: getIssuePriorityColor(opt.value),
}));

const onSelect = (value: string) => {
  if (value === props.modelValue) return;
  emit('select', value);
};
</script>

<style lang="scss" scoped>
.priority-control {
  display: inline-flex;
  align-items: center;
}

.priority-control__trigger {
  display: inline-flex;
  align-items: center;
  cursor: pointer;

  &--readonly {
    cursor: default;
  }
}

.priority-control__chip {
  margin: 0;
}

.priority-control__label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 90px;
}
</style>
