<template lang="pug">
ProjectInviteEditor(:placeholder='invitePlaceholder || $t("capital.projectInviteEditorPage.placeholder")')
</template>

<script lang="ts" setup>
import { ProjectInviteEditor } from 'app/extensions/capital/widgets/ProjectInviteEditor';

defineProps<{
  invitePlaceholder?: string;
}>();
</script>
