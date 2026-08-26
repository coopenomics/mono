<template lang="pug">
q-page.q-pa-md
  PageHead(
    eyebrow='Поддержка'
    title='Обращение'
    subtitle='Переписка по обращению и его текущее состояние.'
  )
  .support-stub
    q-icon(name='support_agent' size='32px')
    .t-body Экран появится следующей фазой.
</template>

<script setup lang="ts">
// Заглушка каркаса столов: маршрут, права и пункт меню заведены, содержимое —
// отдельной фазой. Страница намеренно ничего не запрашивает у сервера.
import { PageHead } from 'src/shared/ui/layout';
</script>

<style scoped>
.support-stub {
  display: flex;
  align-items: center;
  gap: var(--p-3);
  margin-top: var(--p-6);
  padding: var(--p-5);
  border: 1px dashed var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface-2);
  color: var(--p-ink-2);
}
</style>
