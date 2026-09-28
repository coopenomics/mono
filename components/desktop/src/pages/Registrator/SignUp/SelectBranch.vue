<template lang="pug">
div(v-if='store', v-show='store.isStep("SelectBranch")')
    BranchSelector(
      v-model:selectedBranch="store.state.selectedBranch"
      :branches="branches"
    )
    .row.q-gutter-md.q-mt-lg.q-mb-lg
      BaseButton(variant='ghost', @click='store.prev()')
        q-icon(name='arrow_back')
        span.q-ml-md {{ $t('registrator.selectBranch.back') }}

      BaseButton(
        variant='primary',
        :disabled='!store.state.selectedBranch',
        @click='store.next()'
      ) {{ $t('registrator.selectBranch.submit') }}

</template>

<script lang="ts" setup>
import { BranchContract } from 'cooptypes'
import { liveTable, useLiveReload } from 'src/shared/lib/realtime'
import { useBranchStore } from 'src/entities/Branch/model'
import { useRegistratorStore } from 'src/entities/Registrator'
import { FailAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
const { info } = useSystemStore()

import { computed, watch, ref } from 'vue'
import { BranchSelector } from 'src/shared/ui/BranchSelector';
import { BaseButton } from 'src/shared/ui/base/BaseButton';

const store = useRegistratorStore()
const branchStore = useBranchStore()
const isLoading = ref(false)

const load = async () => {
  if (!store.isStep('SelectBranch') || isLoading.value) return;

  try {
    isLoading.value = true
    await branchStore.loadPublicBranches({ coopname: info.coopname })
  } catch(e: any) {
    FailAlert(e)
  } finally {
    isLoading.value = false
  }
}

// Используем только watch с immediate: true вместо onMounted + watch
watch(() => store.state.step, async () => {
  load()
}, { immediate: true })

// Участки к выбору живут по ленте: новый или закрытый участок появляется в
// списке сам (для гостя канал ленты закрыт, список читается при открытии).
useLiveReload([liveTable(BranchContract, BranchContract.Tables.Branches)], load)

// приватные участки, недоступные текущему пайщику (не в белом списке), к выбору не показываем
const branches = computed(() => branchStore.publicBranches.filter((branch) => branch.is_available))

</script>
