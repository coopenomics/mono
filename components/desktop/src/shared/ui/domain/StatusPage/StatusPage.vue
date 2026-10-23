<template lang="pug">
//- Страница-состояние: адреса нет, прав нет, связи нет. Одна композиция на все
//- случаи, чтобы кабинет говорил о них одинаково: иконка, заголовок, короткое
//- объяснение и действия. Заголовок страницы в топбар не дублируется — у таких
//- страниц его нет по смыслу.
.status-page
  .status-page__box
    EmptyState(:title='title', :body='body')
      template(#icon)
        q-icon(:name='icon', size='32px')
      template(#action)
        .status-page__actions(v-if='$slots.actions')
          slot(name='actions')
</template>

<script setup lang="ts">
import { EmptyState } from 'src/shared/ui/base';
import type { StatusPageProps } from './StatusPage.types';

defineProps<StatusPageProps>();
</script>

<style scoped>
.status-page {
  display: flex;
  justify-content: center;
  padding: var(--p-8) var(--p-4);
}

.status-page__box {
  width: 100%;
  max-width: 480px;
}

.status-page__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--p-3);
  margin-top: var(--p-4);
}
</style>
