<template lang="pug">
div.logs-page
  ExtensionLogsList(extension-name="powerup")
    template(#log-item="{ log }")
      PowerupLogItem(:log="log")
</template>

<script lang="ts" setup>
import { ExtensionLogsList } from 'src/widgets/ExtensionLogsList'
import { PowerupLogItem } from '../../../widgets/PowerupLogItem'
</script>

<style lang="scss" scoped>
.logs-page {
  padding: var(--p-6, 24px);
  max-width: 1200px;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .logs-page {
    padding: var(--p-4, 16px);
  }
}
</style>
