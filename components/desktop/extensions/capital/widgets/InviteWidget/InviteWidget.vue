<template lang="pug">
div.invite-widget
  Editor(
    :model-value="invite"
    :readonly="true"
    :toolbar="false"
    :placeholder="$t('capital.inviteWidget.emptyPlaceholder')"
    class="invite-editor"
    :padded="false"
  )
</template>

<script lang="ts" setup>
import { Editor } from 'src/shared/ui';

// Определяем props
defineProps<{
  invite: string;
}>();
</script>

<style lang="scss" scoped>
.invite-widget {
  .invite-editor {
    min-height: 200px;
    max-height: 600px;
    overflow-y: auto;

    :deep(.ql-editor) {
      padding: 12px;
      border-radius: 4px;
      background-color: #ffffff;
      border: 1px solid #e0e0e0;
      font-size: 14px;
      line-height: 1.5;
    }

    :deep(.ql-toolbar) {
      display: none;
    }
  }
}
</style>
