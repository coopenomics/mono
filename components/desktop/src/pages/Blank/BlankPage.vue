<template lang="pug">
q-page.blank-page
  .blank-page__inner
    EmptyState(
      title='Страница не найдена',
      body='Похоже, такой страницы нет или она была перенесена. Попробуйте вернуться на главную.'
    )
      template(#icon)
        q-icon(name='search_off', size='48px')
      template(#action)
        BaseButton(variant='primary', @click='goHome')
          template(#icon-left)
            q-icon(name='home')
          | На главную
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import EmptyState from 'src/shared/ui/base/EmptyState/EmptyState.vue';
import BaseButton from 'src/shared/ui/base/BaseButton/BaseButton.vue';

const router = useRouter();

function goHome(): void {
  void router.push('/');
}
</script>

<style scoped>
.blank-page {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--p-6, 24px);
}
.blank-page__inner {
  width: 100%;
  max-width: 520px;
}
</style>
