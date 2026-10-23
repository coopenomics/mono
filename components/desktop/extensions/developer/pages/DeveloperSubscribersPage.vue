<template lang="pug">
q-page(padding)
  .q-pa-md
    BaseBanner.q-mb-md(variant='info')
      | {{ $t('developer.subscribers.intro') }}
    EmptyState(
      :title="$t('developer.subscribers.emptyTitle')",
      :body="$t('developer.subscribers.emptyBody')"
    )
      template(#icon)
        q-icon(name='group', size='28px')
</template>

<script setup lang="ts">
import { BaseBanner, EmptyState } from 'src/shared/ui/base';
</script>
