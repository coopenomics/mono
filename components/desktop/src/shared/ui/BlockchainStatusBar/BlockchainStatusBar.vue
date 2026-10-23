<template lang="pug">
div.footer-root.blockinfo.no-select
  div(v-if="missedConnection")
    i(style="color: red").far.fa-circle
    div
      span {{ $t('ui.blockchainStatusBar.noConnectionTop') }}
    div
      span {{ $t('ui.blockchainStatusBar.noConnectionBottom') }}
  div(v-else)
    i(style="color: green").far.fa-circle
    div
      span {{ $t('ui.blockchainStatusBar.blockNumberLabel') }}
    div
      span {{ currentBlock }}

</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSystemStore } from 'src/entities/System/model'

const { info } = useSystemStore()

let currentBlock = computed(() => {
  return info.blockchain_info?.head_block_num
})

// Всегда считаем, что соединение есть, поскольку blockchain_info обновляется автоматически
let missedConnection = computed(() => {
  return false
})

</script>

<style lang="scss">
.footer-root {
  text-align: center;
}

.blockinfo {
  width: 100%;
  text-align: center;
  position: absolute;
  bottom: 10px;
  font-style: normal;
  font-weight: 400;
  font-size: 10px;
  line-height: 16px;
  color: #8a8a8a;
}

.logout {
  cursor: pointer;

  &:hover .logout-text {
    text-decoration: underline;
  }

  .logout-text {
    font-style: normal;
    font-weight: 400;
    font-size: 14px;
    line-height: 18px;
    color: #181818;
    vertical-align: bottom;
    display: inline-block;
    padding-left: 10px;
  }
}
</style>
src/app/config
