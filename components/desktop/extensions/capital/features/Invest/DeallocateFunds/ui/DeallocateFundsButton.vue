<template lang="pug">
span(@click.stop)
  BaseButton(
    variant='ghost',
    size='sm',
    :aria-label='$t("capital.deallocateFundsButton.ariaLabel")',
    @click='open = true'
  )
    template(#icon-left)
      q-icon(name='undo', size='16px')
    | {{ $t('capital.deallocateFundsButton.label') }}
  q-tooltip {{ $t('capital.deallocateFundsButton.description') }}

  DeallocateFundsDialog(
    v-model='open',
    :project-hash='projectHash',
    :component-title='componentTitle',
    @deallocated='onDeallocated'
  )
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { reloadProgramFunds } from '../../reloadProgramFunds';
import DeallocateFundsDialog from './DeallocateFundsDialog.vue';

defineProps<{
  projectHash: string;
  componentTitle: string;
}>();


const open = ref(false);

// Суммы перечитываются сразу после ответа мутации (reloadProgramFunds).
const onDeallocated = reloadProgramFunds;
</script>
