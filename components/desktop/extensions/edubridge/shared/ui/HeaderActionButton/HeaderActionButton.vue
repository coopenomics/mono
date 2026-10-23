<template lang="pug">
BaseButton(variant="primary" size="sm" :icon-only="isCompact" :aria-label="label" @click="emit('click')")
  template(#icon-left)
    q-icon(:name="icon" size="18px")
  | {{ label }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useQuasar } from 'quasar';
import { BaseButton } from 'src/shared/ui/base';

/**
 * Главное действие страницы в шапке приложения («Добавить курс», «Создать
 * отчёт»): страница регистрирует его через `useHeaderActions`. На узком экране
 * остаётся одна иконка.
 */
withDefaults(defineProps<{ label: string; icon?: string }>(), { icon: 'add' });
const emit = defineEmits<{ click: [] }>();
const $q = useQuasar();
const isCompact = computed(() => $q.screen.lt.sm);
</script>
