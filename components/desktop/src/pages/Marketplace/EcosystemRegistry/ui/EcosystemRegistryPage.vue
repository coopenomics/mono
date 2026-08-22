<script lang="ts" setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { BaseCard, EmptyState } from 'src/shared/ui/base'
import { PageHint } from 'src/shared/ui/domain'

const route = useRoute()
const coopname = computed(() => String(route.params.coopname ?? ''))
</script>

<template lang="pug">
q-page.ecosystem(role="region", aria-label="Экосистема кооперативов")
  PageHint(storage-key="mp:ecosystem:banner-dismissed")
    | Кооперативы экосистемы, подключившие расширение «Стол заказов». Межкооперативная торговля между ними включится позже.

  BaseCard(title="Текущий кооператив")
    .t-muted
      | Кооператив #[strong {{ coopname || '—' }}] установил расширение «Стол заказов».

  BaseCard(title="Другие кооперативы с расширением «Стол заказов»")
    EmptyState(
      title="Межкооперативная торговля включится позже",
      body="Когда соседние кооперативы подключатся к Столу заказов, они появятся здесь."
    )
      template(#icon)
        q-icon(name="hub", size="48px")
</template>

<style scoped lang="scss">
.ecosystem {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
}

@media (max-width: 768px) {
  .ecosystem {
    padding: var(--p-4, 16px);
  }
}
</style>
