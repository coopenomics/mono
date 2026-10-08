<template lang="pug">
//- Заём под коммиты: кнопка на карточке доли и окно заявления.
BaseButton(variant='secondary', size='sm', @click='open = true') {{ $t('capital.createDebtButton.label') }}
CreateDebtDialog(v-model='open', :project-hash='projectHash', :available='available', @created='$emit("created")')
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import CreateDebtDialog from './CreateDebtDialog.vue';

defineProps<{
  /** Проект, под долю в котором берётся заём. */
  projectHash: string;
  /** Доступно под заём. */
  available: number;
}>();
defineEmits<{ (e: 'created'): void }>();

const open = ref(false);
</script>
