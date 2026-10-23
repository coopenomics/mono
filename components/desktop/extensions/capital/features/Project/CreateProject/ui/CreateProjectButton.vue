<template lang="pug">
q-fab-action(color="primary" @click="handleButtonClick" icon="add") {{ $t('capital.createProjectButton.label') }}
  //- q-btn(
  //-   color='primary',
  //-   @click='showDialog = true',
  //-   :loading='loading',
  //-   label="Проект",
  //-   icon="add",
  //-   :dense="isMobile"
  //- )

CreateProjectDialog(
  ref="dialogRef"
  @success="handleSuccess"
)
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { CreateProjectDialog } from './Dialog';

defineProps<{
  mini?: boolean;
}>();

const emit = defineEmits<{
  onClick: [];
}>();

const dialogRef = ref();

const handleButtonClick = () => {
  dialogRef.value?.openDialog();
};

const handleSuccess = () => {
  emit('onClick');
};
</script>
