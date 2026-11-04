<template lang="pug">
//- Компактный выбор из короткого списка (период, разрез): кнопка с подписью
//- выбранного варианта, список открывается меню под кнопкой. Стоит в строке
//- заголовка раздела или в шапке приложения, где поле выбора с подписью
//- выше соседних кнопок и ломает строку.
BaseButton(variant='secondary' size='sm')
  template(v-if='icon' #icon-left)
    q-icon(:name='icon' size='18px')
  | {{ selectedLabel }}
  q-icon.q-ml-xs(name='expand_more' size='18px')
  q-menu(anchor='bottom right' self='top right')
    q-list(dense)
      q-item(
        v-for='option in options'
        :key='option.value'
        v-close-popup
        clickable
        :active='option.value === modelValue'
        active-class='text-primary'
        @click='emit("update:modelValue", option.value)'
      )
        q-item-section {{ option.label }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { BaseButton } from 'src/shared/ui/base';
import type { MenuSelectButtonProps } from './MenuSelectButton.types';

const props = defineProps<MenuSelectButtonProps>();
const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>();

const selectedLabel = computed(
  () => props.options.find((o) => o.value === props.modelValue)?.label ?? '',
);
</script>
