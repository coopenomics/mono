<script setup lang="ts">
import { computed } from 'vue';

interface IProps {
  title?: string
  show_close?: boolean
}

const props = withDefaults(defineProps<IProps>(), {
  title: '',
  show_close: true
})

const title = computed(() => props.title)
</script>

<template lang="pug">
q-card(style="min-width: 350px; max-width: 100%;")
  q-bar.modal-base__bar.bg-gradient-dark.text-white
    span.modal-base__title(v-if="!$slots.title") {{ title }}
    slot(v-else name="title")
    q-space
    q-btn.modal-base__close(v-if="show_close" v-close-popup dense flat icon="close")
      q-tooltip Закрыть
  slot

</template>

<style scoped lang="scss">
/* Заголовок диалога может занимать две строки (длинные названия, узкий
   экран). q-bar по умолчанию nowrap c фиксированной высотой и обрезает
   текст сверху — разрешаем перенос, растим бар по контенту и прижимаем
   крестик к верху, чтобы он не уезжал вниз вслед за второй строкой. */
.modal-base__bar {
  height: auto;
  min-height: 32px;
  align-items: flex-start;
  padding-top: 8px;
  padding-bottom: 8px;
}
.modal-base__title {
  flex: 1 1 auto;
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
  line-height: 1.3;
}
.modal-base__close {
  flex: 0 0 auto;
}
</style>
