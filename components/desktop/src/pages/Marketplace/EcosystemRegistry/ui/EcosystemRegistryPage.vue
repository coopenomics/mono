<script lang="ts" setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { BaseCard, EmptyState } from 'src/shared/ui/base'
import { PageHint } from 'src/shared/ui/domain'

const route = useRoute()
const coopname = computed(() => String(route.params.coopname ?? ''))
</script>

<template lang="pug">
q-page.ecosystem(role="region", :aria-label="$t('marketplace.ecosystemRegistryPage.ariaLabel')")
  PageHint(storage-key="mp:ecosystem:banner-dismissed")
    | {{ $t('marketplace.ecosystemRegistryPage.bannerHint') }}

  BaseCard(:title="$t('marketplace.ecosystemRegistryPage.currentCoopTitle')")
    .t-muted
      | {{ $t('marketplace.ecosystemRegistryPage.currentCoopPrefix') }} #[strong {{ coopname || '—' }}] {{ $t('marketplace.ecosystemRegistryPage.currentCoopSuffix') }}

  BaseCard(:title="$t('marketplace.ecosystemRegistryPage.otherCoopsTitle')")
    EmptyState(
      :title="$t('marketplace.ecosystemRegistryPage.comingSoonTitle')",
      :body="$t('marketplace.ecosystemRegistryPage.comingSoonBody')"
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
