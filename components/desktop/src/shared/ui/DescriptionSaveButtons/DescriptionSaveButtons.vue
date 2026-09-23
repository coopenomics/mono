<template lang="pug">
// Кнопки сохранения (всегда видны при наличии прав редактирования)
div(v-if="canEdit").row.justify-center.q-gutter-sm
  q-btn(
    flat
    size="sm"
    color="negative"
    :label="$t('ui.descriptionSaveButtons.cancelLabel')"
    :disable="!hasChanges"
    @click="$emit('reset')"
  )
  q-btn(
    size="sm"
    color="primary"
    :label="$t('common.action.save')"
    :loading="isSaving"
    :disable="!hasChanges"
    @click="$emit('save')"
  )
</template>

<script lang="ts" setup>
defineProps<{
  hasChanges: boolean;
  canEdit: boolean;
  isSaving: boolean;
}>();

defineEmits<{
  reset: [];
  save: [];
}>();
</script>

<style lang="scss" scoped>
</style>
