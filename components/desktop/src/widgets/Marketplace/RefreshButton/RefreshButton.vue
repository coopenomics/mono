<template lang="pug">
BaseButton(
  variant='ghost',
  size='sm',
  icon-only,
  :aria-label='ariaLabel',
  :loading='loading',
  @click="emit('refresh')"
)
  template(#icon-left)
    q-icon(name='refresh', :size='size')
  q-tooltip(anchor='bottom middle', self='top middle') {{ ariaLabel }}
</template>

<script setup lang="ts">
import { BaseButton } from 'src/shared/ui/base';

/**
 * Канон-кнопка «Обновить» для столов Marketplace. Вынесена в общий виджет —
 * ручная перезагрузка ленты повторялась в ~15 страницах столов (входящие
 * заказы, сводный заказ, готово к получению, склад и т.д.), каждый раз слегка
 * по-разному (то icon-only, то с подписью, разный размер иконки) и «выпадала»
 * из общего вида. Единый ghost-icon согласует внешний вид и место (под-навигация
 * `PageTabs #actions` либо шапка через `Teleport to="#header-actions-host"`).
 */
withDefaults(
  defineProps<{
    /** Идёт ли загрузка — крутит спиннер вместо иконки. */
    loading?: boolean;
    /** Размер иконки (по умолчанию 20px — как у глобальных действий шапки). */
    size?: string;
    /** Подпись для скринридера и подсказки. */
    ariaLabel?: string;
  }>(),
  { loading: false, size: '20px', ariaLabel: 'Обновить' },
);

const emit = defineEmits<{ refresh: [] }>();
</script>
